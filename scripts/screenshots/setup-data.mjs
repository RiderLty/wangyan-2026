/**
 * 论文截图演示数据准备脚本（对已部署系统 http://192.168.3.3:18080 执行）
 * 全部走真实 REST 接口注册账号与创建数据，产出 state.json 供 shoot.mjs 使用。
 * 幂等：账号已存在（409）则直接登录复用。
 *
 * 用法：node scripts/screenshots/setup-data.mjs
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

const BASE = 'http://192.168.3.3:18080/api';
const STATE_FILE = new URL('./state.json', import.meta.url).pathname;

const USERS = [
  { email: 'chenmo@wangyan.test', password: 'Chenmo2026', username: '陈晓墨' },
  { email: 'suqing@wangyan.test', password: 'Suqing2026', username: '苏婉晴' },
  { email: 'wangyuan@wangyan.test', password: 'Wangyuan2026', username: '王致远' },
];

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** 注册（409=已注册则登录），返回 token */
async function ensureUser({ email, password, username }) {
  try {
    await req('POST', '/auth/register', { body: { email, password, username } });
    console.log(`注册成功: ${username}`);
  } catch (e) {
    if (e.status !== 409) throw e;
    console.log(`已存在，复用: ${username}`);
  }
  const login = await req('POST', '/auth/login', { body: { email, password } });
  return login.access_token;
}

/** 内嵌 SVG 图片（data URI，离线可显示的"架构示意图"） */
function archImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="150" viewBox="0 0 560 150">
  <rect width="560" height="150" fill="#fafafa" stroke="#d0d0d0"/>
  <g font-family="sans-serif" font-size="14" text-anchor="middle">
    <rect x="30" y="20" width="120" height="44" rx="6" fill="#e6f4ff" stroke="#1677ff"/><text x="90" y="47" fill="#1677ff">React 前端</text>
    <rect x="220" y="20" width="120" height="44" rx="6" fill="#f6ffed" stroke="#52c41a"/><text x="280" y="47" fill="#389e0d">Nginx 网关</text>
    <rect x="410" y="20" width="120" height="44" rx="6" fill="#fff7e6" stroke="#fa8c16"/><text x="470" y="47" fill="#d46b08">NestJS 服务</text>
    <rect x="220" y="92" width="120" height="40" rx="6" fill="#f9f0ff" stroke="#722ed1"/><text x="280" y="117" fill="#531dab">PostgreSQL</text>
    <rect x="410" y="92" width="120" height="40" rx="6" fill="#fff1f0" stroke="#f5222d"/><text x="470" y="117" fill="#cf1322">Redis</text>
    <g stroke="#8c8c8c" fill="none"><path d="M150 42 L220 42"/><path d="M340 42 L410 42"/><path d="M470 64 L470 92"/><path d="M340 112 L280 112" opacity="0"/></g>
    <text x="185" y="34" font-size="11" fill="#595959">HTTP/WS</text>
  </g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const p = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h = (level, text) => ({
  type: 'heading',
  attrs: { level, textAlign: null },
  content: [{ type: 'text', text }],
});
const cell = (text, header = false) => ({
  type: header ? 'tableHeader' : 'tableCell',
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [p(text)],
});
const row = (cells) => ({ type: 'tableRow', content: cells });
const table = (rows) => ({ type: 'table', content: rows });
const task = (checked, text) => ({
  type: 'taskItem',
  attrs: { checked },
  content: [p(text)],
});

