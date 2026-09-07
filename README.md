# 在线Markdown笔记编辑与管理平台

毕业论文配套系统。React 18 + TypeScript + Ant Design / NestJS / PostgreSQL + JSONB / Redis / Yjs(CRDT) / Docker。

## 架构：NAS 存数据，Mac 做开发

```
NAS 192.168.3.3                          Mac mini 192.168.3.177
├─ wangyan-postgres  :15432  ◄────────┐  ├─ pnpm dev:server  (NestJS :13000)
└─ wangyan-redis     :16379  ◄────────┤  ├─ pnpm dev:web     (Vite  :5173)
   （docker run 部署，见 nas-db-setup.sh）└─ .env 指向 NAS 数据库
```

- **数据库部署命令**：`nas-db-setup.sh`（⚠️ 含密码，勿公开；容器不随代码自动部署，手动执行）
- **端口约定**：5432/6379/3000 在 NAS 上已被占用，本项目统一用 15432 / 16379 / 13000 / 18080
- **数据与迁移**：NAS 上 `/mnt/user/storage/Projects/wangyan-2026-db-data/` 一个目录即全部数据，备份/迁移只拷它

## 快速开始（Mac）

```bash
# 1. 安装工具链（首次）
brew install node@22 pnpm

# 2. 配置环境
cp .env.example .env      # 填入 NAS 数据库密码（同 nas-db-setup.sh）

# 3. 启动（数据库不在本地，无需任何容器）
pnpm install
pnpm dev                  # 前端 http://localhost:5173，后端 :13000
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 前后端并行开发模式 |
| `pnpm build` | 全量构建 |
| `pnpm db:up` | 本机 compose 起 postgres/redis（演示用，日常不用——数据库常驻 NAS） |
| `pnpm up` | 全容器化一键启动（论文 5.9 演示用） |

## 文档与规则

- `AGENTS.md` —— AI 开发规则（所有 agent 必读）
- `docs/THESIS_OUTLINE.md` —— 论文大纲（冻结）
- `docs/memory/` —— 进度 / 决策 / 变更三件套
