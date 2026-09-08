# 数据库设计稿（论文 4.3 支撑材料）

> 状态：**设计稿，未建表**。本文件是论文 4.3.1 E-R 图 / 4.3.9 关系图的文字底稿，
> 也是后续 TypeORM 实体与 `docs/appendix-ddl.sql` 的事实来源。
> 决策依据：D-002（TypeORM）、D-006（NAS 存储）、本文件尾部 D-007 相关决策记录。

---

## 0. 总览：表 ↔ 论文小节 ↔ 模块映射

| # | 表/视图 | 类型 | 支撑论文小节 | 对应后端模块 |
|---|---|---|---|---|
| 1 | users | 基表 | 4.3.2 | auth / users |
| 2 | folders | 基表 | 4.3.5（顺带表述） | notes |
| 3 | teams | 基表 | 4.3.3 | teams |
| 4 | team_members | 基表 | 4.3.4 | teams |
| 5 | team_invitations | 基表 | 4.3.4（邀请子节） | teams |
| 6 | notes | 基表 | 4.3.5 | notes |
| 7 | tags | 基表 | 4.3.5（分类维度） | notes |
| 8 | note_tags | 基表 | 4.3.5（多对多） | notes |
| 9 | attachments | 基表 | 4.3.5（顺带表述） | notes / export |
| 10 | yjs_updates | 基表 | 4.3.5 / 4.4.2 | realtime |
| 11 | note_versions | 基表 | 4.3.6 | versions |
| 12 | share_links | 基表 | 4.3.7 | share |
| 13 | recycle_bin | 基表 | 4.3.8 | recycle-bin |
| V1–V4 | 四个视图 | 视图 | 4.3.9 | 只读统计查询 |

大纲 4.3 点名的 7 张表全部存在且同名；folders / tags / attachments / yjs_updates /
team_invitations 为实现 5.3.3、5.5.2、5.4 所必需的补充（已与用户确认，2026-09-08）。

---

## 1. 公共约定

| 约定 | 决定 | 理由 |
|---|---|---|
| 主键 | `uuid`，`gen_random_uuid()`（PG16 内置） | 无全局冲突风险，未来多端/分布式生成 ID 无需协调 |
| 时间戳 | 全部 `timestamptz`，`created_at` / `updated_at` 常备 | TypeORM `@CreateDateColumn/@UpdateDateColumn` 直接对应 |
| 命名 | 蛇形命名，TypeORM 实体统一 `snake_case` 映射 | 与论文 DDL 附录一致 |
| 枚举 | `varchar(N) + CHECK 约束`，**不用 PG enum 类型** | PG enum 只能追加、不能删改；CHECK 改起来代价极低，扩展友好 |
| 软删除 | 仅 notes 用 `deleted_at` 标记，回收站元数据拆到 recycle_bin | 见 §3.6 / §3.13 |
| 外键 | 全部物理外键（开发期 synchronize 建表，最终导出 DDL） | 论文附录 A 直接可读，演示数据量小不怕锁 |

---

## 2. E-R 关系文字底稿（4.3.1 / 4.3.9 画图用）

实体（矩形）与联系（菱形）：

```
users 1───N folders          （一个人有多个文件夹；folders 自引用 1──N 子文件夹）
users 1───N notes            （一个人创建多篇笔记）
users 1───N teams            （一个人拥有/创建多个团队：teams.owner_id）
users M───N teams            通过 team_members（带 role 属性）
teams 1───N team_invitations （邀请未接受时不是成员，独立实体）
teams 1───N notes            （团队笔记：notes.team_id 非空）
users M───N notes            通过 tags/note_tags（个人标签多对多）
notes 1───N attachments      （一篇笔记多个附件）
notes 1───N yjs_updates      （一篇笔记多帧 CRDT 增量，追加式）
notes 1───N note_versions    （一篇笔记多个版本快照）
notes 1───N share_links      （一篇笔记多条分享链接）
notes 1──1 recycle_bin       （一篇笔记至多一条回收站记录）
```

