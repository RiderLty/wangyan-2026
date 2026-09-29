/**
 * 生成论文仍缺的 4 张示意图（图 3-1 / 4-1 / 4-2 / 4-7）
 * 产出：docs/thesis/论文插图/*.png（白底 @2x，文件名=图号+图名，用户手动插入 Word）
 * 用法：node scripts/screenshots/thesis-figures.mjs
 */
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const OUT = 'docs/thesis/论文插图/';
const mermaidJs = readFileSync('node_modules/mermaid/dist/mermaid.min.js', 'utf8');

const FIGURES = [
  {
    file: '图3-1 系统总体用例图',
    width: 1500,
    code: `
flowchart LR
  classDef actor fill:#e6f4ff,stroke:#1677ff,stroke-width:2px;
  classDef acc fill:#fffbe6,stroke:#faad14;
  classDef note fill:#f6ffed,stroke:#52c41a;
  classDef team fill:#fff1f0,stroke:#f5222d;
  classDef share fill:#f9f0ff,stroke:#722ed1;

  U(["个人用户"]):::actor
  A(["团队管理员"]):::actor
  M(["团队成员"]):::actor
  G(["访客"]):::actor

  subgraph 账号类
    u1(["注册"]):::acc
    u2(["登录/登出"]):::acc
    u3(["查看个人信息"]):::acc
  end
  subgraph 笔记类
    n1(["新建/编辑笔记"]):::note
    n2(["文件夹与标签"]):::note
    n3(["搜索"]):::note
    n4(["导出 Markdown/PDF"]):::note
    n5(["版本管理与回滚"]):::note
    n6(["回收站"]):::note
  end
  subgraph 团队类
    t1(["创建/解散团队"]):::team
    t2(["邀请与审批"]):::team
    t3(["成员与角色管理"]):::team
    t4(["团队笔记管理"]):::team
  end
  subgraph 分享与协作类
    s1(["生成分享链接"]):::share
    s2(["访客访问"]):::share
    s3(["实时协作编辑"]):::share
  end

  U --> u1 & u2 & u3
  U --> n1 & n2 & n3 & n4 & n5 & n6
  A --> t1 & t2 & t3 & t4
  M --> t4
  U --> s3
  M --> s3
  G --> s2 & s3
  U --> s1
`,
  },
  {
    file: '图4-1 系统总体架构图',
    width: 1300,
    code: `
flowchart TB
  classDef pres fill:#e6f4ff,stroke:#1677ff,stroke-width:2px;
  classDef gw fill:#fffbe6,stroke:#faad14,stroke-width:2px;
  classDef app fill:#f6ffed,stroke:#52c41a,stroke-width:2px;
  classDef data fill:#f9f0ff,stroke:#722ed1,stroke-width:2px;

  subgraph P["表现层"]
    B["浏览器 · React 单页应用<br/>（Ant Design + Tiptap + Yjs 客户端）"]:::pres
  end
  subgraph W["网关层"]
    N["Nginx<br/>托管前端静态资源 · 反向代理 /api 与 /ws"]:::gw
  end
  subgraph A["应用层 · NestJS 模块化单体（REST 与 WebSocket 共进程）"]
    direction LR
    M1["auth"]:::app
    M2["users"]:::app
    M3["notes"]:::app
    M4["teams"]:::app
    M5["share"]:::app
    M6["versions"]:::app
    M7["recycle-bin"]:::app
    M8["realtime"]:::app
    M9["export"]:::app
    M1 ~~~ M2 ~~~ M3 ~~~ M4 ~~~ M5 ~~~ M6 ~~~ M7 ~~~ M8 ~~~ M9
  end
  subgraph D["数据层"]
    PG[("PostgreSQL<br/>notes.content=JSONB 快照<br/>yjs_updates=bytea 增量")]:::data
    R[("Redis<br/>JWT 黑名单 · 分享缓存")]:::data
  end

  B -->|"HTTPS 静态资源"| N
  B -->|"REST /api"| N
  B <-.->|"WebSocket /ws（upgrade 握手鉴权）"| N
  N --> A
  A --> PG
  A --> R
`,
  },
  {
    file: '图4-2 系统功能结构图',
    width: 1700,
    code: `
flowchart TB
  ROOT["在线Markdown笔记编辑与管理平台"]
  ROOT --> M1["用户管理"]
  ROOT --> M2["个人笔记管理"]
  ROOT --> M3["团队协作管理"]
  ROOT --> M4["实时协作编辑"]
  ROOT --> M5["笔记分享"]
  ROOT --> M6["版本管理"]
  ROOT --> M7["回收站"]

  M1 --> m1a["注册"] & m1b["登录/登出"] & m1c["个人信息"]
  M2 --> m2a["创建/编辑/自动保存"] & m2b["Markdown 即时渲染"] & m2c["文件夹与标签"] & m2d["关键词搜索"]
  M3 --> m3a["团队创建与解散"] & m3b["邮箱邀请与审批"] & m3c["成员角色管理"] & m3d["团队笔记可见性"]
  M4 --> m4a["连接鉴权"] & m4b["内容实时同步"] & m4c["多光标与在线感知"] & m4d["并发冲突自动合并"]
  M5 --> m5a["链接生成（权限/有效期）"] & m5b["访客免登录访问"] & m5c["停用/改期/删除"]
  M6 --> m6a["手动/自动快照"] & m6b["版本查看"] & m6c["一键回滚"]
  M7 --> m7a["30 天保留"] & m7b["恢复"] & m7c["彻底删除"] & m7d["到期定时清理"]
`,
  },
  {
    file: '图4-7 Yjs文档同步流程图',
    width: 1200,
    code: `
sequenceDiagram
  autonumber
  participant A as 客户端 A
  participant S as 服务端（y-websocket + 持久化适配器）
  participant B as 客户端 B
  participant DB as PostgreSQL

  A->>S: 打开文档（WS /ws/:noteId，JWT 鉴权）
  S->>DB: 查询 yjs_updates
  alt 有历史增量
    DB-->>S: 增量帧
    S->>S: 按自增序回放
  else 无帧（首次协作）
    S->>DB: 读取 notes.content 快照
    S->>S: 播种初始文档并存种子帧
  end
  S-->>A: 同步步 2（差量）
  B->>S: 打开文档
  S-->>B: 同步完成（同一文档）

  loop 实时编辑（内存广播，不落盘阻塞）
    A->>S: 编辑增量
    par 广播
      S-->>B: 增量转发（毫秒级）
    and 持久化缓冲
      S->>S: 缓冲 2s → Y.mergeUpdates 合并
      S->>DB: 追加写入 yjs_updates
    end
  end

  Note over A,DB: 全部连接断开 → 会话收尾
  S->>S: 防误清检查（会话空且快照非空 → 跳过）
  S->>DB: 合并回写 notes.content + content_text
  S->>DB: 压缩（删除已合并旧增量行）
`,
  },
];

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  defaultViewport: { width: 1800, height: 1200, deviceScaleFactor: 2 },
});
for (const { file, code, width } of FIGURES) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 1500, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: #fff; font-family: -apple-system, "PingFang SC", sans-serif; }
    #wrap { padding: 20px; }
  </style></head><body><div id="wrap"><pre class="mermaid">${code}</pre></div>
  <script>${mermaidJs}</script>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'neutral', flowchart: { curve: 'basis' }, sequence: { useMaxWidth: false } });</script>
  </body></html>`);
  await page.waitForSelector('.mermaid svg', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 400));
  const el = await page.$('.mermaid svg');
  await el.screenshot({ path: `${OUT}${file}.png` });
  console.log('生成:', file);
  await page.close();
}
await browser.close();
console.log('全部完成 →', OUT);
