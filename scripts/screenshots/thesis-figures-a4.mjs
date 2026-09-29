/**
 * A4 版式三张示意图（图3-1 用例图 / 图4-1 架构图 / 图4-2 功能结构图）
 * 手工 SVG 精确布局：竖向构图，宽高比适配 A4 正文宽度（15cm），覆盖论文插图文件夹里的 mermaid 版。
 * 图4-7 时序图仍由 thesis-figures.mjs 生成（比例已合适）。
 * 用法：node scripts/screenshots/thesis-figures-a4.mjs
 */
import puppeteer from 'puppeteer-core';

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const OUT = 'docs/thesis/论文插图/';

const wrap = (w, h, inner) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #fff; }
  text { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>
</body></html>`;

const marker = `<defs><marker id="ar" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
  <path d="M0,0 L10,4 L0,8 z" fill="#555"/></marker></defs>`;

const T = (x, y, s, size = 14, fill = '#333', anchor = 'middle', weight = 'normal') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${s}</text>`;

const oval = (cx, cy, label, rx = 92) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="23" fill="#f5f9ff" stroke="#4a76a8" stroke-width="1.5"/>` +
  T(cx, cy + 5, label, 14, '#1a3a5c');

/* ---------- 图 4-1 系统总体架构图（竖向四层，1160×1210） ---------- */
const arch = (() => {
  let s = marker;
  const layer = (y, h, fill, stroke, title) =>
    `<rect x="30" y="${y}" width="1100" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2"/>` +
    T(52, y + 28, title, 16, stroke, 'start', '600');
  s += layer(30, 130, '#f0f7ff', '#1677ff', '表现层');
  s += T(580, 98, '浏览器 · React 18 单页应用', 20, '#222', 'middle', '600');
  s += T(580, 130, 'Ant Design · Tiptap 编辑器 · Yjs 客户端', 15, '#666');
  s += layer(255, 105, '#fffbf0', '#faad14', '网关层');
  s += T(580, 318, 'Nginx —— 托管前端静态资源 · 反向代理 /api 与 /ws', 18, '#222', 'middle', '600');
  // 表现层 → 网关层 三条通路
  const arrow = (x, label, dashed = false, both = false) =>
    `<line x1="${x}" y1="160" x2="${x}" y2="250" stroke="#555" stroke-width="1.5" ${dashed ? 'stroke-dasharray="6,4"' : ''} marker-end="url(#ar)"${both ? ' marker-start="url(#ar)"' : ''}/>` +
    T(x + 10, 205, label, 13.5, '#555', 'start');
  s += arrow(300, 'HTTPS 静态资源');
  s += arrow(580, 'REST /api');
  s += arrow(850, 'WebSocket /ws（握手鉴权）', true, true);
  // 网关层 → 应用层
  s += `<line x1="580" y1="360" x2="580" y2="432" stroke="#555" stroke-width="1.5" marker-end="url(#ar)"/>`;
  // 应用层
  s += layer(437, 330, '#f6ffed', '#52c41a', '应用层 —— NestJS 模块化单体（REST 与 WebSocket 共进程）');
  const mod = (x, y, name) =>
    `<rect x="${x}" y="${y}" width="196" height="62" rx="6" fill="#fff" stroke="#52c41a" stroke-width="1.5"/>` +
    T(x + 98, y + 37, name, 16, '#222');
  ['auth', 'users', 'notes', 'teams', 'share'].forEach((m, i) => { s += mod(54 + i * 214, 505, m); });
  ['versions', 'recycle-bin', 'realtime', 'export'].forEach((m, i) => { s += mod(161 + i * 214, 610, m); });
  // 应用层 → 数据层
  s += `<line x1="450" y1="767" x2="450" y2="938" stroke="#555" stroke-width="1.5" marker-end="url(#ar)"/>` +
       T(462, 855, 'SQL（TypeORM）', 13.5, '#555', 'start');
  s += `<line x1="710" y1="767" x2="710" y2="938" stroke="#555" stroke-width="1.5" marker-end="url(#ar)"/>` +
       T(722, 855, '键值读写', 13.5, '#555', 'start');
  // 数据层
  s += layer(943, 235, '#f9f0ff', '#722ed1', '数据层');
  const cyl = (cx, lines) => {
    const top = 1005, bodyH = 130, rx = 145, ry = 20;
    let c = `<path d="M ${cx - rx} ${top} A ${rx} ${ry} 0 0 0 ${cx + rx} ${top} L ${cx + rx} ${top + bodyH} A ${rx} ${ry} 0 0 1 ${cx - rx} ${top + bodyH} Z" fill="#fff" stroke="#722ed1" stroke-width="1.5"/>`;
    c += `<ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="#efe3fb" stroke="#722ed1" stroke-width="1.5"/>`;
    lines.forEach((t, i) => { c += T(cx, top + 42 + i * 27, t, i === 0 ? 17 : 14.5, i === 0 ? '#222' : '#555', 'middle', i === 0 ? '600' : 'normal'); });
    return c;
  };
  s += cyl(400, ['PostgreSQL 16', 'notes.content → JSONB 快照', 'yjs_updates → bytea 增量', '业务数据 12 张基表']);
  s += cyl(820, ['Redis 7', 'JWT 登出黑名单', '分享链接元数据缓存', '定时任务支撑']);
  return wrap(1160, 1200, s);
})();

