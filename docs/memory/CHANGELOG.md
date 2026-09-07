# 变更流水（CHANGELOG）

## [2026-09-08] NAS 数据库容器部署与验证（5.1.3 完成）

- 做了什么：
  - 经用户授权，代为在 NAS（192.168.3.3）执行 nas-db-setup.sh：wangyan-postgres（postgres:16-alpine，:15432）与 wangyan-redis（redis:7-alpine，:16379）均已 up，`--restart unless-stopped`
  - 数据落在 D-006 新目录 /mnt/user/storage/Projects/wangyan-2026-db-data/{postgres,redis}，已确认有实际数据写入
  - NAS 侧验证：pg_isready accepting connections ✅、redis-cli PING → PONG ✅
  - Mac 侧端到端验证（用 workspace 内 pg/ioredis 走 .env 凭据）：PostgreSQL 16.15 连通 + JSONB 查询 OK ✅、Redis PING/SET/GET/DEL roundtrip ✅
  - 修复 nas-db-setup.sh 验证段：原脚本容器刚起就 pg_isready 必失败且 set -e 会跳过 redis 验证，改为 until 轮询等待
- 为什么：完成大纲 5.1.3 Docker 开发环境搭建；打通 Mac 开发 → NAS 数据库链路，为 5.2 用户认证模块（TypeORM 建表）铺路
- 新增依赖：无（验证脚本复用已有 pg / ioredis）
- 产出素材：无（环境验证，无界面）
- 遗留问题：
  - [ ] 本次部署未提交 NAS 本地的容器变更无回滚脚本需求（docker rm -f + 删数据目录即完全清除，运维速查见 nas-db-setup.sh）

## [2026-09-08] NAS 数据目录变更（D-006）

- 做了什么：
  - 按用户要求，NAS 数据库容器数据目录由 `/mnt/user/appdata/wangyan-2026/` 改为 `/mnt/user/storage/Projects/wangyan-2026-db-data/`（与 bare 仓库同在 storage/Projects 下）
  - 同步修改：nas-db-setup.sh（6 处）、README.md（1 处）
  - 新增决策 D-006（修订 D-005 的数据目录，其余拓扑不变）
- 为什么：项目代码与数据集中到 Projects 目录，备份/清除边界更清晰（用户指定）
- 新增依赖：无
- 产出素材：无
- 遗留问题：
  - [ ] NAS 上执行 nas-db-setup.sh（用户手动，尚未部署容器，对应 5.1.3）

## [2026-09-07] 环境搭建收尾：构建复验 + 提交 pnpm-lock.yaml

- 做了什么：
  - 复验环境：node 22.22.0 / pnpm 11.25.0，`pnpm install` 幂等通过（662 包，无需重装）
  - 复验构建：`pnpm -r build` —— apps/server（nest build）✅、apps/web（tsc --noEmit + vite build，1468 模块）✅、packages/shared（纯 TS 源码引用，无需构建）✅
  - 提交 pnpm-lock.yaml（连同上一次会话遗留的 pnpm-workspace.yaml allowBuilds 配置与记忆三件套更新）
- 为什么：5.1.1 开发环境配置收尾；lockfile 入库保证依赖可复现（大纲 5.1.1）
- 新增依赖：无
- 产出素材：无（环境验证，无界面）
- 遗留问题：
  - [ ] NAS 上执行 nas-db-setup.sh（用户手动，尚未部署容器，对应 5.1.3）

## [2026-09-06] Mac 工具链验证：pnpm install 排错

