# 变更流水（CHANGELOG）

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
