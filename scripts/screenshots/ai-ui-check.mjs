/**
 * AI 编辑器 UI 复检脚本（v2.0 M1，对本地 dev http://localhost:5173 执行）
 *
 * 素材存放（用户 2026-10-08 指示）：论文 Word 已定稿，v2.0 截图一律进 docs/v2/assets/
 * （不进 docs/assets/，不动 docs/thesis/），说明与索引在 docs/v2/v2-materials.md
 *
 * 验证内容（ai-tests.md 的界面级用例）：
 * - AI-07  续写：真实点击工具栏 AI 菜单 → AI 续写，流式写入后编辑器文本增长
 * - AI-15  协作端可见：双 context（chenmo=执行端 / suqing=观察端）打开同一团队笔记，
 *          A 端触发续写，断言 B 端文本同步增长相同量——证明 AI 写入走 Yjs 协作链路
 * - AI-17  流式期间出现"停止"按钮（本地锁定的可见信号）
 *
 * 产出：docs/v2/assets/5.10.2-ai-menu.png（AI 菜单展开）、5.10.2-ai-collab.png（写入完成）
 * 用法：先 pnpm dev（本地 5173/13000），再 node scripts/screenshots/ai-ui-check.mjs
 */
import puppeteer from 'puppeteer-core';

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const BASE = 'http://localhost:5173';
const API = 'http://localhost:13000/api';
const ASSETS = new URL('../../docs/v2/assets/', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiLogin(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`登录失败 ${res.status}: ${email}`);
  return (await res.json()).access_token;
}

async function newPage(browser, token) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.evaluateOnNewDocument((t) => localStorage.setItem('wangyan_token', t), token);
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`  [console.error] ${m.text().slice(0, 200)}`);
  });
  return page;
}

