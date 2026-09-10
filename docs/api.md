# 接口文档（论文附录 C）

> 与代码同步维护。分组对应大纲 4.6：认证 / 笔记 / 团队 / WebSocket 事件。
> Base URL：`http://localhost:13000/api`（全局前缀 `/api`）
> 错误响应统一为 `{ statusCode, message }`；message 为数组时表示字段校验失败（class-validator）。

## 一、认证接口（论文 4.6.1 / 5.2）

### POST /auth/register —— 注册

| 项 | 说明 |
|---|---|
| 权限 | 公开 |
| Body | `{ "email": "you@example.com", "username": "演示用户", "password": "至少8位且含字母数字" }` |
| 校验 | email 格式；username 3-50 位（字母/数字/下划线/中文/连字符）；密码 8-32 位且同时含字母和数字 |
| 201 | 脱敏用户对象：`{ "id", "email", "username", "avatar_url" }` |
| 409 | 邮箱已被注册 / 用户名已被占用 |
| 400 | 字段校验失败 |

### POST /auth/login —— 登录（论文 5.2.2 JWT 签发）

| 项 | 说明 |
|---|---|
| 权限 | 公开 |
| Body | `{ "email", "password" }` |
| 200 | `{ "access_token": "<JWT>", "user": { id, email, username, avatar_url } }` |
| 401 | 邮箱或密码错误（统一文案，防用户枚举） |

JWT 载荷：`{ sub: <user_id>, username, jti: <uuid>, iat, exp }`，HS256，有效期 `JWT_EXPIRES_IN`（默认 7d）。

### POST /auth/logout —— 登出

| 项 | 说明 |
|---|---|
| 权限 | 需登录（Bearer Token） |
| 200 | `{ "success": true }`——当前 token 的 jti 写入 Redis 黑名单至其自然过期（键 `auth:denylist:{jti}`，D-007 §7） |
| 401 | 未认证 |

### GET /users/me —— 当前用户信息

| 项 | 说明 |
|---|---|
| 权限 | 需登录 |
| 200 | `{ id, email, username, avatar_url }` |
| 401 | 未认证 / token 已拉黑 / 用户不存在 |

## 二、笔记接口（论文 4.6.2 / 5.3）

> 全部需登录（Bearer Token）。5.3 阶段仅个人空间：`team_id` 恒为 NULL，
> 越权访问他人笔记一律 404（不暴露存在性）。
> 笔记正文 `content` 为 ProseMirror 文档 JSON（JSONB）；`content_text` 为服务端派生的纯文本列，供搜索。

### POST /notes —— 新建笔记

| 项 | 说明 |
|---|---|
| Body | `{ "title": "默认'未命名笔记'", "folder_id": "可选", "content": {ProseMirror JSON, 可选} }` |
| 201 | 笔记完整对象（含 content / content_text） |
| 400 | 字段校验失败（title ≤200 字等） |

### GET /notes —— 列表 / 搜索（5.3.4）

| 项 | 说明 |
|---|---|
| Query | `folder_id`（特殊值 `root` = 未归档）、`tag_id`、`keyword`（标题与 content_text 的 ILIKE 子串匹配，`%`/`_` 已转义） |
| 200 | `[{ id, title, folder_id, created_at, updated_at }]`，按 updated_at 倒序；软删笔记恒不过滤出 |

### GET /notes/:id —— 详情

| 项 | 说明 |
|---|---|
| 200 | 笔记完整对象 |
| 404 | 不存在 / 非本人 / 已删除 / 团队笔记 |

### PATCH /notes/:id —— 部分更新（前端自动保存）

| 项 | 说明 |
|---|---|
| Body | `{ "title?", "content?", "folder_id? }`（folder_id 传 null 表示移出文件夹） |
| 200 | 更新后的笔记；content 变更时服务端重算 content_text |
| 400 / 404 | 校验失败 / 文件夹不存在或非本人 |

### DELETE /notes/:id —— 软删除（进回收站，5.7.3）

| 项 | 说明 |
|---|---|
| 200 | `{ "success": true }`；置 deleted_at 并写入 recycle_bin（expires_at = 删除 + 30 天） |
| 404 | 不存在 / 已删除 |

### 标签子资源

| 接口 | 说明 |
|---|---|
| GET /notes/:id/tags | 笔记的标签列表 `[{ id, name, color }]` |
| PUT /notes/:id/tags | Body `{ "tag_id" }`，幂等打标；标签须归属本人 |
| DELETE /notes/:id/tags/:tagId | 摘标签 |

### GET /folders —— 文件夹（5.3.3）

