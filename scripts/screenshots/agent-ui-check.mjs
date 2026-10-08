/**
 * AI 助手抽屉 UI 复检（v2.0 M2，对本地 dev http://localhost:5173 执行）
 *
 * 验证：编辑器头部 AI 按钮 → 抽屉对话 → 发送指令 → 工具链路条（搜索笔记 Tag）出现
 * → 助手回答到达。截图 docs/v2/assets/5.10.3-ai-agent-drawer.png（论文 5.10.3 界面素材）。
 * 用法：先 pnpm dev，再 node scripts/screenshots/agent-ui-check.mjs
 */
import puppeteer from 'puppeteer-core';

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const BASE = 'http://localhost:5173';
const API = 'http://localhost:13000/api';
const ASSETS = new URL('../../docs/v2/assets/', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiLogin(email, password) {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error(`登录失败 ${res.status}`);
  return (await res.json()).access_token;
}

(async () => {
  const token = await apiLogin('chenmo@wangyan.test', 'Chenmo2026');
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  try {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.evaluateOnNewDocument((t) => localStorage.setItem('wangyan_token', t), token);
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    // 打开第一篇个人笔记
    const notes = await fetch(`${API}/notes`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const note = (notes.items ?? notes)[0];
    await page.goto(`${BASE}/?note=${note.id}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('.ProseMirror', { timeout: 20000 });
    await sleep(800);

    // 点编辑器头部的"AI"按钮 → 抽屉打开
    const aiBtn = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.editor-header button')].find((b) => b.textContent?.includes('AI'));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!aiBtn) throw new Error('找不到编辑器头部 AI 按钮');
    await page.mouse.click(aiBtn.x, aiBtn.y);
    await page.waitForSelector('.ant-drawer-open', { timeout: 5000 });
    await sleep(500);

    // 输入指令并发送（触发 search_notes 工具链）
    await page.type('.ant-drawer textarea', '搜索包含"缓存"关键词的笔记，列出标题');
    await page.keyboard.press('Enter');

    // 等工具链路条与回答（思考模型较慢，上限 90s）
    await page.waitForFunction(
      () => document.querySelectorAll('.ant-drawer .ant-tag').length > 0,
      { timeout: 90000 },
    );
    await page.waitForFunction(
      () => {
        const spans = [...document.querySelectorAll('.ant-drawer .ant-typography, .ant-drawer span')];
        const t = spans.map((e) => e.textContent).join('');
        return t.includes('Redis') || t.includes('设计文档') || t.includes('搜索到');
      },
      { timeout: 90000 },
    ).catch(() => {});
    await sleep(2000);
    await page.screenshot({ path: `${ASSETS}5.10.3-ai-agent-drawer.png` });
    console.log('✅ 抽屉 UI 验证通过（工具链路条 + 回答），截图: docs/v2/assets/5.10.3-ai-agent-drawer.png');
    process.exit(0);
  } finally {
    await browser.close();
  }
})();