/** 打开笔记并等编辑器就绪；返回编辑器当前文本 */
async function openNote(page, noteId) {
  await page.goto(`${BASE}/?note=${noteId}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.ProseMirror', { timeout: 20000 });
  await sleep(1000); // 等协作连接与播种
  return page.evaluate(() => document.querySelector('.ProseMirror').textContent.length);
}

/** 把光标放到最后一段末尾（ProseMirror 只认真实鼠标事件；先滚入视口） */
async function caretToEnd(page) {
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.ProseMirror > *')].at(-1);
    el?.scrollIntoView({ block: 'center' });
  });
  await sleep(400); // 等滚动与布局稳定
  const rect = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('.ProseMirror > *')];
    const el = blocks.at(-1);
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.min(r.width - 10, 300), y: r.top + r.height / 2, len: el.textContent.length };
  });
  if (rect.len > 0) await page.mouse.click(rect.x, rect.y); // 点段中再按 End 到行尾
  else await page.mouse.click(rect.x, rect.y);
  await page.keyboard.press('End');
  await sleep(200);
}

/** 点击含指定文本的按钮（React 组件用 DOM click() 可触发） */
async function clickButtonByText(page, selector, text) {
  const ok = await page.evaluate(
    (sel, t) => {
      const btn = [...document.querySelectorAll(sel)].find((b) => b.textContent?.includes(t));
      if (!btn) return false;
      btn.click();
      return true;
    },
    selector,
    text,
  );
  if (!ok) throw new Error(`找不到按钮: ${selector} "${text}"`);
}

/**
 * 用真实鼠标点击含指定文本的元素（antd Dropdown 的 Menu 对 DOM .click() 不响应，
 * 与 ProseMirror 同理必须派发真实事件序列；返回是否找到）
 */
async function realClickByText(page, selector, text) {
  const rect = await page.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll(sel)].find((b) => b.textContent?.includes(t));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    selector,
    text,
  );
  if (!rect) return false;
  await page.mouse.click(rect.x, rect.y);
  return true;
}

async function editorLength(page) {
  return page.evaluate(() => document.querySelector('.ProseMirror').textContent.length);
}

(async () => {
  const tokenA = await apiLogin('chenmo@wangyan.test', 'Chenmo2026');
  const tokenB = await apiLogin('suqing@wangyan.test', 'Suqing2026');
  // 每次运行新建干净的临时团队笔记（team_edit 双人可编辑），测完软删进回收站——
  // 保证用例可重复、截图不含历史残留（此前演示笔记曾被中止的半截输出污染）
  const createRes = await fetch(`${API}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      team_id: (await fetch(`${API}/teams`, { headers: { Authorization: `Bearer ${tokenA}` } }).then((r) => r.json()))[0].id,
      visibility: 'team_edit',
      title: `AI 协作验证 ${new Date().toLocaleTimeString('zh-CN')}`,
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '容器化部署要点' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '本篇笔记用于验证 AI 协作写入。Docker 部署的优势在于环境一致性，' }] },
        ],
      },
    }),
  }).then((r) => r.json());
  const note = createRes;
  console.log(`临时笔记: ${note.title} (${note.id})`);

  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  try {
    const pageA = await newPage(browser, tokenA);
    const pageB = await newPage(browser, tokenB);
    const baseA = await openNote(pageA, note.id);
    const baseB = await openNote(pageB, note.id);
    // 等待 B 端看到 A 在线（协作就绪标志）
    await pageB.waitForFunction(
      () => document.querySelector('.collab-status')?.textContent?.includes('2'),
      { timeout: 20000 },
    );
    console.log(`协作就绪（2 人在线）。基线: A=${baseA} 字, B=${baseB} 字`);

    // A 端：光标到文末 → 打开 AI 菜单 → 截图 → 真实鼠标点击续写项
    await caretToEnd(pageA);
    await clickButtonByText(pageA, '.editor-toolbar button', 'AI');
    await pageA.waitForSelector('.ant-dropdown-menu-item', { timeout: 5000 }).catch(() => {});
    await sleep(400);
    await pageA.screenshot({ path: `${ASSETS}5.10.2-ai-menu.png` });
    console.log('截图完成: 5.10.2-ai-menu.png');
    const clicked = await realClickByText(pageA, '.ant-dropdown-menu-item', 'AI 续写');
    if (!clicked) throw new Error('菜单项「AI 续写」不存在（菜单未打开？）');

    // 高频轮询：300ms 采样（长度/停止按钮/toast/页面错误），直到流结束或 90s 超时
    const trace = await pageA.evaluate(
      () =>
        new Promise((resolve) => {
          const samples = [];
          const errors = [];
          window.addEventListener('pageerror', (e) => errors.push(`pageerror:${e.message.slice(0, 120)}`));
          const t0 = Date.now();
          const timer = setInterval(() => {
            const len = document.querySelector('.ProseMirror')?.textContent.length ?? -1;
            const stop = [...document.querySelectorAll('.editor-toolbar button')].some((b) => b.textContent?.includes('停止'));
            const toast = [...document.querySelectorAll('.ant-message-notice-content')].map((e) => e.textContent).join('|');
            samples.push(`${Date.now() - t0}ms len=${len} ${stop ? '流中' : '停'}${toast ? ` toast:${toast.slice(0, 80)}` : ''}`);
            if ((!stop && Date.now() - t0 > 3000) || Date.now() - t0 > 90000) {
              clearInterval(timer);
              resolve({ samples, errors });
            }
          }, 300);
        }),
    );
    console.log('轮询轨迹:');
    for (const s of trace.samples) console.log('  ', s);
    if (trace.errors.length) console.log('页面错误:', trace.errors);
    // 诊断：打印 A 端文本尾部与可能的 toast 报错
    console.log('A 端文本尾部:', JSON.stringify(await pageA.evaluate(() => document.querySelector('.ProseMirror').textContent.slice(-80))));
    console.log('页面 toast:', await pageA.evaluate(() => [...document.querySelectorAll('.ant-message-notice-content')].map((e) => e.textContent)));
    const endA = await editorLength(pageA);
    await sleep(2000); // 等 CRDT 增量同步到 B
    const endB = await editorLength(pageB);
    const gainA = endA - baseA;
    const gainB = endB - baseB;
    console.log(`A 端增长 ${gainA} 字，B 端增长 ${gainB} 字`);
    const pass = gainA > 20 && Math.abs(gainA - gainB) <= 2;
    console.log(pass ? '✅ AI-07/AI-15 通过：AI 写入经 Yjs 同步到协作端（字数一致）' : '❌ 未通过');
    await pageB.screenshot({ path: `${ASSETS}5.10.2-ai-collab.png` });
    console.log('截图完成: 5.10.2-ai-collab.png（B 端视角，含 A 的光标与 AI 写入内容）');
    // 收尾：临时笔记软删进回收站（保持演示库整洁）
    await fetch(`${API}/notes/${note.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokenA}` } });
    console.log('临时笔记已软删');
    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
  }
})();
