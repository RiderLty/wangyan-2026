#!/bin/bash
# ============================================================
# NAS 应用容器部署存档（论文 5.9.3 部署脚本与一键启动）
# 在 NAS（192.168.3.3）上部署 wangyan-server / wangyan-web 两个应用容器，
# 方式与 nas-db-setup.sh 的数据库容器一致：docker run 单机部署（NAS Docker 24.0.9 无 compose 插件）。
#
# ⚠️ 本文件含数据库/Redis 密码，禁止公开！仅存档于内网 git 仓库。
# 前置：nas-db-setup.sh 已执行（postgres :15432 / redis :16379 已在运行）
#
# 回滚/清理：
#   docker rm -f wangyan-server wangyan-web
#   docker rmi wangyan-server:latest wangyan-web:latest
#   rm -rf /mnt/user/storage/Projects/wangyan-2026-build /mnt/user/storage/Projects/wangyan-2026-app.env
#   （数据库数据不受影响，位于 wangyan-2026-db-data）
# ============================================================
set -e

HOST_IP=192.168.3.3
BUILD_DIR=/mnt/user/storage/Projects/wangyan-2026-build
ENV_FILE=/mnt/user/storage/Projects/wangyan-2026-app.env

# ---------- 0. 上传源码与配置（在 Mac 上执行） ----------
#   git archive --format=tar.gz -o /tmp/wangyan-src.tar.gz HEAD
#   scp /tmp/wangyan-src.tar.gz root@$HOST_IP:/tmp/
#   scp .env root@$HOST_IP:$ENV_FILE && ssh root@$HOST_IP chmod 600 $ENV_FILE
#   ssh root@$HOST_IP "mkdir -p $BUILD_DIR && tar xzf /tmp/wangyan-src.tar.gz -C $BUILD_DIR"

# ---------- 1. 构建镜像（NAS 本机构建，原生 amd64） ----------
cd $BUILD_DIR
docker build -f apps/server/Dockerfile -t wangyan-server:latest .
docker build -f apps/web/Dockerfile    -t wangyan-web:latest .

# ---------- 2. 启动后端（REST + WebSocket，:13000） ----------
# 数据库/Redis 连接本机高位端口（与 .env 中 POSTGRES_HOST=192.168.3.3 一致）
docker rm -f wangyan-server 2>/dev/null || true
docker run -d --name wangyan-server --restart unless-stopped \
  --env-file $ENV_FILE \
  -p 13000:13000 \
  wangyan-server:latest

# ---------- 3. 启动前端（nginx 托管 + 反代，:18080） ----------
# BACKEND_HOST 指向宿主机地址（nginx 模板经 envsubst 渲染；compose 场景填服务名 server）
docker rm -f wangyan-web 2>/dev/null || true
docker run -d --name wangyan-web --restart unless-stopped \
  -e BACKEND_HOST=$HOST_IP \
  -p 18080:80 \
  wangyan-web:latest

# ---------- 4. 验证 ----------
echo "== 等待启动 =="
until curl -sf http://localhost:13000/api/health > /dev/null; do sleep 2; done
echo "server :13000 => $(curl -s http://localhost:13000/api/health)"
echo "web    :18080 => HTTP $(curl -s -o /dev/null -w '%{http_code}' http://localhost:18080/)"
echo "proxy  :18080 => $(curl -s http://localhost:18080/api/health)"
echo "== 部署完成：浏览器访问 http://$HOST_IP:18080 =="