| 接口 | Body/Query | 说明 |
|---|---|---|
| POST /folders | `{ "name", "parent_id?" }` | 平铺列表；同级重名 400 |
| GET /folders | —— | 平铺数组，前端组装树 |
| PATCH /folders/:id | `{ "name?", "parent_id? }` | 重命名/移动；移入自己子孙目录 400（防成环） |
| DELETE /folders/:id | —— | 仅允许删除空文件夹（无子文件夹且无笔记），否则 400 |

### GET /tags —— 标签（5.3.3）

| 接口 | Body | 说明 |
|---|---|---|
| POST /tags | `{ "name", "color?" }`（#RRGGBB） | 同名 400 |
| GET /tags | —— | `[{ id, name, color, note_count }]`（只统计未删除笔记） |
| DELETE /tags/:id | —— | 级联清理 note_tags 关联 |

## 三、团队接口（论文 4.6.3 / 5.5）

> RBAC 三角色（论文 4.5.1/4.5.3）：owner（创建者，全部权限）/ admin（管理员，成员与笔记管理）/
> member（成员，退队 + 看非私有 + 编辑 team_edit 笔记）。权限校验失败 403，目标不可见一律 404。

### 团队 CRUD（5.5.1）

| 接口 | 权限 | 说明 |
|---|---|---|
| POST /teams | 登录 | `{ "name", "description?" }`；创建者自动写入 team_members(role=owner)（R4 双写） |
| GET /teams | 登录 | 我参与的团队：`[{ id, name, my_role, is_owner, member_count, note_count }]` |
| PATCH /teams/:id | owner/admin | 改名/描述 |
| DELETE /teams/:id | owner | 解散；仍有笔记 → 400（防误删，与文件夹同策略） |

### 成员管理（5.5.1）

| 接口 | 权限 | 说明 |
|---|---|---|
| GET /teams/:id/members | 成员 | `[{ user_id, username, email, role, joined_at }]`（owner 在前） |
| PATCH /teams/:id/members/:userId | owner | `{ "role": "admin"\|"member" }`；不可改创建者角色 |
| DELETE /teams/:id/members/:userId | owner/admin/本人 | 移除成员；传自己 userId = 退队；创建者不可被移除 |

### 邀请与审批（5.5.2）

| 接口 | 权限 | 说明 |
|---|---|---|
| POST /teams/:id/invitations | owner/admin | `{ "email" }`；有效期 7 天；重复 pending → 400；非 pending 旧行复用（重置 pending），满足 UNIQUE(team_id, invitee_email) |
| GET /teams/:id/invitations | owner/admin | 团队邀请记录 |
| POST /teams/:id/invitations/:iid/cancel | owner/admin | 撤回（status→cancelled） |
| GET /teams/invitations/mine | 登录 | 我收到的待处理邀请（按邮箱或关联 id 匹配，未过期） |
| POST /teams/invitations/:iid/accept | 收件人 | pending + 未过期 → 插入 team_members(role=member)，status→accepted |
| POST /teams/invitations/:iid/decline | 收件人 | status→declined |

### 团队笔记（5.5.3，论文 4.5.2 笔记级权限）

| 接口 | 权限 | 说明 |
|---|---|---|
| POST /notes | 任意成员 | Body 带 `team_id` + `visibility`（private/team_read/team_edit，默认 private）；团队笔记 folder_id 必须为空（CHECK 约束） |
| GET /teams/:id/notes?keyword= | 任意成员 | owner/admin 见全部；member 见 非私有 + 自己创建的 |
| GET /notes/:id | 访问矩阵 | owner > team_admin > team_edit（可编辑）> team_read（只读）；不可见 → 404 不暴露存在性 |
| PATCH /notes/:id `visibility` | 笔记 owner / 团队 owner+admin | 其余字段编辑权限到 team_edit 为止 |
| DELETE /notes/:id | 笔记 owner / 团队 owner+admin | 软删除进回收站 |

实时协作连接权限与上表编辑权限对齐：owner / 团队 owner+admin / visibility=team_edit 的成员可连
`/ws/:noteId`；team_read、无权限成员连接被 401 拒绝（y-websocket 无法限制只读写穿，防"只读成员改数据"）。

## 三B、版本与回收站接口（论文 5.7）

### 版本（需登录；查看=任意可见成员，编辑=可编辑级别，5.7.1/5.7.2）