- 做了什么：
  - 复现 `pnpm install` 报错并定位：真实错误只有一个——pnpm v10+ 的 `ERR_PNPM_IGNORED_BUILDS`（默认禁止依赖跑安装脚本），被拦下的是 esbuild / leveldown / @nestjs/core 三个包；其余为 npmmirror 慢导致的重试 WARN（自动恢复）与 level 旧包链的 deprecated 警告（来自 y-websocket 的 optional 依赖 y-leveldb，无害）
  - 修复：填 `pnpm-workspace.yaml` 的 `allowBuilds`（pnpm 自动生成的占位原本是 "set this to true or false"）。注意 pnpm 11 已不读 package.json 的 `pnpm.onlyBuiltDependencies` 字段，配置必须放 workspace yaml
  - 重新 install 成功：662 个包，leveldown 原生模块经 node-gyp 本机编译通过（需 Xcode CLT，已具备）
  - 验证 `pnpm build`：apps/server（nest build）✅、apps/web（tsc --noEmit + vite build，1468 模块）✅
- 为什么：PROGRESS 待办"Mac 工具链 + pnpm install 验证"，属大纲 5.1.1 开发环境配置
- 新增依赖：无（仅批准已有依赖的构建脚本，allowBuilds 是配置不是依赖）
- 产出素材：无（环境验证，无界面）
- 遗留问题：
  - [ ] pnpm-lock.yaml 已生成，待提交（用户确认后 git commit）
  - [ ] NAS 上执行 nas-db-setup.sh（用户手动，尚未部署容器）

## [2026-09-05] 脚手架搭建 + 开发环境定稿 + Mac 迁移

- 做了什么：
  - 搭建 pnpm workspace 脚手架：根配置（pnpm-workspace / .env.example / .gitignore / .npmrc 镜像源）、docker-compose.yml、apps/server（NestJS+TypeORM+健康检查）、apps/web（React18+Vite+Antd）、packages/shared、两个多阶段 Dockerfile + nginx.conf
  - 确定三项选型：Tiptap（D-001）、TypeORM（D-002）、pnpm workspace（D-003）；目录组织与 Docker 编排方案（D-004）
  - 环境摸底：LXC 根文件系统为 shfs、Docker vfs 驱动 → 放弃在 LXC 开发；确定拓扑 D-005（NAS 数据库容器 + Mac 原生开发）
  - git init（main 分支），bare 仓库建在 NAS /mnt/user/storage/Projects/wangyan-2026.git，远端名 nas
  - Mac ~/projects/wangyan-2026 已 clone，.env 已单独同步（不走 git）
  - 端口全面改高位：15432 / 16379 / 13000 / 18080（NAS 上 5432/6379/3000 均被占用）
  - 新增 nas-db-setup.sh（含密码的容器部署命令存档）与 README.md
- 为什么：数据库常驻 NAS、开发迁 Mac、演示只要 PPT，NAS 零侵入
- 新增依赖：仅声明（package.json），依赖未完整安装（LXC 网络断流 + 用户叫停；Mac 上待装工具链后重新 install）
- 产出素材：无（脚手架阶段无截图）
- 遗留问题：
  - [ ] NAS 上执行 nas-db-setup.sh（用户手动，尚未部署容器）
  - [ ] Mac 安装 Homebrew + node@22 + pnpm，然后 pnpm install 验证构建
  - [ ] pnpm-lock.yaml 尚未生成（首次成功 install 后提交）


> 时间倒序，最新在最上面。每次会话至少追加一条，格式见 AGENTS.md §5.3。
> 诚实原则：失败、绕路、没做完，都要如实写。

## [2026-09-05] 项目立项与规则建立

- 做了什么：
  - 建立 AI 开发规则体系：AGENTS.md（规则主体）+ CLAUDE.md（自动加载入口）
  - 归档论文大纲：docs/THESIS_OUTLINE.md（冻结）
  - 建立记忆三件套：docs/memory/{PROGRESS,DECISIONS,CHANGELOG}.md
- 为什么：毕业论文（在线 Markdown 笔记编辑与管理平台）配套系统从零开始，先立规矩再写代码。
- 新增依赖：无（尚未初始化代码）
- 产出素材：无
- 遗留问题：编辑器（D-001）、ORM（D-002）、monorepo（D-003）三项选型待定，初始化脚手架前需先定。
