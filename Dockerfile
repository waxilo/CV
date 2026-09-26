# 一个镜像装下 API（Node 服务）与网页（Vue 构建产物），同源提供 ——
# 迁出 Cloudflare 后不再有 Worker/Pages 两个部署面。
#
# 构建上下文 = 仓库根（见 docker-compose.yml）：前后端都 import
# shared/template-schema（后端经 src/template/shared.ts 相对路径，前端经 vite 别名），
# 镜像里保持 backend/、frontend/、shared/ 同级，路径才解析得到。
#
# 不写 `# syntax=` 指令：这台机器拉不到外部的 dockerfile frontend 镜像，
# 内置 frontend 已支持本文件用到的全部语法。

# --- 网页 ---------------------------------------------------------------------
# build:web 里带 vue-tsc --noEmit，类型错误会让镜像构建失败。
FROM node:24-alpine AS web
WORKDIR /repo
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
COPY shared/ ./shared/
RUN cd frontend && npm run build:web

# --- API ------------------------------------------------------------------------
FROM node:24-alpine AS api
WORKDIR /repo
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci
COPY backend/ ./backend/
COPY shared/ ./shared/
# esbuild 打包（mysql2 与 @hono/node-server 保持 external），npm prune 只留运行时依赖。
RUN cd backend && npm run build && npm prune --omit=dev

# --- 运行时 ---------------------------------------------------------------------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=api /repo/backend/package.json /repo/backend/package-lock.json ./
COPY --from=api /repo/backend/node_modules ./node_modules
COPY --from=api /repo/backend/dist ./dist
COPY --from=web /repo/frontend/dist ./public

# 不 chown：代码与依赖归 root 只读，进程（node 用户）写不到自己的二进制里去，
# 运行时唯一需要写的地方是 MySQL。
USER node
EXPOSE 8787

# 不用 docker --init / tini：src/server.ts 自己装了 SIGTERM 处理
# （先停接单、等在途请求收尾再关连接池），node 作为 PID 1 收到 docker stop 就走这条路。
CMD ["node", "dist/server.js"]
