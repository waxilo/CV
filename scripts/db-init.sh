#!/usr/bin/env bash
# 一次性初始化自托管部署：
#   1. 在共享 mysql-server 容器里建专用库 cv_builder 与专用账号（不碰服务器上的其他库）；
#   2. 应用 backend/db/schema.mysql.sql；
#   3. 生成 .env（数据库口令 + JWT_SECRET + API_KEY_ENCRYPTION_SECRET）。
#
# 前提：mysql-server 容器已在跑：
#   ../mysql-server/scripts/start.sh   （CV 仓库在 Code/ 下，相对路径与 notify-hub 同层）
#
# 可重复执行：CREATE ... IF NOT EXISTS；已有 .env 不动里面已有的密钥（就地重生成会登出所有人、
# 且让已存库的 API Key 密文解不开）。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_NAME="${DB_NAME:-cv_builder}"
DB_USER="${DB_USER:-cv_builder}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mysql-server}"
MYSQL_PROJECT_DIR="${MYSQL_PROJECT_DIR:-$ROOT_DIR/../mysql-server}"

password() { openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

[ -f "$MYSQL_PROJECT_DIR/.env" ] || {
  echo "❌ 找不到 ${MYSQL_PROJECT_DIR}/.env（mysql-server 项目的密码文件）" >&2
  exit 1
}
docker inspect -f '{{.State.Running}}' "$MYSQL_CONTAINER" 2>/dev/null | grep -q true || {
  echo "❌ 容器 ${MYSQL_CONTAINER} 未运行，先执行：${MYSQL_PROJECT_DIR}/scripts/start.sh" >&2
  exit 1
}

# root 口令来自 mysql-server 项目，一次都不写进本项目的文件。
ROOT_PW="$(sed -n 's/^MYSQL_ROOT_PASSWORD=//p' "$MYSQL_PROJECT_DIR/.env" | head -1)"
[ -n "$ROOT_PW" ] || { echo "❌ ${MYSQL_PROJECT_DIR}/.env 里没有 MYSQL_ROOT_PASSWORD" >&2; exit 1; }

mysql_admin() {
  docker exec -i "$MYSQL_CONTAINER" mysql -uroot -p"$ROOT_PW" --default-character-set=utf8mb4 "$@"
}

if [ -f .env ]; then
  echo "ℹ️  .env 已存在，沿用其中的密钥；缺失项会被补全"
else
  echo "📝 生成 .env"
  cat > .env <<EOF
DB_HOST=mysql
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=$(password 24)
JWT_SECRET=$(password 48)
API_KEY_ENCRYPTION_SECRET=$(password 48)
APP_BIND_ADDR=127.0.0.1
APP_PORT=8790
EOF
  chmod 600 .env
fi

# 补齐旧 .env 缺少的密钥项，跑完后凭据一定是齐的。
for key in DB_PASSWORD JWT_SECRET API_KEY_ENCRYPTION_SECRET; do
  grep -q "^${key}=.\+" .env || {
    printf '%s=%s\n' "$key" "$(password 48)" >> .env
    echo "🔑 已补齐 ${key}"
  }
done

DB_PASSWORD="$(sed -n 's/^DB_PASSWORD=//p' .env | head -1)"

echo "🗄️  创建数据库 ${DB_NAME} 与专用账号 ${DB_USER}..."
# 账号只授权这一个库，且只从 compose 网络可达，'%' 主机是本机自托管的实用授权。
mysql_admin <<SQL
create database if not exists \`${DB_NAME}\`
  default character set utf8mb4 collate utf8mb4_unicode_ci;
create user if not exists '${DB_USER}'@'%' identified by '${DB_PASSWORD}';
alter user '${DB_USER}'@'%' identified by '${DB_PASSWORD}';
grant select, insert, update, delete, create, alter, index, references
  on \`${DB_NAME}\`.* to '${DB_USER}'@'%';
SQL

echo "📐 应用 backend/db/schema.mysql.sql..."
mysql_admin "$DB_NAME" < backend/db/schema.mysql.sql

echo "✅ 完成。下一步：./scripts/deploy.sh"