| 接口 | 说明 |
|---|---|
| POST /notes/:id/versions | 手动保存当前状态为版本（source=manual，version_no 笔记内递增） |
| GET /notes/:id/versions | 版本列表（version_no/title/source/created_at，倒序） |
| GET /notes/:id/versions/:versionNo | 快照详情（含 content，预览用） |
| POST /notes/:id/versions/rollback | Body `{ "version_no" }`；回滚前当前状态自动存为 source=rollback 版本 |

快照来源三态：`manual` 手动 / `auto` 编辑会话结束且有变更（服务端 writeState 自动，D-007 策略④）/
`rollback` 回滚前。回滚的两种路径：热文档（有协作会话）以 CRDT 操作实时生效；冷文档直接回写快照并作废旧增量帧。

### 回收站（仅本人，5.7.3）

| 接口 | 说明 |
|---|---|
| GET /recycle-bin | `[{ id, note_id, title, deleted_at, expires_at, days_remaining }]` |
| POST /recycle-bin/:id/restore | 清 deleted_at 并放回原文件夹（原文件夹已删则保持未归档） |
| DELETE /recycle-bin/:id | 彻底删除：版本/分享/标签/协作增量经外键级联一并清除 |

定时清理（5.7.4）：每小时 + 启动时扫描，回收站到期（删除+30 天）彻底清除，过期团队邀请置 expired。

## 三A、分享接口（论文 5.6 / 4.3.7 share_links）

### 管理（需登录；分享权限 = 笔记 owner 或团队 owner/admin，5.6.1）

| 接口 | Body/Query | 说明 |
|---|---|---|
| POST /share | `{ "note_id", "permission": "read"\|"edit", "expires_at?": ISO8601 }` | 生成 32 位随机 token；expires_at 缺省 = 永久（5.6.3） |
| GET /share?note_id= | —— | 该笔记的链接列表（含 visit_count） |
| PATCH /share/:id | `{ "permission?", "expires_at?" }` | 改权限/改期；变更即时失效 Redis 缓存 |
| PATCH /share/:id/enabled | `{ "is_enabled": bool }` | 停用/恢复，不等过期 |
| DELETE /share/:id | —— | 删除链接 |

### 访客公开接口（无需登录，5.6.2）

| 接口 | 说明 |
|---|---|
| GET /api/public/share/:token | 元数据 `{ note_id, title, permission, expires_at }`；Redis 缓存 60s（`cache:share:{token}`）；停用/过期/笔记已删/伪造 → 统一 404 防枚举 |
| GET /api/public/share/:token/content | 正文快照，visit_count +1（不缓存，实时可见） |

### 访客实时协作（5.6.2，论文 4.5.4）

- `WS /ws/:noteId?share=<token>`：JWT 校验失败时回落到分享 token 校验——
  token 有效且 `permission=edit` 才放行（只读链接拒绝，防写穿）。
- 访客与登录用户进入同一 Yjs 文档实时协作（前端公开页 /s/:token）。

## 四、WebSocket 事件（论文 4.6.4 / 5.4）

### 连接建立

| 项 | 说明 |
|---|---|
| 地址 | `ws://<host>/ws/{noteId}?token=<JWT>`（开发期经 Vite 代理 `/ws`；生产经 nginx 反代） |
| 鉴权 | upgrade 握手期校验 JWT + 笔记归属（浏览器 WebSocket 无法带请求头，token 走查询参数）；失败返回 HTTP 401 并关闭 |
| 权限 | 5.4 阶段仅个人笔记 owner 本人；团队笔记权限在 5.5 扩展 |
| 协议 | y-websocket 协议（y-protocols/sync + awareness），二进制消息 |

### 消息类型（y-protocols 二进制协议）

| type | 名称 | 方向 | 说明 |
|---|---|---|---|
| 0 | Sync | 双向 | 同步步1（交换状态向量）/ 同步步2（差量）/ 实时增量广播——CRDT 收敛由 Yjs YATA 算法保证（5.4.4） |
| 1 | Awareness | 双向 | 用户感知状态（光标位置、姓名、颜色）——多光标与在线列表的数据源（5.4.3） |

### 感知状态（Awareness State）

```json
{ "user": { "name": "演示用户", "color": "#1677ff" }, "cursor": "<相对位置>" }
```

### 服务端持久化行为（D-007 增量/快照分工，论文 4.4.2）

- 连接期间：每帧增量缓冲 2s 合并写入 `yjs_updates`（bytea，追加式）
- 打开文档：按自增序回放 `yjs_updates`；无帧则从 `notes.content` 快照播种并存种子帧
- 末个连接断开：Yjs 文档合并回写 `notes.content` + `content_text`，并压缩（compaction）已合并增量行；
  "会话文档为空且库中快照非空"时跳过回写（防误清保护）
