/**
 * 数据库 E-R 图与关系图程序化生成（论文图 4-3 / 图 4-4）
 * mermaid 已内联（离线渲染），白底 PNG，@2x。
 * 用法：node scripts/screenshots/diagram-shots.mjs
 */
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const EDGE = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const ASSETS = new URL('../../docs/assets/', import.meta.url).pathname;
const mermaidJs = readFileSync(new URL('../../node_modules/mermaid/dist/mermaid.min.js', import.meta.url), 'utf8');

const ER = `
erDiagram
  USERS {
    uuid id PK
    varchar email "唯一登录凭证"
    varchar username
    varchar password_hash "bcrypt"
  }
  FOLDERS {
    uuid id PK
    uuid owner_id FK
    uuid parent_id "自引用嵌套"
    varchar name
  }
  TEAMS {
    uuid id PK
    varchar name
    uuid owner_id FK
  }
  TEAM_MEMBERS {
    uuid id PK
    uuid team_id FK
    uuid user_id FK
    varchar role "owner/admin/member"
  }
  TEAM_INVITATIONS {
    uuid id PK
    uuid team_id FK
    varchar invitee_email
    varchar status "五态"
    timestamptz expires_at "7天"
  }
  NOTES {
    uuid id PK
    uuid owner_id FK
    uuid team_id FK "空=个人笔记"
    uuid folder_id FK "仅个人"
    varchar title
    jsonb content "ProseMirror快照"
    text content_text "搜索派生列"
    varchar visibility "三级"
    timestamptz deleted_at "软删"
  }
  TAGS {
    uuid id PK
    uuid owner_id FK
    varchar name
    varchar color
  }
  NOTE_TAGS {
    uuid note_id PK_FM
    uuid tag_id PK_FM
  }
  YJS_UPDATES {
    bigserial id PK "追加序"
    uuid note_id FK
    bytea update "CRDT增量"
  }
  NOTE_VERSIONS {
    uuid id PK
    uuid note_id FK
    int version_no
    jsonb content "整份快照"
    varchar source "manual/auto/rollback"
  }
  SHARE_LINKS {
    uuid id PK
    uuid note_id FK
    varchar token "32位随机"
    varchar permission "read/edit"
    timestamptz expires_at "空=永久"
    boolean is_enabled
  }
  RECYCLE_BIN {
    uuid id PK
    uuid note_id FK "一对一"
    uuid original_owner_id
    timestamptz expires_at "删除+30天"
  }
  USERS ||--o{ FOLDERS : "拥有"
  FOLDERS ||--o{ FOLDERS : "父子嵌套"
  USERS ||--o{ NOTES : "创建"
  USERS ||--o{ TEAMS : "创建拥有"
  USERS ||--o{ TEAM_MEMBERS : "归属"
  TEAMS ||--o{ TEAM_MEMBERS : "成员"
  TEAMS ||--o{ TEAM_INVITATIONS : "发出邀请"
  TEAMS ||--o{ NOTES : "团队笔记"
  USERS ||--o{ TAGS : "拥有"
  NOTES ||--o{ NOTE_TAGS : ""
  TAGS ||--o{ NOTE_TAGS : ""
  NOTES ||--o{ YJS_UPDATES : "增量日志"
  NOTES ||--o{ NOTE_VERSIONS : "版本快照"
  NOTES ||--o{ SHARE_LINKS : "分享链接"
  NOTES ||--o| RECYCLE_BIN : "回收站"
`;

const RELATIONS = `
flowchart LR
  classDef core fill:#e6f4ff,stroke:#1677ff,stroke-width:2px;
  classDef dim fill:#f6ffed,stroke:#52c41a;
  classDef aux fill:#fff7e6,stroke:#fa8c16;

  USERS["users（用户）<br/>PK id · email唯一 · password_hash"]
  FOLDERS["folders（文件夹）<br/>PK id · FK owner_id · FK parent_id自引用"]
  TEAMS["teams（团队）<br/>PK id · FK owner_id"]
  TEAM_MEMBERS["team_members（成员）<br/>FK team_id · FK user_id · role"]
  TEAM_INVITATIONS["team_invitations（邀请）<br/>FK team_id · invitee_email · status"]
  NOTES["notes（笔记·枢纽）<br/>PK id · FK owner_id · FK team_id · FK folder_id<br/>content JSONB · content_text · visibility"]
  TAGS["tags（标签）<br/>PK id · FK owner_id"]
  NOTE_TAGS["note_tags（笔记标签）<br/>PK note_id · PK tag_id"]
  YJS_UPDATES["yjs_updates（协作增量）<br/>PK id · FK note_id · update bytea"]
  NOTE_VERSIONS["note_versions（版本）<br/>FK note_id · version_no · content JSONB"]
  SHARE_LINKS["share_links（分享）<br/>FK note_id · token唯一 · permission"]
  RECYCLE_BIN["recycle_bin（回收站）<br/>FK note_id唯一 · expires_at"]

  USERS --> FOLDERS
  FOLDERS -. "parent_id 自引用" .-> FOLDERS
  USERS --> NOTES
  USERS --> TEAMS
  USERS --> TEAM_MEMBERS
  TEAMS --> TEAM_MEMBERS
  TEAMS --> TEAM_INVITATIONS
  TEAMS --> NOTES
  USERS --> TAGS
  NOTES --> NOTE_TAGS
  TAGS --> NOTE_TAGS
  NOTES --> YJS_UPDATES
  NOTES --> NOTE_VERSIONS
  NOTES --> SHARE_LINKS
  NOTES --> RECYCLE_BIN

  class USERS,TEAMS,NOTES core;
  class FOLDERS,TAGS,NOTE_TAGS dim;
  class TEAM_MEMBERS,TEAM_INVITATIONS,YJS_UPDATES,NOTE_VERSIONS,SHARE_LINKS,RECYCLE_BIN aux;
`;

async function render(browser, file, code, width) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 1400, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: #fff; font-family: -apple-system, "PingFang SC", sans-serif; }
    #wrap { padding: 24px; }
  </style></head><body><div id="wrap"><pre class="mermaid">${code}</pre></div>
  <script>${mermaidJs}</script>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'neutral', flowchart: { curve: 'basis' }, er: { useMaxWidth: false } });</script>
  </body></html>`);
  await page.waitForSelector('.mermaid svg', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 400));
  const el = await page.$('.mermaid svg');
  await el.screenshot({ path: `${ASSETS}${file}.png` });
  console.log('生成完成:', file);
  await page.close();
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  defaultViewport: { width: 1800, height: 1400, deviceScaleFactor: 2 },
});
await render(browser, '4.3.1-er-diagram', ER, 1750);
await render(browser, '4.3.9-db-relations', RELATIONS, 1750);
await browser.close();
console.log('全部完成');
