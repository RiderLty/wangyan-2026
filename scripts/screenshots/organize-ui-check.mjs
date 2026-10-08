/**
 * AI 整理弹窗 UI 复检（v2.0 M3，对本地 dev http://localhost:5173 执行）
 * 编辑器头部 AI → 抽屉 → 整理本笔记 → 弹窗（摘要卡/标签建议/批量整理）。
 * 截图：docs/v2/assets/5.10.4-ai-organize.png
 * 用法：先 pnpm dev，再 node scripts/screenshots/organize-ui-check.mjs
 */
import puppeteer from 'puppeteer-core';

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ASSETS = new URL('../../docs/v2/assets/', import.meta.url).pathname;

const token = await (async () => {
  const r = await fetch('http://localhost:13000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'chenmo@wangyan.test', password: 'Chenmo2026' }),
  });
  return (await r.json()).access_token;
})();
const notes = await fetch('http://localhost:13000/api/notes', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
const note = (notes.items ?? notes)[0];

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
try {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.evaluateOnNewDocument((t) => localStorage.setItem('wangyan_token', t), token);
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto(`http://localhost:5173/?note=${note.id}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.ProseMirror', { timeout: 20000 });
  await sleep(800);
  const aiBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.editor-header button')].find((x) => x.textContent?.includes('AI'));
    if (!b) throw new Error('找不到编辑器头部 AI 按钮');
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(aiBtn.x, aiBtn.y);
  await page.waitForSelector('.ant-drawer-open', { timeout: 5000 });
  await sleep(1200); // 等历史会话恢复
  const orgBtn = await page.evaluate(() => {
    const b = document.querySelector('.ant-drawer .ant-drawer-extra button');
    if (!b) throw new Error('找不到抽屉"整理本笔记"按钮');
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(orgBtn.x, orgBtn.y);
  await page.waitForFunction(
    () => [...document.querySelectorAll('.ant-modal-title')].some((e) => e.textContent?.includes('AI 整理')),
    { timeout: 8000 },
  );
  await sleep(1000);
  await page.screenshot({ path: `${ASSETS}5.10.4-ai-organize.png` });
  console.log('✅ 整理弹窗截图: docs/v2/assets/5.10.4-ai-organize.png');
  process.exit(0);
} finally {
  await browser.close();
}
