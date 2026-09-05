# ---- 构建阶段：安装依赖并编译（论文 5.9.1 Docker镜像构建）----
# 注意：构建上下文是仓库根目录（见 docker-compose.yml 的 context: .），
# 因为 pnpm workspace 需要完整的 workspace 定义才能正确安装依赖。
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo

# 先只拷贝清单文件，利用 Docker 层缓存加速依赖安装
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN pnpm install --filter @app/server...

COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @app/server build

# ---- 运行阶段 ----
FROM node:22-alpine
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=builder /repo ./
EXPOSE 13000
CMD ["node", "apps/server/dist/main.js"]