/** 主设计文档：长文（可滚动展示冻结工具栏）+ 表格/代码块/任务列表/图片/引用 */
function designDoc() {
  return {
    type: 'doc',
    content: [
      h(1, '在线笔记平台设计文档'),
      p('本文档记录平台的总体设计与实现要点，涵盖架构、数据库、实时协作与权限体系四个部分。'),
      h(2, '1. 系统架构'),
      p('系统采用前后端分离的四层架构：表现层为 React 单页应用，网关层由 Nginx 承担静态资源托管与反向代理，应用层为 NestJS 模块化单体，数据层由 PostgreSQL 与 Redis 组成。'),
      { type: 'image', attrs: { src: archImage(), alt: '系统架构示意图', title: null } },
      h(2, '2. 功能模块划分'),
      p('后端按业务域划分为九个模块，模块内部遵循 controller—service 分层：'),
      table([
        row([cell('模块', true), cell('职责', true), cell('核心技术', true)]),
        row([cell('auth'), cell('注册 / 登录 / JWT 黑名单登出'), cell('JWT + Redis')]),
        row([cell('notes'), cell('笔记 CRUD、文件夹、标签、搜索'), cell('TypeORM + JSONB')]),
        row([cell('realtime'), cell('WebSocket 接入与文档持久化'), cell('Yjs + y-websocket')]),
        row([cell('teams'), cell('团队、成员、邀请与 RBAC'), cell('角色断言 + 可见性过滤')]),
        row([cell('share'), cell('分享链接生成与访客访问'), cell('crypto token + 缓存')]),
      ]),
      h(2, '3. 数据库核心表'),
      p('笔记正文以 JSONB 存储 ProseMirror 文档快照，协作增量以二进制追加存储于 yjs_updates 表，会话结束合并回写：'),
      {
        type: 'codeBlock',
        attrs: { language: 'sql' },
        content: [
          {
            type: 'text',
            text: 'CREATE TABLE notes (\n  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  owner_id uuid NOT NULL REFERENCES users(id),\n  title    varchar(200) NOT NULL,\n  content  jsonb NOT NULL,          -- ProseMirror 快照\n  content_text text NOT NULL DEFAULT \'\',  -- 搜索派生列\n  visibility   varchar(20) NOT NULL DEFAULT \'private\'\n);',
          },
        ],
      },
      h(2, '4. 迭代任务清单'),
      {
        type: 'taskList',
        content: [
          task(true, '用户认证与 JWT 黑名单登出'),
          task(true, '实时协作编辑与多光标同步'),
          task(false, '离线编辑（IndexedDB 补传）'),
          task(false, '移动端响应式适配'),
        ],
      },
      {
        type: 'blockquote',
        content: [p('设计原则：实时广播走内存、持久化异步化——增量缓冲 2 秒合并入库，不阻塞键入传播。')],
      },
      p('以上为文档正文示例，滚动查看时顶部标题栏与格式工具栏保持冻结。'),
    ],
  };
}

const redisDoc = () => ({
  type: 'doc',
  content: [
    h(1, 'Redis 缓存设计要点'),
    p('Redis 在系统中承担三类职责：JWT 登出黑名单、分享链接元数据缓存与定时任务支撑。'),
    h(2, '键设计'),
    table([
      row([cell('键模式', true), cell('TTL', true), cell('用途', true)]),
      row([cell('auth:denylist:{jti}'), cell('≤7d'), cell('登出后令牌黑名单')]),
      row([cell('cache:share:{token}'), cell('60s'), cell('分享元数据缓存')]),
    ]),
    p('缓存一致性：管理端任何变更即时失效对应缓存键，保证停用分享"立即生效"。'),
  ],
});

const readingDoc = () => ({
  type: 'doc',
  content: [
    h(1, '读书笔记：卡片写作法'),
    { type: 'blockquote', content: [p('卡片笔记法：用标准化的小卡片积累知识，通过链接产生网络效应。')] },
    p('收藏不等于学习，输出才是。每张卡片要求用自己的话重写，并尽量与已有卡片建立引用关系。'),
  ],
});

const draftDoc = () => ({
  type: 'doc',
  content: [h(1, '草稿：废弃大纲'), p('这一版大纲被否决了，先删掉，回收站保留 30 天。')],
});

