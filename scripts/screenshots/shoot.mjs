/**
 * 论文界面截图批产脚本（对已部署系统执行，真实运行界面）
 * 前置：node scripts/screenshots/setup-data.mjs 已产出 state.json
 * 用法：node scripts/screenshots/shoot.mjs [--only 5.4]   （前缀过滤，重拍部分截图）
 *
 * 产出：docs/assets/<小节号>-<名称>.png（1440x900 @2x）
 * 多用户场景用两个 browser context 注入不同 token；访客场景不注入 token。
 * 交互注意：ProseMirror 不响应合成 MouseEvent，光标定位一律用 page.mouse 真实点击。
 */
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const ASSETS = new URL('../../docs/assets/', import.meta.url).pathname;
const state = JSON.parse(readFileSync(new URL('./state.json', import.meta.url), 'utf8'));
const BASE = state.base;
const T = state.tokens;

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
// 前缀匹配：--only 5.3.1 命中 '5.3.1-note-edit'；--only 5.4 命中该节全部截图
const want = (...names) => !only || names.some((n) => n.startsWith(only));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

async function newPage(ctx, token) {
  const page = await ctx.newPage();
  if (token) {
    await page.evaluateOnNewDocument((t) => localStorage.setItem('wangyan_token', t), token);
  }
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  return page;
}

async function shot(page, name) {
  if (!want(name)) return;
  await page.screenshot({ path: `${ASSETS}${name}.png` });
  results.push(`${name} ✅`);
  console.log(`截图完成: ${name}`);
}

