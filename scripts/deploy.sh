#!/usr/bin/env bash
# 用当前工作树重建镜像并重启容器。部署目标就是这台机器，不再往云上推。
#
#   ./scripts/deploy.sh                 # 门禁（后端 typecheck + 模板自检）→ 构建 → up -d
#   ./scripts/deploy.sh --skip-checks   # 跳过本机门禁
#   ./scripts/deploy.sh --logs          # 之后跟随日志
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SKIP_CHECKS=0
SHOW_LOGS=0
for arg in "$@"; do
  case "$arg" in
    --skip-checks) SKIP_CHECKS=1 ;;
    --logs) SHOW_LOGS=1 ;;
    *) echo "未知参数：$arg" >&2; exit 2 ;;
  esac
done

[ -f .env ] || { echo "❌ 缺少 .env，先执行 ./scripts/db-init.sh" >&2; exit 1; }
docker network inspect mysql-server_default >/dev/null 2>&1 || {
  echo "❌ 网络 mysql-server_default 不存在，先启动数据库：../mysql-server/scripts/start.sh" >&2
  exit 1
}
docker network inspect gw_default >/dev/null 2>&1 || {
  echo "❌ 网络 gw_default 不存在，先启动共享公网入口：../gw（./scripts/gw-join.sh 可一并接好）" >&2
  exit 1
}

if [ "$SKIP_CHECKS" -eq 0 ]; then
  echo "==> 后端 typecheck + 模板 schema 自检"
  (cd backend && npm run typecheck && npm run selfcheck)
  # 前端不在这里单独查：镜像里的 npm run build:web 自带 vue-tsc --noEmit，
  # 类型错误会让下面的构建直接失败。
fi

echo "==> 构建镜像"
docker compose build

echo "==> 启动容器"
docker compose up -d

echo "==> 等待健康检查"
status=starting
for _ in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' cv 2>/dev/null || echo starting)
  [ "$status" = healthy ] && break
  sleep 2
done
docker compose ps

bind=$(sed -n 's/^APP_BIND_ADDR=//p' .env | head -1)
port=$(sed -n 's/^APP_PORT=//p' .env | head -1)
echo ""
echo "✅ 部署完成： http://${bind:-127.0.0.1}:${port:-7004}   （健康检查：${status}）"

# 公网入口由共享的 ../gw 网关提供：网关上有本域名的 vhost 才算接入。
for conf in cv; do
  if [ -f "../gw/conf.d/${conf}.conf" ]; then
    gw_state=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' gw 2>/dev/null || echo 未启动)
    echo "   公网入口： https://${conf}.sloan.dpdns.org   （网关 gw：${gw_state}）"
  fi
done

if [ "$SHOW_LOGS" -eq 1 ]; then exec docker compose logs -f; fi