/* ---------- 图 4-2 系统功能结构图（两级树 + 竖排叶子，1160×645） ---------- */
const func = (() => {
  let s = marker;
  const mods = [
    { t: '用户管理', items: ['注册', '登录与登出', '个人信息'], c: '#e6f4ff', b: '#1677ff' },
    { t: '个人笔记管理', items: ['创建·编辑·自动保存', 'Markdown 即时渲染', '文件夹与标签', '关键词搜索'], c: '#f6ffed', b: '#52c41a' },
    { t: '团队协作管理', items: ['团队创建与解散', '邮箱邀请与审批', '成员角色管理', '团队笔记可见性'], c: '#fff1f0', b: '#f5222d' },
    { t: '实时协作编辑', items: ['连接鉴权', '内容实时同步', '多光标在线感知', '冲突自动合并'], c: '#fffbe6', b: '#faad14' },
    { t: '笔记分享', items: ['链接生成（权限·有效期）', '访客免登录访问', '停用·改期·删除'], c: '#f9f0ff', b: '#722ed1' },
    { t: '版本管理', items: ['手动/自动快照', '版本查看', '一键回滚'], c: '#e6fffb', b: '#13c2c2' },
    { t: '回收站', items: ['30 天保留', '恢复', '彻底删除', '到期定时清理'], c: '#fff0f6', b: '#eb2f96' },
  ];
  // 根节点
  s += `<rect x="430" y="25" width="300" height="56" rx="8" fill="#1677ff"/>` +
       T(580, 59, '在线Markdown笔记编辑与管理平台', 18, '#fff', 'middle', '600');
  // 一级总线（贯穿 4 个一级模块上方）
  const r1x = [37, 314, 591, 868]; // 第一行 4 个模块左缘（w=255, gap=22）
  const c1 = r1x.map((x) => x + 127.5);
  s += `<line x1="${c1[0]}" y1="118" x2="${c1[3]}" y2="118" stroke="#888" stroke-width="1.5"/>`;
  s += `<line x1="580" y1="81" x2="580" y2="118" stroke="#888" stroke-width="1.5"/>`;
  c1.forEach((c) => s += `<line x1="${c}" y1="118" x2="${c}" y2="140" stroke="#888" stroke-width="1.5"/>` + T(c, 134, '', 1));
  // 第一行模块
  const box = (x, y, m) => {
    let b = `<rect x="${x}" y="${y}" width="255" height="180" rx="8" fill="${m.c}" stroke="${m.b}" stroke-width="1.5"/>`;
    b += `<rect x="${x}" y="${y}" width="255" height="36" rx="8" fill="${m.b}"/>`;
    b += `<rect x="${x}" y="${y + 20}" width="255" height="16" fill="${m.b}"/>`;
    b += T(x + 127.5, y + 25, m.t, 16.5, '#fff', 'middle', '600');
    m.items.forEach((it, i) => { b += T(x + 18, y + 64 + i * 28, '· ' + it, 14, '#333', 'start'); });
    return b;
  };
  mods.slice(0, 4).forEach((m, i) => { s += box(r1x[i], 140, m); });
  // 二级总线：从一级总线中缝（x=580，恰在模块 2/3 间隙）下引
  const r2x = [175, 452, 729];
  const c2 = r2x.map((x) => x + 127.5);
  s += `<line x1="580" y1="118" x2="580" y2="392" stroke="#888" stroke-width="1.5"/>`;
  s += `<line x1="${c2[0]}" y1="392" x2="${c2[2]}" y2="392" stroke="#888" stroke-width="1.5"/>`;
  c2.forEach((c) => s += `<line x1="${c}" y1="392" x2="${c}" y2="415" stroke="#888" stroke-width="1.5"/>`);
  mods.slice(4).forEach((m, i) => { s += box(r2x[i], 415, m); });
  return wrap(1160, 645, s);
})();

