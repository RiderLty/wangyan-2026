# 开发进度账本（PROGRESS）

> 当前状态：5.3 个人笔记管理完成（folders/notes/tags/note_tags/recycle_bin 五表落地 + Tiptap 三栏工作台 + 搜索，26 条用例全过，4 张截图）。下一步：5.4 实时协作编辑（WebSocket 服务端 + Yjs 前端集成 + 多光标）。

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
- ⬜ 5.4.1 WebSocket服务端实现
- ⬜ 5.4.2 Yjs前端集成
- ⬜ 5.4.3 多用户光标同步
- ⬜ 5.4.4 冲突合并与一致性保证
- ⬜ 5.4.5 界面展示与核心代码

### 5.5 团队协作模块实现
- ⬜ 5.5.1 团队的创建与管理
- ⬜ 5.5.2 团队成员邀请与审批
- ⬜ 5.5.3 团队笔记权限分配
- ⬜ 5.5.4 界面展示与核心代码

### 5.6 笔记分享模块实现
- ⬜ 5.6.1 分享链接生成
- ⬜ 5.6.2 链接访问权限控制
- ⬜ 5.6.3 分享链接有效期管理
- ⬜ 5.6.4 界面展示与核心代码

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