画图要点：
- `notes` 是全图枢纽，6 张表以它为中心辐射——论文关系图（4.3.9）建议以 notes 居中布局
- `users` 与 `teams` 之间有**两条**联系（拥有 owner / 成员 member），图上分开画
- 联系上的属性标注：team_members→role；team_invitations→status,expires_at；share_links→permission,expires_at；recycle_bin→deleted_at,expires_at

---

## 3. 基表结构

### 3.1 users（用户表，论文 4.3.2）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | |
| email | varchar(255) | NOT NULL, UNIQUE | 登录凭证 |
| username | varchar(50) | NOT NULL, UNIQUE | 展示名 |
| password_hash | varchar(100) | NOT NULL | bcrypt 哈希，永不存明文（3.4.2） |
| avatar_url | varchar(500) | NULL | 头像 |
| created_at / updated_at | timestamptz | NOT NULL | |

### 3.2 folders（文件夹表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | |
| owner_id | uuid | NOT NULL FK→users | 文件夹只属于个人空间 |
| parent_id | uuid | NULL FK→folders(id) | 自引用，支持嵌套；NULL=根级 |
| name | varchar(100) | NOT NULL | |
| created_at / updated_at | timestamptz | NOT NULL | |

约束：`UNIQUE (owner_id, parent_id, name)`。
⚠️ 实现调整（2026-09-08，5.3 落地时）：typeorm 0.3.31 装饰器已不支持表达式索引，
故建普通复合唯一索引（覆盖 parent_id 非空场景）；"根级 NULL 不去重"的边缘场景
由 FoldersService 在创建/改名/移动前显式查重兜底（见 folders.service.ts assertNameAvailable）。

### 3.3 teams（团队表，论文 4.3.3）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | |
| name | varchar(100) | NOT NULL | |
| description | varchar(500) | NULL | |
| owner_id | uuid | NOT NULL FK→users | 团队创建者/管理员 |
| created_at / updated_at | timestamptz | NOT NULL | |

> owner 同时在 team_members 有一行 `role='owner'`，两者一致性由服务层保证（受控冗余，
> 换取"查我参与的所有团队"不用 UNION 特判——见 §4 反规范化 R4）。

### 3.4 team_members（团队成员表，论文 4.3.4）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | |
| team_id | uuid | NOT NULL FK→teams | |
| user_id | uuid | NOT NULL FK→users | |
| role | varchar(20) | NOT NULL DEFAULT 'member', CHECK IN ('owner','admin','member') | RBAC 角色落点（4.5.1） |
| joined_at | timestamptz | NOT NULL DEFAULT now() | |

约束：`UNIQUE (team_id, user_id)`。
设计说明：**只有接受邀请后才落此表**；"待审批"状态属于 team_invitations，
两实体生命周期不同（§2 颗粒度拆分）。

### 3.5 team_invitations（团队邀请表，论文 4.3.4 邀请子节）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | |
| team_id | uuid | NOT NULL FK→teams | |
| inviter_id | uuid | NOT NULL FK→users | 谁发出的邀请 |
| invitee_email | varchar(255) | NOT NULL | 按邮箱邀请 |
| invitee_id | uuid | NULL FK→users | 对方已注册则关联；NULL=邮箱未注册 |
| status | varchar(20) | NOT NULL DEFAULT 'pending', CHECK IN ('pending','accepted','declined','cancelled','expired') | 5.5.2 邀请与审批 |
| expires_at | timestamptz | NOT NULL | 过期后定时任务置 expired |
| created_at | timestamptz | NOT NULL | |

约束：`UNIQUE (team_id, invitee_email)`；同一团队对同一邮箱同时只有一条有效邀请。

