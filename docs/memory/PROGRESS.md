# 开发进度账本（PROGRESS）

> 当前状态：5.6 笔记分享模块完成（share_links + 访客公开页 + Redis 缓存 + 访客协作 WS 鉴权 + 播种竞态互斥锁修复，17 条用例全过，2 张截图）。下一步：5.7 版本管理与回收站（note_versions + 回收站界面 + 定时清理）。

## 状态图例

⬜ 未开始 / 🟨 进行中 / ✅ 完成（代码 + 截图 + 测试表齐全）

## 第5章 实现进度（主账本）

### 5.1 开发环境与工具
- ✅ 5.1.1 开发环境配置（拓扑 D-005；Mac node@22 + pnpm@11.25 已装，install/build 验证通过）
- ✅ 5.1.2 项目目录结构（pnpm workspace，见 README.md；截图待补）
- ✅ 5.1.3 Docker开发环境搭建（NAS postgres:15432 / redis:16379 已部署，Mac 侧 .env 连通验证通过 2026-09-08）

### 5.2 用户认证模块实现
- ✅ 5.2.1 注册功能实现（唯一性校验+bcrypt；用例 AUTH-01~05）
- ✅ 5.2.2 登录与JWT Token生成（jti+Redis 黑名单登出；用例 AUTH-06~07）
- ✅ 5.2.3 路由守卫与身份校验（JwtAuthGuard+RequireAuth+axios 拦截器；用例 AUTH-08~10）
- ✅ 5.2.4 界面展示与核心代码（截图 5.2.1/5.2.2/5.2.4；论文可引用：auth.service.ts、jwt.strategy.ts、AuthContext.tsx）

### 5.3 个人笔记管理模块实现
- ✅ 5.3.1 笔记的创建与编辑（notes CRUD + 800ms 防抖自动保存 + 软删进回收站；用例 NOTE-01~08）
- ✅ 5.3.2 Markdown实时预览（Tiptap input rules 即时渲染，见 D-008-2；界面见 5.3.2 截图）
- ✅ 5.3.3 笔记分类与文件夹管理（folders 树 + tags 双维度；用例 NOTE-13~22）
- ✅ 5.3.4 笔记搜索功能（content_text ILIKE + 通配符转义 + ?q= 深链；用例 NOTE-23~26）
- ✅ 5.3.5 界面展示与核心代码（截图 5.3.1~5.3.4 四张；论文可引用：notes.service.ts、prosemirror.util.ts、NoteEditorPanel.tsx、HomePage.tsx）

### 5.4 实时协作编辑模块实现
- ✅ 5.4.1 WebSocket服务端实现（y-websocket setupWSConnection 挂 Nest HTTP server，/ws/:noteId，握手 JWT+归属校验；用例 COLLAB-01~04）
- ✅ 5.4.2 Yjs前端集成（Collaboration 扩展 + WebsocketProvider，正文改由 Yjs 驱动、服务端会话结束合并回写快照；用例 COLLAB-05~10）
- ✅ 5.4.3 多用户光标同步（CollaborationCursor + awareness，在线人数/光标姓名标签；用例 COLLAB-12~14）
- ✅ 5.4.4 冲突合并与一致性保证（Node 双客户端并发编辑收敛验证 A===B；防误清保护；用例 COLLAB-11）
- ✅ 5.4.5 界面展示与核心代码（截图 5.4.2/5.4.3/5.4.4；论文可引用：collaboration.persistence.ts、realtime.service.ts、yjs-convert.ts、NoteEditorPanel.tsx）

### 5.5 团队协作模块实现
- ✅ 5.5.1 团队的创建与管理（teams CRUD + R4 owner 双写 + 成员角色/移除/退队；用例 TEAM-01~07）
- ✅ 5.5.2 团队成员邀请与审批（邮箱邀请 7 天有效 + 旧行复用 + 接受/拒绝/撤回；用例 TEAM-08~12）
- ✅ 5.5.3 团队笔记权限分配（四级访问 owner/team_admin/team_edit/team_read + 可见性管理 + WS 权限对齐；用例 TEAM-13~22）
- ✅ 5.5.4 界面展示与核心代码（截图 5.5.1~5.5.4；论文可引用：teams.service.ts（RBAC 集中实现）、realtime.service.ts（WS 权限）、TeamManageModal.tsx）

### 5.6 笔记分享模块实现
- ✅ 5.6.1 分享链接生成（share_links 实体 + crypto 32 位 token + 权限/有效期选择；用例 SHARE-01~04）
- ✅ 5.6.2 链接访问权限控制（公开接口统一 404 防枚举 + Redis 60s 缓存 + 访客 edit 链接进 Yjs 协作；用例 SHARE-05~15）
- ✅ 5.6.3 分享链接有效期管理（expires_at NULL=永久 + is_enabled 即时停用 + 缓存失效联动；用例 SHARE-08~12）
- ✅ 5.6.4 界面展示与核心代码（截图 5.6.1/5.6.2；论文可引用：share.service.ts（缓存与解析）、realtime.service.ts（访客 WS 鉴权）、SharePage.tsx、ShareModal.tsx）

### 5.7 版本管理与回收站实现
- ⬜ 5.7.1 版本历史记录
- ⬜ 5.7.2 版本回滚与恢复
- ⬜ 5.7.3 回收站与软删除
- ⬜ 5.7.4 定时清理机制
- ⬜ 5.7.5 界面展示与核心代码

### 5.8 笔记导出功能实现
- ⬜ 5.8.1 导出为PDF
- ⬜ 5.8.2 导出为Markdown
- ⬜ 5.8.3 界面展示与核心代码

### 5.9 系统部署实现
- ⬜ 5.9.1 Docker镜像构建
- ⬜ 5.9.2 Docker Compose服务编排
- ⬜ 5.9.3 部署脚本与一键启动

## 待讨论 / 阻塞

（无）

## 论文可引用核心代码（随进度补充）

- 5.2 认证：`apps/server/src/modules/auth/auth.service.ts`（注册/登录/黑名单登出）、`strategies/jwt.strategy.ts`、`apps/web/src/auth/AuthContext.tsx`
- 5.3 笔记管理：`apps/server/src/modules/notes/notes.service.ts`（CRUD/搜索/越权防护）、`prosemirror.util.ts`（JSONB→纯文本派生）、`folder.entity.ts`（自引用+唯一索引）、`apps/web/src/components/notes/NoteEditorPanel.tsx`（Tiptap 集成）、`apps/web/src/pages/HomePage.tsx`（三栏工作台+防抖自动保存）
- 5.4 实时协作：`apps/server/src/modules/realtime/collaboration.persistence.ts`（增量回放/播种/合并回写/压缩/防误清）、`realtime.service.ts`（upgrade 握手鉴权）、`yjs-convert.ts`（PM JSON→Yjs 播种）、`apps/web/src/components/notes/NoteEditorPanel.tsx`（Collaboration+Cursor+awareness）
- 5.5 团队协作：`apps/server/src/modules/teams/teams.service.ts`（RBAC 集中：assertRole/邀请生命周期/可见性过滤）、`notes.service.ts` 的 getAccessLevel（四级笔记访问矩阵）、`apps/web/src/components/teams/TeamManageModal.tsx`
- 5.6 笔记分享：`apps/server/src/modules/share/share.service.ts`（token 解析/Redis 缓存/防枚举 404）、`realtime.service.ts`（访客 share-token WS 鉴权）、`collaboration.persistence.ts`（按笔记互斥锁防播种竞态）、`apps/web/src/pages/SharePage.tsx`（访客公开页）
