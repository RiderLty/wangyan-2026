# ---- 构建阶段（论文 5.9.1）----
# 构建上下文是仓库根目录（pnpm workspace 需要）
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --filter @app/web...

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @app/web build

# ---- 运行阶段：nginx 托管静态文件并反代后端 ----
FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
