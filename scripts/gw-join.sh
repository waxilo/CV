#!/usr/bin/env bash
# 把本项目接到共享公网入口 ../gw（可重复执行）。
#
#   ./scripts/gw-join.sh
#   ./scripts/gw-join.sh <网页域名>
#
# CV 只有一个公网域名，网页与 /api 由同一容器同源提供：
#   cv.sloan.dpdns.org → cv:8787
#
# 隧道带的是 *.sloan.dpdns.org 通配记录，Cloudflare 侧零操作，只在网关加一个 server 块。
# 撤销公网访问：删掉 ../gw/conf.d/cv.conf 并 reload（未登记的 Host 会被网关 404）。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WEB_HOST="${1:-cv.sloan.dpdns.org}"
CONTAINER_TARGET="cv:8787"   # 必须是容器名：网关容器里的 127.0.0.1 是它自己
GW_DIR="${GW_DIR:-$ROOT_DIR/../gw}"
NETWORK=gw_default

[ -f "$GW_DIR/scripts/gw-add-host.sh" ] || {
  echo "❌ 找不到共享入口项目 $GW_DIR，先建好并执行 ../gw/scripts/gw-init.sh" >&2
  exit 1
}
[ "$(docker inspect -f '{{.State.Running}}' gw 2>/dev/null || echo false)" = "true" ] || {
  echo "❌ 网关 gw 没在跑：cd $GW_DIR && docker compose up -d" >&2
  exit 1
}

echo "==> 确保共享网络 $NETWORK 存在"
docker network create "$NETWORK" >/dev/null 2>&1 && echo "    已创建" || echo "    已存在，跳过"

echo "==> 让容器挂上 $NETWORK"
docker compose up -d

echo "==> 登记域名 $WEB_HOST → $CONTAINER_TARGET"
( cd "$GW_DIR" && ./scripts/gw-add-host.sh "$WEB_HOST" "$CONTAINER_TARGET" )

echo ""
echo "✅ 就绪。 https://$WEB_HOST"
echo "   网关健康：docker inspect -f '{{.State.Health.Status}}' gw    日志：docker logs gw"
