/**
 * 6.3.2 WebSocket 并发连接测试（论文 6.3.2）
 * 目标：部署系统经 nginx（默认 ws://192.168.3.3:18080）
 * 方案：200 个客户端分 4 批连接 4 篇笔记，记录建连成功率与建连耗时；保持 5s 后全部断开
 * 运行：node scripts/perf/ws-concurrent.mjs [total=200]
 */
import { createRequire } from 'module';
// ws 来自 apps/server 的依赖（pnpm 严格布局，从 workspace 包位置解析）
const require = createRequire(new URL('../../apps/server/package.json', import.meta.url));
const WS = require('ws');

const BASE_HTTP = process.argv[3] ?? 'http://192.168.3.3:18080';
const TOTAL = Number(process.argv[2] ?? 200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const login = await fetch(`${BASE_HTTP}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@wangyan.test', password: 'Demo12345678' }),
}).then((r) => r.json());
const token = login.access_token;

const notes = await fetch(`${BASE_HTTP}/api/notes`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
const noteIds = notes.slice(0, 4).map((n) => n.id);
console.log(`并发 ${TOTAL} 连接 → ${noteIds.length} 篇笔记（经 nginx :18080）`);

const results = [];
const sockets = [];
const t0 = performance.now();

// 分 4 批发起，批间隔 100ms，批内 25ms 间隔（模拟真实用户陆续进入）
for (let i = 0; i < TOTAL; i++) {
  const noteId = noteIds[i % noteIds.length];
  const start = performance.now();
  const ws = new WS.WebSocket(`ws://192.168.3.3:18080/ws/${noteId}?token=${token}`);
  const entry = { i, start, opened: null, failed: false };
  results.push(entry);
  sockets.push(ws);
  ws.on('open', () => (entry.opened = performance.now() - start));
  ws.on('error', () => (entry.failed = true));
  ws.on('unexpected-response', () => (entry.failed = true));
  await sleep(25);
  if (i % 50 === 49) await sleep(100);
}

// 等待全部收敛
await sleep(8000);
const opened = results.filter((r) => r.opened !== null).map((r) => r.opened);
const failed = results.filter((r) => r.failed);
opened.sort((a, b) => a - b);
const p = (q) => +opened[Math.min(opened.length - 1, Math.floor(opened.length * q))].toFixed(1);

console.log(`成功 ${opened.length}/${TOTAL}，失败 ${failed.length}`);
if (opened.length) {
  console.log(`建连耗时 ms: avg=${+(opened.reduce((a, b) => a + b, 0) / opened.length).toFixed(1)} p50=${p(0.5)} p95=${p(0.95)} max=${+opened[opened.length - 1].toFixed(1)}`);
}
console.log(`总耗时(发起+收敛): ${((performance.now() - t0) / 1000).toFixed(1)}s`);

// 保持 5s 后全部断开
await sleep(5000);
sockets.forEach((s) => s.close());
await sleep(1000);
process.exit(0);
