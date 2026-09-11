# ---- 构建阶段（论文 5.9.1 Docker 镜像构建）----
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
# nginx 官方镜像支持 /etc/nginx/templates/*.template → envsubst → conf.d
# BACKEND_HOST 由部署环境注入（compose=服务名；NAS 单机=宿主机地址）
FROM nginx:alpine
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_HOST=server
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
