# CV Builder

模块化简历制作工具：后端 Cloudflare Workers，前端 Vue 3（网页 + Tauri 桌面）。

数据模型与编辑交互参考 [Reactive Resume](https://github.com/AmruthPillai/Reactive-Resume)（JSON 化简历结构、分节模块、模板切换）。

## 目录结构

```
CV/
├── backend/          # Cloudflare Workers + Hono + D1
└── frontend/         # Vue 3 + Element Plus（Web / Tauri）
```

## 功能

- 注册 / 登录（JWT）
- 简历 CRUD 与自动保存
- 模块增删、显隐、拖拽排序（vuedraggable）
- 多模板预览（modern / classic / minimal）
- 自定义模板扩展（API + 前端注册 Vue 组件）
- 主题色 / 字体 / 字号调整
- 浏览器打印导出 PDF
- 网页部署（Cloudflare Pages）与桌面打包（Tauri）

## 快速开始

### 1. 后端

```bash
cd backend
npm install
npm run db:migrate:local
npm run dev
```

线上 API：`https://cv-api.sloan.dpdns.org`

### 2. 前端（Web 开发）

```bash
cd frontend
npm install
npm run dev
# http://localhost:1420 ，本地 API 经 Vite 代理到 8787
```

### 3. 前端网页部署（Cloudflare Pages）

```bash
cd frontend
# 生产 API 写在 .env.production
npm run deploy:web
```

或分步：

```bash
npm run build:web
npx wrangler pages deploy dist --project-name=cv-web
```

构建产物在 `frontend/dist`，也可部署到任意静态托管（Nginx / OSS / GitHub Pages 等）。SPA 回退已配置 `public/_redirects`。

当前 Pages 地址：https://cv-web-57j.pages.dev/

### 4. 前端（Tauri 桌面）

需已安装 [Rust](https://www.rust-lang.org/tools/install)。

```bash
cd frontend
npx tauri icon public/favicon.svg   # 首次
npm run tauri:dev
npm run tauri:build                 # 使用 .env.production 中的 API
```

## API 约定

| 服务 | 路径前缀 |
|------|----------|
| 认证 | `POST /api/auth-service/v1/*` |
| 简历 | `POST /api/resume-service/v1/*` |
| 模板 | `POST /api/template-service/v1/*` |

统一响应：`{ success, code, message, data }`，字段 `snake_case`。

## 扩展模板

1. 在 `frontend/src/templates/` 新增 Vue 组件（接收 `data: IResumeData`）
2. 在 `ResumePreview.vue` 的 `componentMap` 注册 `templateId → 组件`
3. 通过「扩展模板」写入后端 `template` 表，或直接使用内置 id（`modern` / `classic` / `minimal`）

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Hono、Cloudflare Workers、D1、Drizzle、jose、Zod |
| 前端 Web | Vue 3、Vite、Pinia、Vue Router、Element Plus、Cloudflare Pages |
| 桌面 | Tauri 2 |