const deployDoc = () => ({
  type: 'doc',
  content: [
    h(1, '部署手册（团队协作）'),
    p('团队成员共同维护的部署手册：docker compose up 一键拉起四服务。'),
    h(2, '步骤'),
    {
      type: 'codeBlock',
      attrs: { language: 'bash' },
      content: [{ type: 'text', text: 'cp .env.example .env\ndocker compose up -d\n# 访问 http://localhost:18080' }],
    },
    p('镜像构建采用多阶段构建，前端运行镜像基于 nginx:alpine。'),
  ],
});

const minutesDoc = () => ({
  type: 'doc',
  content: [
    h(1, '周会纪要（团队）'),
    p('本周完成：编辑器语法补全（图片/表格/任务列表）与 GitHub 白色主题。'),
    p('下周计划：论文截图补拍、性能测试复验。'),
  ],
});

async function main() {
  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
  const tokens = {};
  for (const u of USERS) tokens[u.username] = await ensureUser(u);
  state.tokens = tokens;
  const chen = tokens['陈晓墨'];
  const su = tokens['苏婉晴'];

  // ---------- 文件夹 / 标签 ----------
  const folders = await req('GET', '/folders', { token: chen });
  const findFolder = (name) => folders.find((f) => f.name === name);
  let folderDesign = findFolder('毕业设计');
  if (!folderDesign) folderDesign = await req('POST', '/folders', { token: chen, body: { name: '毕业设计' } });
  let folderDev = findFolder('开发文档');
  if (!folderDev) folderDev = await req('POST', '/folders', { token: chen, body: { name: '开发文档', parent_id: folderDesign.id } });
  let folderRead = findFolder('读书笔记');
  if (!folderRead) folderRead = await req('POST', '/folders', { token: chen, body: { name: '读书笔记' } });

  const tags = await req('GET', '/tags', { token: chen });
  const findTag = (name) => tags.find((t) => t.name === name);
  let tagFe = findTag('前端');
  if (!tagFe) tagFe = await req('POST', '/tags', { token: chen, body: { name: '前端', color: '#1677ff' } });
  let tagDb = findTag('数据库');
  if (!tagDb) tagDb = await req('POST', '/tags', { token: chen, body: { name: '数据库', color: '#52c41a' } });

  // ---------- 笔记（幂等：按标题查） ----------
  const notes = await req('GET', '/notes', { token: chen });
  const findNote = (title) => notes.find((n) => n.title === title);
  async function ensureNote(title, content, folder_id, tagId) {
    let n = findNote(title);
    if (!n) n = await req('POST', '/notes', { token: chen, body: { title, folder_id } });
    const detail = await req('GET', `/notes/${n.id}`, { token: chen });
    // 内容仅在为空时写入，避免覆盖已有人工编辑
    if (!detail.content?.content?.length || JSON.stringify(detail.content) === JSON.stringify({ type: 'doc', content: [] })) {
      await req('PATCH', `/notes/${n.id}`, { token: chen, body: { content } });
    }
    if (tagId) await req('PUT', `/notes/${n.id}/tags`, { token: chen, body: { tag_id: tagId } });
    return n;
  }

  const noteDesign = await ensureNote('在线笔记平台·设计文档', designDoc(), folderDev.id, tagFe.id);
  const noteRedis = await ensureNote('Redis 缓存设计要点', redisDoc(), folderDev.id, tagDb.id);
  const noteRead = await ensureNote('读书笔记：卡片写作法', readingDoc(), folderRead.id, null);
  const noteDraft = findNote('草稿：废弃大纲');
  if (!noteDraft) await req('POST', '/notes', { token: chen, body: { title: '草稿：废弃大纲', content: draftDoc() } });

  // ---------- 版本（手动保存两版，制造列表差异） ----------
  const vers = await req('GET', `/notes/${noteDesign.id}/versions`, { token: chen });
  if (vers.length === 0) {
    await req('POST', `/notes/${noteDesign.id}/versions`, { token: chen });
    await req('PATCH', `/notes/${noteDesign.id}`, {
      token: chen,
      body: { content: designDoc() }, // v2 与 v1 快照同内容亦可，仅展示列表
    });
    await req('POST', `/notes/${noteDesign.id}/versions`, { token: chen });
    console.log('已保存两个手动版本');
  }

  // ---------- 回收站（软删一篇） ----------
  const bin = await req('GET', '/recycle-bin', { token: chen });
  if (bin.length === 0) {
    const d = findNote('草稿：废弃大纲') ?? (await req('POST', '/notes', { token: chen, body: { title: '草稿：废弃大纲', content: draftDoc() } }));
    await req('DELETE', `/notes/${d.id}`, { token: chen });
    console.log('已软删一篇进回收站');
  }

  // ---------- 团队 ----------
  const teams = await req('GET', '/teams', { token: chen });
  let team = teams.find((t) => t.name === '毕业设计小组');
  if (!team) team = await req('POST', '/teams', { token: chen, body: { name: '毕业设计小组', description: '论文配套系统的团队协作空间' } });

  // 苏晴：已是成员则跳过；否则邀请并接受
  const members = await req('GET', `/teams/${team.id}/members`, { token: chen });
  if (!members.some((m) => m.username === '苏婉晴')) {
    const inv = await req('POST', `/teams/${team.id}/invitations`, { token: chen, body: { email: 'suqing@wangyan.test' } });
    const mine = await req('GET', '/teams/invitations/mine', { token: su });
    const target = mine.find((i) => i.id === inv.id);
    if (target) {
      await req('POST', `/teams/invitations/${inv.id}/accept`, { token: su });
      console.log('苏晴已接受邀请');
    }
  }
  // 王远：保持一条 pending 邀请（团队管理弹窗截图用）
  const invRecords = await req('GET', `/teams/${team.id}/invitations`, { token: chen });
  if (!invRecords.some((i) => i.invitee_email === 'wangyuan@wangyan.test' && i.status === 'pending')) {
    await req('POST', `/teams/${team.id}/invitations`, { token: chen, body: { email: 'wangyuan@wangyan.test' } });
    console.log('已创建王远的 pending 邀请');
  }

  // ---------- 团队笔记 ----------
  const teamNotes = await req('GET', `/teams/${team.id}/notes`, { token: chen });
  let tnDeploy = teamNotes.find((n) => n.title === '部署手册（团队协作）');
  if (!tnDeploy) tnDeploy = await req('POST', '/notes', { token: chen, body: { team_id: team.id, visibility: 'team_edit', title: '部署手册（团队协作）', content: deployDoc() } });
  let tnMinutes = teamNotes.find((n) => n.title === '周会纪要（团队）');
  if (!tnMinutes) tnMinutes = await req('POST', '/notes', { token: chen, body: { team_id: team.id, visibility: 'team_read', title: '周会纪要（团队）', content: minutesDoc() } });

  // ---------- 分享链接 ----------
  const shareOf = async (noteId, perm) => {
    const list = await req('GET', `/share?note_id=${noteId}`, { token: chen });
    return list.find((s) => s.permission === perm);
  };
  let shareRead = await shareOf(noteRedis.id, 'read');
  if (!shareRead) shareRead = await req('POST', '/share', { token: chen, body: { note_id: noteRedis.id, permission: 'read' } });
  let shareEdit = await shareOf(noteDesign.id, 'edit');
  if (!shareEdit) shareEdit = await req('POST', '/share', { token: chen, body: { note_id: noteDesign.id, permission: 'edit' } });

  Object.assign(state, {
    base: 'http://192.168.3.3:18080',
    noteDesign: noteDesign.id,
    noteRedis: noteRedis.id,
    teamId: team.id,
    tnDeploy: tnDeploy.id,
    tnMinutes: tnMinutes.id,
    shareReadToken: shareRead.token,
    shareEditToken: shareEdit.token,
  });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log('state.json 已写入：', Object.keys(state).join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
