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

## 二、笔记接口（5.3，待实现）

## 三、团队接口（5.5，待实现）

## 四、WebSocket 事件（4.6.4 / 5.4，待实现）