### 3.6 notes（笔记表，论文 4.3.5）—— 全库枢纽

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | |
| owner_id | uuid | NOT NULL FK→users | 创建者（团队笔记也记录创建人） |
| team_id | uuid | NULL FK→teams | NULL=个人笔记；非空=团队笔记 |
| folder_id | uuid | NULL FK→folders | 仅个人笔记使用 |
| title | varchar(200) | NOT NULL | |
| content | jsonb | NOT NULL | **正文**：ProseMirror 文档快照（2.3.1 JSONB 约定） |
| content_text | text | NOT NULL DEFAULT '' | 由 content 派生的纯文本，供全文检索（反规范化 R1） |
| visibility | varchar(20) | NOT NULL DEFAULT 'private', CHECK IN ('private','team_read','team_edit') | 团队笔记的成员级权限（4.5.2/4.5.3） |
| deleted_at | timestamptz | NULL | 软删标记（5.7.3）；业务查询一律过滤 |
| created_at / updated_at | timestamptz | NOT NULL | |

CHECK 约束：`team_id IS NULL OR folder_id IS NULL`（团队笔记无个人文件夹归属）。

正文与 CRDT 的分工（D-007 核心）：
- `content` JSONB = 合并后的文档快照 → 服务**列表 / 搜索 / 导出 / 版本对比**，满足"正文 JSONB"锁定约束
- `yjs_updates`（3.10）= CRDT 二进制增量 → 实时协作的真实数据源，定时合并回写 content
- 两者的同步是 realtime 模块的职责，论文 4.4.2 画流程图

### 3.7 tags（标签表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | |
| owner_id | uuid | NOT NULL FK→users | 标签归个人 |
| name | varchar(50) | NOT NULL | |
| color | varchar(20) | NULL | 前端展示色 |
| created_at | timestamptz | NOT NULL | |

约束：`UNIQUE (owner_id, name)`。

### 3.8 note_tags（笔记-标签关联表）

| 字段 | 类型 | 约束 |
|---|---|---|
| note_id | uuid | PK(复合), FK→notes |
| tag_id | uuid | PK(复合), FK→tags |

复合主键天然防重复打标。`ON DELETE CASCADE`（删标签/删笔记自动清关联）。

### 3.9 attachments（笔记附件表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | |
| note_id | uuid | NOT NULL FK→notes | |
| uploader_id | uuid | NOT NULL FK→users | |
| file_name | varchar(255) | NOT NULL | 原始文件名 |
| storage_path | varchar(500) | NOT NULL | 落盘相对路径（Docker 卷） |
| mime_type | varchar(100) | NOT NULL | |
| size | bigint | NOT NULL, CHECK (size > 0) | 字节 |
| created_at | timestamptz | NOT NULL | |

文件本体不进数据库（BLOB 会拖垮备份），只存元数据 + 相对路径——论文 4.3.5 可写一句这个取舍。

### 3.10 yjs_updates（CRDT 增量表，支撑 4.4.2）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | bigserial | PK | 自增保证追加顺序（回放需要） |
| note_id | uuid | NOT NULL FK→notes | |
| update | bytea | NOT NULL | Yjs 二进制增量（Uint8Array） |
| created_at | timestamptz | NOT NULL | |

索引：`(note_id, id)`。追加写、合并后清理（compaction），合并结果写回 notes.content。

### 3.11 note_versions（笔记版本表，论文 4.3.6）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | |
| note_id | uuid | NOT NULL FK→notes | |
| version_no | int | NOT NULL | 笔记内递增 |
| title | varchar(200) | NOT NULL | 快照含标题 |
| content | jsonb | NOT NULL | 整份快照（反规范化 R3，版本管理本质） |
| source | varchar(20) | NOT NULL DEFAULT 'manual', CHECK IN ('manual','auto','rollback') | 手动保存 / 关键事件自动 / 回滚前快照 |
| created_by | uuid | NOT NULL FK→users | |
| created_at | timestamptz | NOT NULL | |