/* ---------- 图 3-1 系统总体用例图（参与者左列 + 分组用例右列，1160×1150） ---------- */
const usecase = (() => {
  let s = '';
  const actor = (x, y, name) => {
    let a = `<circle cx="${x}" cy="${y}" r="12" fill="#fff" stroke="#333" stroke-width="2"/>`;
    a += `<line x1="${x}" y1="${y + 12}" x2="${x}" y2="${y + 46}" stroke="#333" stroke-width="2"/>`;
    a += `<line x1="${x - 20}" y1="${y + 24}" x2="${x + 20}" y2="${y + 24}" stroke="#333" stroke-width="2"/>`;
    a += `<line x1="${x}" y1="${y + 46}" x2="${x - 17}" y2="${y + 74}" stroke="#333" stroke-width="2"/>`;
    a += `<line x1="${x}" y1="${y + 46}" x2="${x + 17}" y2="${y + 74}" stroke="#333" stroke-width="2"/>`;
    a += T(x, y + 98, name, 16, '#222', 'middle', '600');
    return a;
  };
  const group = (x, y, w, h, label) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="none" stroke="#999" stroke-dasharray="7,5" stroke-width="1.5"/>` +
    T(x + 18, y + 30, label, 16, '#555', 'start', '600');
  const line = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#777" stroke-width="1.4"/>`;

  // 参与者（左列）
  s += actor(110, 120, '个人用户');
  s += actor(110, 430, '团队管理员');
  s += actor(110, 690, '团队成员');
  s += actor(110, 950, '访客');
  // 分组（右列）
  s += group(280, 50, 700, 165, '账号类');
  s += oval(430, 140, '注册') + oval(620, 140, '登录 / 登出') + oval(810, 140, '查看个人信息');
  s += group(280, 245, 700, 290, '笔记类');
  s += oval(430, 320, '新建 / 编辑笔记') + oval(700, 320, '文件夹与标签');
  s += oval(430, 395, '关键词搜索') + oval(700, 395, '导出 Markdown / PDF');
  s += oval(430, 470, '版本管理与回滚') + oval(700, 470, '回收站');
  s += group(280, 565, 700, 215, '团队类');
  s += oval(430, 640, '创建 / 解散团队') + oval(700, 640, '邀请与审批');
  s += oval(430, 715, '成员与角色管理') + oval(700, 715, '团队笔记管理');
  s += group(280, 810, 700, 290, '分享与协作类');
  s += oval(430, 885, '生成分享链接') + oval(700, 885, '访客访问');
  s += oval(560, 1015, '实时协作编辑');
  // 连线
  s += line(128, 145, 280, 130);            // 个人用户→账号类
  s += line(128, 160, 280, 350);            // 个人用户→笔记类
  s += line(128, 175, 280, 870);            // 个人用户→分享与协作类
  s += line(148, 205, 148, 1005);           // 个人用户↓（至实时协作编辑）
  s += line(148, 1005, 468, 1010);          //   →实时协作编辑
  s += line(128, 455, 280, 655);            // 团队管理员→团队类
  s += line(128, 705, 280, 700);            // 团队成员→团队类
  s += line(162, 735, 162, 1020);           // 团队成员↓（至实时协作编辑）
  s += line(162, 1020, 468, 1022);          //   →实时协作编辑
  s += line(128, 960, 280, 900);            // 访客→分享与协作类
  return wrap(1160, 1150, s);
})();

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  defaultViewport: { width: 1400, height: 1400, deviceScaleFactor: 2 },
});
const jobs = [
  ['图3-1 系统总体用例图', usecase, 1160, 1150],
  ['图4-1 系统总体架构图', arch, 1160, 1200],
  ['图4-2 系统功能结构图', func, 1160, 645],
];
for (const [file, html, w, h] of jobs) {
  const page = await browser.newPage();
  await page.setViewport({ width: w + 20, height: h + 20, deviceScaleFactor: 2 });
  await page.setContent(html);
  await new Promise((r) => setTimeout(r, 200));
  const el = await page.$('svg');
  await el.screenshot({ path: `${OUT}${file}.png` });
  console.log('生成:', file);
  await page.close();
}
await browser.close();
console.log('A4 版式三张完成');
