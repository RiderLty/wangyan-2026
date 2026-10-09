/**
 * AI 智能搜索弹窗 UI 复检（v2.0 M4，对本地 dev http://localhost:5173 执行）
 * 左栏"AI 智能搜索"按钮 → 弹窗输入语义查询 → 检索 → 混合/语义 Tag + RRF 分可见。
 * 截图：docs/v2/assets/5.10.4-ai-search.png
 * 前置：已完成重索引（POST /ai/search/reindex-all）
 * 用法：先 ppm dev，再 node scripts/screenshots/search-ui-check.mjs
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

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
try {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.evaluateOnNewDocument((t) => localStorage.setItem('wangyan_token', t), token);
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(1500); // 等列表渲染（无需选中笔记，智能搜索不依赖编辑器）
  // 左栏"AI 智能搜索"按钮
  const btn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('AI 智能搜索'));
    if (!b) throw new Error('找不到 AI 智能搜索按钮');
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(btn.x, btn.y);
  await page.waitForFunction(
    () => [...document.querySelectorAll('.ant-modal-title')].some((e) => e.textContent?.includes('AI 智能搜索')),
    { timeout: 8000 },
  );
  // 输入语义查询（与正文无字面重叠）并检索
  await page.type('.ant-modal input', '怎么防止容器把宿主机资源吃光');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelectorAll('.ant-modal .ant-tag').length >= 2,
    { timeout: 60000 },
  );
  await sleep(800);
  await page.screenshot({ path: `${ASSETS}5.10.4-ai-search.png` });
  console.log('✅ 智能搜索弹窗截图: docs/v2/assets/5.10.4-ai-search.png');
  process.exit(0);
} finally {
  await browser.close();
}
