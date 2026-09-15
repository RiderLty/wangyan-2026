# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 必读规则（最高优先级）

**任何工作开始前，先完整阅读 `AGENTS.md` 并严格遵守。** 要点（详见 AGENTS.md 原文，冲突以原文为准）：

- 编码前依次读：`AGENTS.md` → `docs/memory/` 三件套（PROGRESS / DECISIONS / CHANGELOG）→ `docs/THESIS_OUTLINE.md` 对应章节
- 开工前输出一行进度简报；收工前必须更新三件套 + 产出论文素材（截图 / 测试表），否则视为未完成
- 功能范围 = 论文大纲 3.3 的七个模块 + 5.8 导出 + 5.9 部署，禁止私自增删
- §2.1 锁定技术栈不可更换；新增依赖须在 CHANGELOG 记录理由，禁止与现有依赖重叠
- 遇到规则未约定的重要决策，先问用户

## 常用命令

```bash
pnpm install            # 安装依赖（pnpm workspace）
pnpm dev                # 前后端并行开发（web :5173，server :13000）
pnpm dev:web            # 仅前端
pnpm dev:server         # 仅后端（nest --watch）
pnpm build              # 全量构建（web 构建含 tsc --noEmit 类型检查）

pnpm up                 # docker compose 一键拉起 postgres+redis+server+web（:18080）
pnpm down               # 停止并移除 compose 服务
pnpm db:up / db:down    # 只起/停本地 postgres + redis 容器
```

- **无 lint / test 脚本**：本项目按 AGENTS.md §4 不追求测试覆盖率，验证方式是 `docs/testing/` 下的功能用例表 + 性能测试脚本，不引入测试框架。
- 环境变量来自根目录 `.env`（模板 `.env.example`）。Mac 开发模式下数据库连 NAS（192.168.3.3 的 15432/16379），本地无需容器。
- `docker compose up` 是论文 5.9 的演示硬指标；NAS 生产部署用 `nas-app-setup.sh`（docker run，无 compose 插件），两套方式并存，见 README。

## 架构

pnpm workspace 三包结构：

| 包 | 说明 |
|---|---|
| `apps/web` | React 18 + TS + Antd + Vite。编辑器用 **Tiptap**（决策 D-008，禁止再装 Vditor），Markdown 渲染靠 tiptap-markdown |
| `apps/server` | NestJS 模块化单体（TypeORM + PostgreSQL + Redis + JWT）。**不是微服务**，论文按"模块化设计"表述 |
| `packages/shared` | 前后端共享类型/常量（`@app/shared`，workspace 依赖） |

- **server 模块**（`apps/server/src/modules/`）：auth（注册/登录/JWT+Redis 黑名单登出）、users、notes（CRUD+搜索+ folders/tags）、recycle-bin（软删回收站）、teams（团队协作）、share（访客分享链接）、realtime（Yjs WebSocket，挂 `/ws/:noteId`，握手时校验 JWT 与笔记归属）
- **web 页面**（`apps/web/src/pages/`）：Login/Register、Home（笔记管理 + 协作编辑主界面）、Share（访客视角）、Print（5.8 PDF 导出打印视图，纯前端）
- **实时协作**：Yjs CRDT，服务端用 y-websocket 的 `setupWSConnection` 挂在 Nest HTTP server 上，笔记正文以 JSONB 存储
- 端口约定：PostgreSQL 15432 / Redis 16379 / server 13000 / web 18080（5432/6379/3000 在 NAS 上被占用）

## 关键文档位置

- `docs/THESIS_OUTLINE.md` —— 论文大纲（冻结，禁止修改）；功能范围以它为准
- `docs/memory/` —— 三件套，每次收工必须更新（格式见 AGENTS.md §5）
- `docs/api.md` —— 接口文档（论文附录 C），接口写完同步维护
- `docs/appendix-ddl.sql` / `docs/appendix-compose.yml` —— 论文附录 A/B，表结构与 compose 定稿后导出
- `docs/assets/` —— 界面截图（`<小节号>-<名称>.png`，必须是真实运行界面）
- `docs/testing/` —— 功能用例表与性能数据（第 6 章素材）