/** 打开笔记并等编辑器与协作就绪 */
async function openNote(page, noteId) {
  await page.goto(`${BASE}/?note=${noteId}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.ProseMirror', { timeout: 20000 });
  await sleep(800); // 等协作连接与内容播种
}

/** 等待本页看到 n 人在线 */
async function waitOnline(page, n) {
  await page.waitForFunction(
    (x) => document.querySelector('.collab-status')?.textContent?.includes(String(x)),
    { timeout: 15000 },
    n,
  );
}

/** 点击包含指定文本的按钮 */
async function clickButtonByText(page, selector, text) {
  const ok = await page.evaluate(
    (sel, t) => {
      const btn = [...document.querySelectorAll(sel)].find((b) => b.textContent.includes(t));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    },
    selector,
    text,
  );
  if (!ok) throw new Error(`找不到按钮: ${text}`);
}

async function clickHeaderIcon(page, iconClass) {
  const ok = await page.evaluate((cls) => {
    const icon = document.querySelector(`.editor-header ${cls}`);
    const btn = icon?.closest('button');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, iconClass);
  if (!ok) throw new Error(`找不到头部图标按钮: ${iconClass}`);
}

/**
 * 用真实鼠标点击把光标放进指定序号段落的文本内。
 * pos: 'start' | 'end' | 'middle'（缺省 middle）；段落序号 0 起，-1 为最后一段。
 * 返回后 PM 焦点即在该段落内（ProseMirror 不响应合成事件，必须真实点击）。
 */
async function clickParagraph(page, index = -1, pos = 'middle') {
  const rect = await page.evaluate((idx) => {
    const ps = [...document.querySelectorAll('.ProseMirror p')].filter((p) => p.offsetParent !== null);
    const p = ps.at(idx);
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, height: r.height };
  }, index);
  if (!rect) throw new Error('找不到目标段落');
  const x = pos === 'start' ? rect.left + 3 : pos === 'end' ? rect.right - 4 : (rect.left + rect.right) / 2;
  await page.mouse.click(x, rect.top + rect.height / 2);
  await sleep(150);
  if (pos === 'end') await page.keyboard.press('End'); // 确保到段内行尾
  if (pos === 'start') await page.keyboard.press('Home');
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    args: ['--disable-gpu'],
  });

  /* ---------- 5.2 认证 ---------- */
  if (want('5.2.1', '5.2.2')) {
    const page = await newPage(browser.defaultBrowserContext());
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle2' });
    await sleep(500);
    await shot(page, '5.2.1-register');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await sleep(500);
    await shot(page, '5.2.2-login');
    await page.close();
  }

  /* ---------- 5.2.4 / 5.3.3 工作台总览 ---------- */
  if (want('5.2.4', '5.3.3')) {
    const ctx = await browser.createBrowserContext();
    const page = await newPage(ctx, T['陈晓墨']);
    await openNote(page, state.noteRedis);
    await shot(page, '5.2.4-home');
    await shot(page, '5.3.3-folders');
    await ctx.close();
  }

  /* ---------- 5.3.1 长文滚动：标题栏与工具栏冻结 ---------- */
  if (want('5.3.1')) {
    const ctx = await browser.createBrowserContext();
    const page = await newPage(ctx, T['陈晓墨']);
    await openNote(page, state.noteDesign);
    await page.evaluate(() => document.querySelector('.editor-content').scrollTo({ top: 460 }));
    await sleep(500);
    await shot(page, '5.3.1-note-edit');
    await ctx.close();
  }

  /* ---------- 5.3.2 Markdown 语法即时渲染 ---------- */
  if (want('5.3.2')) {
    const ctx = await browser.createBrowserContext();
    const page = await newPage(ctx, T['陈晓墨']);
    await openNote(page, state.noteRedis);
    // 文末另起一段输入 "## "，input rule 即时转换为二级标题
    await page.evaluate(() => document.querySelector('.editor-content').scrollTo({ top: 99999 }));
    await clickParagraph(page, -1, 'end');
    await page.keyboard.press('Enter');
    await page.keyboard.type('## 标题语法即时渲染 ', { delay: 40 });
    await sleep(600);
    await shot(page, '5.3.2-realtime-preview');
    await ctx.close();
  }

  /* ---------- 5.3.4 搜索 ---------- */
  if (want('5.3.4')) {
    const ctx = await browser.createBrowserContext();
    const page = await newPage(ctx, T['陈晓墨']);
    await page.goto(`${BASE}/?q=${encodeURIComponent('缓存')}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.note-list-panel', { timeout: 20000 });
    await sleep(1200);
    await shot(page, '5.3.4-search');
    await ctx.close();
  }

  /* ---------- 5.3.5 专注模式 ---------- */
  if (want('5.3.5')) {
    const ctx = await browser.createBrowserContext();
    const page = await newPage(ctx, T['陈晓墨']);
    await openNote(page, state.noteDesign);
    await clickHeaderIcon(page, '.anticon-expand');
    await sleep(500);
    await shot(page, '5.3.5-focus-mode');
    await ctx.close();
  }

  /* ---------- 5.4 实时协作（双用户，团队可编辑笔记） ---------- */
  if (want('5.4.2', '5.4.3', '5.4.4')) {
    const ctxA = await browser.createBrowserContext();
    const ctxB = await browser.createBrowserContext();
    const pageA = await newPage(ctxA, T['陈晓墨']);
    const pageB = await newPage(ctxB, T['苏婉晴']);
    await openNote(pageA, state.tnDeploy);
    await openNote(pageB, state.tnDeploy);
    await waitOnline(pageB, 2);

    await shot(pageB, '5.4.2-yjs-integration');

    // 5.4.3 多光标：A 真实点击第一段中部并输入，B 视角出现 A 的行内光标与姓名标签
    if (want('5.4.3')) {
      await clickParagraph(pageA, 0, 'middle');
      await pageA.keyboard.type('（甲端正在编辑）', { delay: 60 });
      await sleep(1200);
      await shot(pageB, '5.4.3-cursor-sync');
    }

    // 5.4.4 冲突合并：A 文首、B 段内行尾并发输入，两端最终一致（双方光标保持行内）
    if (want('5.4.4')) {
      await clickParagraph(pageA, 0, 'start');
      await pageA.keyboard.type('【甲：文首并发编辑】', { delay: 40 });
      await clickParagraph(pageB, -1, 'end');
      await pageB.keyboard.type('【乙：文末并发编辑】', { delay: 40 });
      await sleep(1500);
      await shot(pageA, '5.4.4-crdt-merge');
    }

    await ctxA.close();
    await ctxB.close();
  }

  /* ---------- 5.5 团队协作 ---------- */
  if (want('5.5.1', '5.5.2', '5.5.3', '5.5.4')) {
    const ctx = await browser.createBrowserContext();
    const page = await newPage(ctx, T['陈晓墨']);
    await openNote(page, state.tnDeploy);

    if (want('5.5.1', '5.5.2')) {
      await page.evaluate(() => document.querySelector('button[title="成员与邀请"]')?.click());
      await page.waitForSelector('.ant-modal-content', { timeout: 10000 });
      await sleep(600);
      await shot(page, '5.5.1-team-manage');
      await shot(page, '5.5.2-invitation'); // 弹窗同屏含邀请记录（王远 pending）
      await page.keyboard.press('Escape');
      await sleep(400);
    }

    if (want('5.5.3')) {
      // 可见性下拉展开
      await page.waitForSelector('.editor-header .ant-select-selector', { timeout: 10000 });
      await page.click('.editor-header .ant-select-selector');
      await page.waitForSelector('.ant-select-dropdown', { timeout: 10000 });
      await sleep(400);
      await shot(page, '5.5.3-team-note-visibility');
    }
    await ctx.close();

    if (want('5.5.4')) {
      // 只读成员视角（苏婉晴 看团队只读笔记）
      const ctx2 = await browser.createBrowserContext();
      const page2 = await newPage(ctx2, T['苏婉晴']);
      await page2.goto(`${BASE}/?note=${state.tnMinutes}`, { waitUntil: 'networkidle2' });
      await page2.waitForSelector('.ProseMirror', { timeout: 20000 });
      await sleep(800);
      await shot(page2, '5.5.4-team-readonly');
      await ctx2.close();
    }
  }

  /* ---------- 5.6 分享 ---------- */
  if (want('5.6.1', '5.6.2')) {
    if (want('5.6.1')) {
      const ctx = await browser.createBrowserContext();
      const page = await newPage(ctx, T['陈晓墨']);
      await openNote(page, state.noteRedis);
      await clickButtonByText(page, '.editor-header button', '分享');
      await page.waitForSelector('.ant-modal-content', { timeout: 10000 });
      await sleep(600);
      await shot(page, '5.6.1-share-modal');
      await ctx.close();
    }

    if (want('5.6.2')) {
      // 访客（edit 链接）与登录用户实时协作
      const ctxG = await browser.createBrowserContext();
      const ctxO = await browser.createBrowserContext();
      const pageG = await newPage(ctxG); // 不注入 token = 访客
      const pageO = await newPage(ctxO, T['陈晓墨']);
      await pageG.goto(`${BASE}/s/${state.shareEditToken}`, { waitUntil: 'networkidle2' });
      await pageG.waitForSelector('.ProseMirror', { timeout: 20000 });
      await openNote(pageO, state.noteDesign);
      await waitOnline(pageO, 2);
      await clickParagraph(pageG, -1, 'end');
      await pageG.keyboard.type('（访客凭可编辑链接参与协作）', { delay: 40 });
      await sleep(1200);
      await shot(pageO, '5.6.2-guest-collab');
      await ctxG.close();
      await ctxO.close();
    }
  }

  /* ---------- 5.7 版本与回收站 ---------- */
  if (want('5.7.1', '5.7.3')) {
    const ctx = await browser.createBrowserContext();
    const page = await newPage(ctx, T['陈晓墨']);
    await openNote(page, state.noteDesign);
    if (want('5.7.1')) {
      await clickHeaderIcon(page, '.anticon-history');
      await page.waitForSelector('.ant-drawer-content', { timeout: 10000 });
      await sleep(1000); // 等版本列表与预览渲染（含图片/表格快照）
      await shot(page, '5.7.1-version-drawer');
      await page.keyboard.press('Escape');
      await sleep(400);
    }
    if (want('5.7.3')) {
      await page.evaluate(() => document.querySelector('button[title="打开回收站"]')?.click());
      await page.waitForSelector('.ant-modal-content', { timeout: 10000 });
      await sleep(600);
      await shot(page, '5.7.3-recycle-bin');
    }
    await ctx.close();
  }

  /* ---------- 5.8 导出菜单 ---------- */
  if (want('5.8.3')) {
    const ctx = await browser.createBrowserContext();
    const page = await newPage(ctx, T['陈晓墨']);
    await openNote(page, state.noteDesign);
    await clickButtonByText(page, '.editor-header button', '导出');
    await page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden)', { timeout: 10000 });
    await sleep(400);
    await shot(page, '5.8.3-export-menu');
    await ctx.close();
  }

  /* ---------- 5.9 NAS 部署页 ---------- */
  if (want('5.9.3')) {
    const page = await newPage(browser.defaultBrowserContext());
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await sleep(500);
    await shot(page, '5.9.3-nas-deployed-login');
    await page.close();
  }

  await browser.close();
  console.log('\n==== 汇总 ====');
  console.log(results.join('\n') || '（无匹配截图）');
}

main().catch((e) => {
  console.error('截图失败:', e);
  console.error('\n已完成的截图:\n' + results.join('\n'));
  process.exit(1);
});