约束：`UNIQUE (note_id, version_no)`。
快照策略（已确认）：手动 + 关键事件（回滚前、编辑会话结束且有变更），不做纯定时。

### 3.12 share_links（分享链接表，论文 4.3.7）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | |
| note_id | uuid | NOT NULL FK→notes | |
| token | varchar(32) | NOT NULL, UNIQUE | nanoid，URL 中暴露的唯一凭证 |
| permission | varchar(20) | NOT NULL DEFAULT 'read', CHECK IN ('read','edit') | 访客权限（4.5.4） |
| expires_at | timestamptz | NULL | NULL=永久；5.6.3 有效期管理 |
| is_enabled | boolean | NOT NULL DEFAULT true | 随时停用，不等过期 |
| visit_count | int | NOT NULL DEFAULT 0 | 访问计数（演示好看） |
| created_by | uuid | NOT NULL FK→users | |
| created_at | timestamptz | NOT NULL | |

### 3.13 recycle_bin（回收站表，论文 4.3.8）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | uuid | PK | |
| note_id | uuid | NOT NULL FK→notes, UNIQUE | 一篇笔记至多一条记录 |
| original_owner_id | uuid | NOT NULL FK→users | 删除时刻快照（反规范化 R2） |
| original_folder_id | uuid | NULL | 恢复时放回原文件夹 |
| deleted_by | uuid | NOT NULL FK→users | |
| deleted_at | timestamptz | NOT NULL DEFAULT now() | |
| expires_at | timestamptz | NOT NULL | = deleted_at + 30 天，5.7.4 定时清理的扫描依据 |

设计说明：笔记本体**不搬家**（notes.deleted_at 软删），recycle_bin 只记"谁、何时、何时到期"。
恢复 = 清 deleted_at + 删本行；彻底清除 = 定时任务删 notes 行 + 本行。
理由：跨表搬运整行会打断 share_links / note_versions / attachments 对 note_id 的引用。

---

## 4. 范式分析与受控反规范化（论文 4.3 主动交代，防答辩翻车）

**1NF ✅**：所有属性原子。content JSONB 在关系层面是单值域（整份文档一个值），非重复组；
论文可写一段"JSONB 与 1NF 的辨析"作为加分点。

**2NF ✅**：全部单列代理主键，不存在部分函数依赖（note_tags 复合主键两列均为主属性）。

**3NF / BCNF ✅**：非主属性间无传递依赖。以下 4 处为**有意为之的受控反规范化**，
每处写明理由：

| # | 位置 | 冗余内容 | 理由 |
|---|---|---|---|
| R1 | notes.content_text | 由 content 派生 | 全文检索 GIN 索引的载体；服务层在保存时同步维护 |
| R2 | recycle_bin.original_owner_id 等 | 可经 note 回溯 | 记录**删除时刻**的历史事实；归属可能事后变更，且彻底清除后无从回溯 |
| R3 | note_versions.content | 整份快照 | 版本管理的本质就是空间换历史 |
| R4 | team_members 中的 owner 行 + teams.owner_id | 双重表达"谁是组长" | 统一"我的团队列表"查询路径，服务层保证一致 |

---

## 5. 索引设计（论文 4.3.5/4.3.9 可引用）

| 索引 | 表 | 用途 |
|---|---|---|
| idx_notes_owner | notes(owner_id, deleted_at) | 个人笔记列表（最高频） |
| idx_notes_team | notes(team_id, deleted_at) | 团队笔记列表 |
| idx_notes_folder | notes(folder_id) | 文件夹内笔记 |
| idx_yjs_note | yjs_updates(note_id, id) | CRDT 增量按序回放 |
| idx_versions_note | note_versions(note_id, version_no DESC) | 版本列表 |
| idx_share_note | share_links(note_id) | 笔记的分享链接列表 |
| idx_recycle_expires | recycle_bin(expires_at) | 定时清理扫描 |
| uq 团队邀请 | team_invitations(team_id, invitee_email) | 防重复邀请 |

