/**
 * 6.3.3 实时编辑延迟测试（论文 6.3.3）
 * 方案：客户端 A 与 B 同时连到同一笔记（经 nginx），A 逐次插入+删除一个字符，
 * B 以 doc update 事件到达时刻计算单向传播延迟（A 提交 → 服务器广播 → B 收到）。
 * 采样 30 次，输出 avg/p95/max。内容净变化为零（插入后即删除）。
 * 运行：node scripts/perf/edit-latency.mjs [noteId] [baseUrl]
 */
import { createRequire } from 'module';
const require = createRequire(new URL('../../apps/server/package.json', import.meta.url));
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');
const WS = require('ws');

const BASE_HTTP = process.argv[3] ?? 'http://192.168.3.3:18080';
const WS_BASE = BASE_HTTP.replace(/^http/, 'ws');
const SAMPLES = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const login = await fetch(`${BASE_HTTP}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@wangyan.test', password: 'Demo12345678' }),
}).then((r) => r.json());
const token = login.access_token;
const noteId =
  process.argv[2] ??
  (await fetch(`${BASE_HTTP}/api/notes`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()))[0].id;

function connect(name) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(`${WS_BASE}/ws`, noteId, doc, {
    WebSocketPolyfill: WS.WebSocket,
    params: { token },
  });
  const frag = doc.getXmlFragment('default');
  return { name, doc, provider, frag };
}

const A = connect('A');
const B = connect('B');
const waitSync = async (c) => {
  for (let i = 0; i < 60 && c.frag.length < 1; i++) await sleep(250);
  if (c.frag.length < 1) throw new Error(`${c.name} 同步超时`);
};
await waitSync(A);
await waitSync(B);
await sleep(500);
console.log(`双客户端已连接笔记 ${noteId}，采样 ${SAMPLES} 次（A 编辑 → B 收到）`);

// B 侧记录每次 update 到达时刻
let arrivals = [];
B.doc.on('update', () => arrivals.push(performance.now()));

const latencies = [];
for (let i = 0; i < SAMPLES; i++) {
  arrivals = [];
  const t0 = performance.now();
  const frag = A.frag;
  const para = frag.get(frag.length - 1); // 末段段落（Y.XmlElement）
  const target = para.get(0); // 段内 Y.XmlText
  const textLen = target.length;
  A.doc.transact(() => {
    target.insert(textLen, '·'); // 插入
  });
  // 等首个到达
  for (let t = 0; t < 100 && arrivals.length === 0; t++) await sleep(1);
  if (arrivals.length === 0) throw new Error(`第 ${i + 1} 次编辑 B 未收到`);
  latencies.push(arrivals[0] - t0);
  // 撤销插入（净变化为零）
  A.doc.transact(() => {
    target.delete(textLen, 1);
  });
  await sleep(150);
}

latencies.sort((a, b) => a - b);
const n = latencies.length;
const p = (q) => +latencies[Math.min(n - 1, Math.floor(n * q))].toFixed(1);
console.log(`实时编辑传播延迟（n=${n}）: avg=${+(latencies.reduce((a, b) => a + b, 0) / n).toFixed(1)}ms p50=${p(0.5)} p95=${p(0.95)} max=${+latencies[n - 1].toFixed(1)}ms`);

A.provider.destroy();
B.provider.destroy();
A.doc.destroy();
B.doc.destroy();
await sleep(800);
process.exit(0);
