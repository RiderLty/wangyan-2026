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

## 三、团队接口（5.5，待实现）

## 四、WebSocket 事件（4.6.4 / 5.4，待实现）
