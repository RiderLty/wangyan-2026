/**
 * 6.3.1 接口响应时间测试（论文 6.3.1）
 * 目标：部署系统（默认 http://192.168.3.3:18080，经 nginx 反代）
 * 采样：登录 20 次（含 bcrypt 计算成本），其余各 50 次；输出 avg/p95/max
 * 运行：node scripts/perf/api-latency.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://192.168.3.3:18080';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function timed(fn) {
  const t0 = performance.now();
  const ok = await fn();
  return { ms: performance.now() - t0, ok };
}

async function main() {
  // 登录取 token（不计入采样）
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@wangyan.test', password: 'Demo12345678' }),
  }).then((r) => r.json());
  const token = loginRes.access_token;
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const notes = await fetch(`${BASE}/api/notes`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const noteId = notes[0].id;

  const samples = { login: [], list: [], detail: [], search: [], write: [] };

  for (let i = 0; i < 20; i++) {
    samples.login.push(
      await timed(() =>
        fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'demo@wangyan.test', password: 'Demo12345678' }),
        }).then((r) => r.ok),
      ),
    );
    await sleep(30);
  }

  for (let i = 0; i < 50; i++) {
    samples.list.push(await timed(() => fetch(`${BASE}/api/notes`, { headers: auth }).then((r) => r.ok)));
    samples.detail.push(await timed(() => fetch(`${BASE}/api/notes/${noteId}`, { headers: auth }).then((r) => r.ok)));
    samples.search.push(
      await timed(() => fetch(`${BASE}/api/notes?keyword=CRDT`, { headers: auth }).then((r) => r.ok)),
    );
  }

  for (let i = 0; i < 50; i++) {
    samples.write.push(
      await timed(async () => {
        const created = await fetch(`${BASE}/api/notes`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ title: `【压测】${Date.now()}-${i}` }),
        }).then((r) => r.json());
        const del = await fetch(`${BASE}/api/notes/${created.id}`, { method: 'DELETE', headers: auth });
        return del.ok;
      }),
    );
    await sleep(20);
  }

  const stats = {};
  for (const [name, arr] of Object.entries(samples)) {
    const okTimes = arr.filter((s) => s.ok).map((s) => s.ms);
    okTimes.sort((a, b) => a - b);
    const n = okTimes.length;
    stats[name] = {
      n,
      ok: n,
      avg: +(okTimes.reduce((a, b) => a + b, 0) / n).toFixed(1),
      p95: +okTimes[Math.floor(n * 0.95) - 1 < 0 ? 0 : Math.floor(n * 0.95)].toFixed(1),
      max: +okTimes[n - 1].toFixed(1),
    };
  }
  console.log('=== 接口响应时间（ms，经 nginx 反代，局域网） ===');
  console.log('接口        n   avg    p95    max');
  for (const [name, s] of Object.entries(stats)) {
    console.log(
      `${name.padEnd(10)} ${String(s.n).padEnd(3)} ${String(s.avg).padEnd(6)} ${String(s.p95).padEnd(6)} ${s.max}`,
    );
  }
  // 输出 JSON 便于写入文档
  console.log('\nJSON:', JSON.stringify(stats));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
