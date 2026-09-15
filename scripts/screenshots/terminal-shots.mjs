/**
 * 数据库 / 后端终端截图（论文 4.3、5.4、5.9、6.3 素材）
 * 输出为"macOS 终端风格"的渲染图，内容全部来自真实命令输出：
 * - psql 对 NAS 真库执行（\dt / \d+ notes / 视图查询）
 * - ssh 到 NAS 执行 docker ps / docker logs / 健康检查
 * - 本机运行 scripts/perf/api-latency.mjs
 *
 * ⚠️ 诚实原则：终端窗口是样式渲染，命令与输出均为真实执行结果，未修改任何数据。
 * 用法：node scripts/screenshots/terminal-shots.mjs [--only db]（db / ops / perf）
 */
import { execSync, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const ASSETS = new URL('../../docs/assets/', import.meta.url).pathname;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const want = (n) => !only || n.startsWith(only);

// ---------- 环境读取 ----------
const env = Object.fromEntries(
  readFileSync(new URL('../../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const PSQL = '/opt/homebrew/opt/libpq/bin/psql';
const pg = (sql) =>
  execFileSync(PSQL, ['-h', env.POSTGRES_HOST, '-p', env.POSTGRES_PORT ?? '15432', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB, '-c', sql], {
    env: { ...process.env, PGPASSWORD: env.POSTGRES_PASSWORD },
  }).toString();
const ssh = (cmd) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'root@192.168.3.3', cmd]).toString();

// ---------- 终端渲染 ----------
function terminalHtml(title, lines) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: transparent; }
    .win { width: 980px; border-radius: 10px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,.35);
           font-family: "SF Mono", Menlo, monospace; }
    .bar { height: 38px; background: linear-gradient(#ececec, #e0e0e0); display: flex; align-items: center;
           padding: 0 12px; gap: 8px; border-bottom: 1px solid #cfcfcf; position: relative; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .bar .t { position: absolute; left: 0; right: 0; text-align: center; color: #585858;
              font: 500 13px -apple-system, sans-serif; }
    .body { background: #1e1e1ecc; backdrop-filter: blur(2px); padding: 14px 18px 18px; }
    pre { margin: 0; color: #e8e8e8; font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; }
    .cmd { color: #7ec8a9; font-weight: 600; }
    .cmd::before { content: '➜  ~ '; color: #8a8a8a; font-weight: 400; }
  </style></head><body><div class="win">
    <div class="bar">
      <span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span>
      <span class="dot" style="background:#28c840"></span><span class="t">${esc(title)}</span>
    </div>
    <div class="body"><pre>${lines.map(([c, o]) => `<span class="cmd">${esc(c)}</span>\n${esc(o)}`).join('\n')}</pre></div>
  </div></body></html>`;
}

async function shootTerminal(browser, file, title, lines) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1020, height: 1400, deviceScaleFactor: 2 });
  await page.setContent(terminalHtml(title, lines));
  await page.evaluate(() => {
    const win = document.querySelector('.win');
    document.body.style.width = '1020px';
    document.body.style.height = win.getBoundingClientRect().height + 30 + 'px';
  });
  const h = await page.evaluate(() => document.body.getBoundingClientRect().height);
  await page.setViewport({ width: 1020, height: Math.ceil(h), deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 150));
  await page.screenshot({ path: `${ASSETS}${file}.png`, omitBackground: true });
  console.log('截图完成:', file);
  await page.close();
}

// ---------- 命令集 ----------
async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    defaultViewport: { width: 1020, height: 800, deviceScaleFactor: 2 },
  });

  if (want('4.3-db')) {
    await shootTerminal(browser, '4.3-db-tables', 'psql — 数据表清单（论文 4.3）', [
      [`psql -h 192.168.3.3 -p 15432 -U postgres -d wangyan -c '\dt'`, pg('\\dt')],
    ]);
    await shootTerminal(browser, '4.3-db-notes-ddl', 'psql — notes 表结构（论文 4.3.5）', [
      [`psql -h 192.168.3.3 -p 15432 -U postgres -d wangyan -c '\d+ notes'`, pg('\\d+ notes')],
    ]);
    await shootTerminal(browser, '4.4-yjs-frames', 'psql — 协作增量帧表（论文 4.4.2 增量日志）', [
      [`psql -h 192.168.3.3 -p 15432 -U postgres -d wangyan -c 'SELECT id, note_id, length(update) AS bytes, created_at FROM yjs_updates ORDER BY id DESC LIMIT 6;'`, pg('SELECT id, note_id, length(update) AS bytes, created_at FROM yjs_updates ORDER BY id DESC LIMIT 6;')],
    ]);
  }

  if (want('5.9')) {
    await shootTerminal(browser, '5.9-docker-ps', 'ssh nas — 容器运行状态（论文 5.9.3）', [
      [`ssh root@192.168.3.3 "docker ps --format table"`, ssh('docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}" | grep -E "wangyan|NAMES"')],
      [`curl http://192.168.3.3:18080/api/health`, execSync('curl -s http://192.168.3.3:18080/api/health && echo').toString()],
    ]);
  }

  if (want('5.4-server-logs')) {
    const logs = ssh('docker logs wangyan-server 2>&1 | grep "\\[协作\\]" | tail -12').toString();
    await shootTerminal(browser, '5.4-server-logs', 'ssh nas — 实时协作服务端日志（论文 5.4.1 持久化）', [
      [`ssh root@192.168.3.3 "docker logs wangyan-server | grep '\\[协作\\]' | tail -12"`, logs],
    ]);
  }

  if (want('6.3-perf')) {
    const out = execSync('node scripts/perf/api-latency.mjs 2>&1', { timeout: 120000 }).toString();
    await shootTerminal(browser, '6.3-perf-api', '性能测试脚本 — 接口响应时间（论文 6.3.1）', [
      [`node scripts/perf/api-latency.mjs`, out],
    ]);
  }

  await browser.close();
  console.log('全部完成');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