> 中文检索说明（诚实原则，5.3.4 落地确认）：'simple' 分词器对中文无词级切分，
> tsvector 对中文子串匹配基本无效，故 5.3.4 实现直接采用 content_text 的
> ILIKE '%kw%'（通配符转义），GIN/tsvector 不再引入；zhparser 中文分词列入 7.3 改进方向。
> 设计稿中的 gin_notes_search 索引随之取消，论文 4.3/5.3.4 按实际实现表述。

---

## 6. 视图设计（4.3.9，进 docs/appendix-ddl.sql）

原则：**业务 CRUD 走基表（TypeORM），视图只服务只读查询与统计**——分层本身写进论文。

```sql
-- V1 语义基线：所有"未删除笔记"查询的统一入口
CREATE VIEW v_active_notes AS
  SELECT id, owner_id, team_id, folder_id, title, visibility, updated_at
  FROM notes WHERE deleted_at IS NULL;

-- V2 团队面板：列表 + 成员数 + 笔记数
CREATE VIEW v_team_overview AS
  SELECT t.id, t.name, t.owner_id,
         (SELECT count(*) FROM team_members m WHERE m.team_id = t.id) AS member_count,
         (SELECT count(*) FROM notes n
           WHERE n.team_id = t.id AND n.deleted_at IS NULL) AS note_count
  FROM teams t;

-- V3 回收站展示：含剩余天数（清理倒计时的计算收进数据库）
CREATE VIEW v_recycle_bin_items AS
  SELECT rb.id, rb.note_id, n.title, rb.original_owner_id, rb.deleted_by,
         rb.deleted_at, rb.expires_at,
         GREATEST(0, ceil(EXTRACT(EPOCH FROM (rb.expires_at - now())) / 86400)
         )::int AS days_remaining
  FROM recycle_bin rb JOIN notes n ON n.id = rb.note_id;

-- V4 版本首页：各笔记最新版本号
CREATE VIEW v_note_latest_version AS
  SELECT DISTINCT ON (note_id) note_id, version_no, created_at
  FROM note_versions ORDER BY note_id, version_no DESC;
```

---

## 7. Redis 键设计（论文 2.3.2 / 4.4，不进 DDL 但属于存储设计）

| 键模式 | 类型 | TTL | 用途 |
|---|---|---|---|
| `auth:refresh:{userId}:{jti}` | string | 7d | 刷新令牌白名单（会话管理） |
| `auth:denylist:{jti}` | string | ≤7d | 登出后的 access token 黑名单 |
| `cache:share:{token}` | string(json) | 60s | 分享链接元数据缓存，访客高频访问不打库 |
| `yjs:doc:{noteId}` | binary | 会话级 | 热文档缓存（Y-Websocket 内存优先，Redis 兜底，实现时可裁剪） |

---

## 8. RBAC 权限模型如何落表（论文 4.5，四角色 → 表字段）

| 大纲角色 | 判定条件（SQL 语义） |
|---|---|
| 个人用户 | notes.owner_id = me AND notes.team_id IS NULL |
| 团队管理员 | team_members.role IN ('owner','admin') |
| 团队成员 | team_members.role = 'member' + notes.visibility（team_read 只读 / team_edit 可写） |
| 访客 | share_links.token 有效（未过期 + is_enabled）→ permission 决定 read/edit |

---

## 9. 扩展预留（已做 / 不做）

- ✅ 已预留：UUID 主键（多端生成不冲突）、varchar+CHECK 枚举（易演进）、
  yjs_updates 追加日志（7.3.1 离线编辑的补传路径）、软删与回收站分离
- ❌ 不做：预留字段（反模式，答辩减分）；审计日志与登录设备管理（用户 2026-09-08 明确不加）；
  评论/收藏/AI 等大纲外功能（AGENTS §3 禁止）
