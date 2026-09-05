# 技术决策记录（DECISIONS）

> 追加式，编号递增，禁止删除旧条目。已定的决策不许无故推翻；要推翻，新增一条说明原因。
> "理由"一栏请写充分些——以后可以直接搬进论文。

## D-000：技术栈核心锁定

- 日期：2026-09-05
- 背景：论文大纲第 2 章已按固定技术栈撰写，实现必须与论文一致。
- 选项：锁定 vs 放开
- 决定：核心锁定——React 18 + TypeScript + Ant Design / NestJS / PostgreSQL(JSONB) / Redis / Yjs + WebSocket / JWT / Docker + Docker Compose。
- 理由：论文第 2 章逐一介绍了这些技术，若实现与论文不符会造成答辩硬伤；Yjs（CRDT）是实时协作的核心卖点（论文 7.2.1）。
- 影响论文小节：第2章全部、4.1.1、7.2.1

## D-001：Markdown 编辑器选型（Tiptap vs Vditor）

- 日期：2026-09-05
- 背景：大纲 2.1.3 需要选型对比，实现必须用选中的那一个，禁止两个都装。
- 选项：Tiptap（基于 ProseMirror，Headless，配合 Yjs 生态成熟）/ Vditor（开箱即用，中文文档友好，三种编辑模式）
- 决定：**Tiptap**
- 理由：本项目核心卖点是 CRDT 实时协作（论文 7.2.1），Tiptap 基于 ProseMirror，官方提供 y-prosemirror 集成，与 Yjs/Awareness（多光标）生态成熟，协作实现路径最短；Vditor 虽开箱即用但与 Yjs 集成缺乏成熟方案，实时协作是其短板。对比本身可直接写进论文 2.1.3。
- 影响论文小节：2.1.3、5.3.1、5.3.2、5.4.2

## D-002：ORM 选型（TypeORM vs Prisma）

- 日期：2026-09-05
- 背景：NestJS 后端需要 ORM 访问 PostgreSQL。
- 选项：TypeORM（NestJS 官方集成好，装饰器风格与 NestJS 一致）/ Prisma（类型安全强，schema 即文档）
- 决定：**TypeORM**
- 理由：@nestjs/typeorm 是 NestJS 官方集成，实体用装饰器定义，与 NestJS 依赖注入风格一致，代码样例在论文 5 章中更易讲解；JSONB 列支持成熟（论文 2.3.1 要求用 JSONB 存笔记正文）；synchronize 模式便于开发期建表，最终导出 DDL 作附录 A。
- 影响论文小节：2.3.1、4.3、5.1.2

## D-003：项目组织方式（monorepo）

- 日期：2026-09-05
- 背景：前后端分离，需约定仓库结构。
- 选项：pnpm workspace monorepo（apps/web + apps/server）/ 两个独立仓库 / 单仓简单分目录
- 决定：**pnpm workspace monorepo**（apps/web + apps/server + packages/shared）
- 理由：一套脚本管理前后端；packages/shared 放前后端共用的 TS 类型与 DTO，避免接口定义手写两遍对不上；目录结构本身可作为论文 5.1.2 的素材。
- 影响论文小节：5.1.2

## D-005：开发/部署拓扑（NAS 数据库 + Mac 开发）

- 日期：2026-09-05
- 背景：原 LXC 容器（NAS 内）根文件系统为 shfs（FUSE）、Docker 存储驱动为 vfs，IO 极慢；用户要求不破坏 NAS 环境；演示仅需 PPT 截图。
- 选项：LXC 内开发 / 全容器化 / NAS 常驻数据库容器 + Mac 原生开发
- 决定：**NAS（192.168.3.3）用两条 docker run 部署 postgres:16-alpine(:15432) 与 redis:7-alpine(:16379)，数据根目录 /mnt/user/appdata/wangyan-2026/；Mac mini（192.168.3.177，Apple Silicon）原生跑 Node 开发（无容器）；代码经 NAS 上的 bare 仓库（/mnt/user/storage/Projects/wangyan-2026.git）同步**。
- 理由：NAS 7×24 在线适合常驻数据库，Mac 开发体验最好；LXC 的 shfs+vfs 组合不适合开发也不适合构建；高位端口因 NAS 已被占用（原生 postgres 5432、redis 6379、neko-master 3000）；数据集中一个目录便于迁移备份，docker rm -f 即完全清除。
- 附件：部署命令存档于根目录 `nas-db-setup.sh`（⚠️ 含密码，禁止公开）；NAS Docker 24.0.9 无 compose 插件，故不用 compose 部署。
- 状态：**容器尚未部署**（用户要求手动执行脚本），Mac 工具链（brew/node/pnpm）尚未安装。
- 影响论文小节：2.5、5.1.1、5.1.3、5.9

## D-004：目录组织与 Docker 编排方案

- 日期：2026-09-05
- 背景：脚手架搭建前需确定前后端、数据库、Docker 的组织方式（用户已确认）。
- 选项：详见本次会话讨论（单体分目录 vs workspace 分包；compose 单文件 vs 分 dev/prod）
- 决定：
  - `apps/web`（React 18 + Vite + TS + Antd），页面按论文模块分目录，Yjs 协作逻辑独立为 `src/collaboration/` 层；
  - `apps/server`（NestJS 模块化单体），`src/modules/` 下一个目录 = 论文一个模块：auth / users / notes / realtime / teams / share / versions / recycle-bin / export；
  - `packages/shared`：前后端共享类型；
  - 数据库不单独建应用：PostgreSQL、Redis 是 compose 服务 + 数据卷，表结构以 TypeORM 实体为唯一事实来源；
  - Docker：单份 `docker-compose.yml` 编排 4 服务（postgres / redis / server / web），server 与 web 各写多阶段构建 Dockerfile，web 生产镜像内用 nginx 托管；开发期仅容器化 db/redis，前后端本地跑热重载。
- 理由：模块目录与论文小节一一对应，"论文可引用代码"的映射天然成立；compose 单文件配合多阶段构建即可同时满足开发与"一键启动"演示（论文 5.9）。
- 影响论文小节：4.1.1、4.1.3、5.1.2、5.1.3、5.9、附录B
