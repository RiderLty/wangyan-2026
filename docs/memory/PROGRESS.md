# 开发进度账本（PROGRESS）

> 当前状态：第 6 章素材整编完成（6.2.7 汇总 121 用例 100% 通过 + 6.3 性能实测：读接口 avg 5.3ms / 200 WS 并发 100% / 编辑延迟 avg 0.8ms，脚本入库可复现）。**编码与测试素材全部就绪**，2026-09-15 完成工作台布局优化（编辑器主体化 + 专注模式，见 CHANGELOG）；下一步：论文撰写（按大纲逐章，素材索引见各测试表头部）；5.3.5 截图需按新版式重截；git push nas 由用户执行。

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
- ✅ 5.3.5 界面展示与核心代码（截图 5.3.1~5.3.4 四张；论文可引用：notes.service.ts、prosemirror.util.ts、NoteEditorPanel.tsx、HomePage.tsx）※2026-09-15 布局优化：编辑器主体化（中栏 216px/编辑区 1000px）+ 专注模式（编辑器独占整页，Esc 退出），截图待按新版式重截

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
- ✅ 5.7.1 版本历史记录（note_versions 三态来源 manual/auto/rollback；writeState 会话结束有变更自动建版；用例 VER-01~03/06）
- ✅ 5.7.2 版本回滚与恢复（热文档=CRDT 清空重建实时生效，冷文档=回写快照作废帧；回滚前自动快照；用例 VER-04/05/07/08）
- ✅ 5.7.3 回收站与软删除（列表含剩余天数/恢复放回原文件夹/彻底删除级联；用例 BIN-01~04）
- ✅ 5.7.4 定时清理机制（@nestjs/schedule 每小时+启动扫描：到期回收彻底清除、过期邀请置 expired；用例 CLN-01~03）
- ✅ 5.7.5 界面展示与核心代码（截图 5.7.1/5.7.3；论文可引用：versions.service.ts（CRDT 回滚双路径）、collaboration.persistence.ts（自动建版）、cleanup.service.ts、VersionDrawer.tsx）

### 5.8 笔记导出功能实现
- ✅ 5.8.1 导出为PDF（前端打印视图 /print/:noteId + 自动调起系统打印，用户指定前端方案 D-012；真实产物 docs/assets/5.8.1-export.pdf；用例 EXP-03/04）
- ✅ 5.8.2 导出为Markdown（tiptap-markdown 序列化 ProseMirror JSON，与编辑器同 schema；真实产物 docs/assets/5.8.2-export.md；用例 EXP-01/02）
- ✅ 5.8.3 界面展示与核心代码（截图 5.8.3-export-menu.png；论文可引用：utils/export.ts、PrintPage.tsx）

### 5.9 系统部署实现
- ✅ 5.9.1 Docker镜像构建（NAS 本机构建原生 amd64：wangyan-server 330MB / wangyan-web 70.7MB；vite manualChunks 分包修掉 1.3MB 单块；用例 DEP-01~03）
- ✅ 5.9.2 Docker Compose服务编排（compose 四服务 + 健康检查 + restart 策略，docs/appendix-compose.yml 即附录 B；生产 NAS 无 compose 插件故用 docker run，论文如实说明；用例 DEP-06~09 即编排产物验证）
- ✅ 5.9.3 部署脚本与一键启动（nas-app-setup.sh docker run 部署存档；compose 一键启动见 README；端到端 DEP-04~09 全过 + 部署页截图）

## 待讨论 / 阻塞

- [ ] 第 6 章性能数据已实测（perf.md）；6.4 兼容性表留 Safari/Firefox 人工复核项，答辩前建议用户用常用浏览器过一遍
- [ ] 论文撰写阶段的图（架构/ER/流程）文字底稿在 docs/diagrams/，需用户画图

## 性能测试脚本（可复现）

- `scripts/perf/api-latency.mjs`（6.3.1 接口响应）、`scripts/perf/ws-concurrent.mjs`（6.3.2 并发）、`scripts/perf/edit-latency.mjs`（6.3.3 编辑延迟）——对部署系统运行，数据见 docs/testing/perf.md

## 论文可引用核心代码（随进度补充）

- 5.2 认证：`apps/server/src/modules/auth/auth.service.ts`（注册/登录/黑名单登出）、`strategies/jwt.strategy.ts`、`apps/web/src/auth/AuthContext.tsx`
- 5.3 笔记管理：`apps/server/src/modules/notes/notes.service.ts`（CRUD/搜索/越权防护）、`prosemirror.util.ts`（JSONB→纯文本派生）、`folder.entity.ts`（自引用+唯一索引）、`apps/web/src/components/notes/NoteEditorPanel.tsx`（Tiptap 集成）、`apps/web/src/pages/HomePage.tsx`（三栏工作台+防抖自动保存）
- 5.4 实时协作：`apps/server/src/modules/realtime/collaboration.persistence.ts`（增量回放/播种/合并回写/压缩/防误清）、`realtime.service.ts`（upgrade 握手鉴权）、`yjs-convert.ts`（PM JSON→Yjs 播种）、`apps/web/src/components/notes/NoteEditorPanel.tsx`（Collaboration+Cursor+awareness）
- 5.5 团队协作：`apps/server/src/modules/teams/teams.service.ts`（RBAC 集中：assertRole/邀请生命周期/可见性过滤）、`notes.service.ts` 的 getAccessLevel（四级笔记访问矩阵）、`apps/web/src/components/teams/TeamManageModal.tsx`
- 5.6 笔记分享：`apps/server/src/modules/share/share.service.ts`（token 解析/Redis 缓存/防枚举 404）、`realtime.service.ts`（访客 share-token WS 鉴权）、`collaboration.persistence.ts`（按笔记互斥锁防播种竞态）、`apps/web/src/pages/SharePage.tsx`（访客公开页）
- 5.7 版本与回收站：`apps/server/src/modules/notes/versions.service.ts`（三态快照+CRDT 回滚双路径）、`collaboration.persistence.ts` writeState（自动建版）、`recycle-bin/cleanup.service.ts`（定时清理）、`apps/web/src/components/notes/VersionDrawer.tsx`
- 5.8 笔记导出：`apps/web/src/utils/export.ts`（Markdown 序列化/下载/打印视图入口）、`apps/web/src/pages/PrintPage.tsx`（PDF 打印排版）
- 5.9 部署：`apps/server/Dockerfile` + `apps/web/Dockerfile` + `apps/web/nginx.conf.template`（envsubst 模板）、`docker-compose.yml`、`nas-app-setup.sh`（部署存档）、`docs/appendix-ddl.sql` / `docs/appendix-compose.yml`
