# CV Builder

模块化简历制作工具：后端 Cloudflare Workers，前端 Vue 3（网页 + Tauri 桌面），并提供 npm MCP 包供 AI Agent 读写简历。

数据模型与编辑交互参考 [Reactive Resume](https://github.com/AmruthPillai/Reactive-Resume)（JSON 化简历结构、分节模块、模板切换）。

## 在线地址

| 用途 | 地址 |
|------|------|
| 网页 | https://cv.sloan.dpdns.org/ |
| API | https://cv-api.sloan.dpdns.org |
| MCP npm | [@waxilo/cv-mcp](https://www.npmjs.com/package/@waxilo/cv-mcp) |
| 仓库 | https://github.com/waxilo/CV |

## 目录结构

```
CV/
├── backend/          # Cloudflare Workers + Hono + D1
├── frontend/         # Vue 3 + Element Plus（Web / Tauri）
├── mcp/              # MCP Server（发布为 @waxilo/cv-mcp）
├── shared/           # 前后端共享代码
│   └── template-schema/   # 模板配置类型 / 校验 / 迁移 / 内置模板
└── docs/             # 模板引擎文档
```

## 功能

- 注册 / 登录（JWT）
- 简历 CRUD 与自动保存
- 模块增删、显隐、拖拽排序（vuedraggable）
- **首页预览弹窗**：点击「我的简历」不直接进编辑页，先弹出预览（与模板中心同交互）；编辑 / 复制 / 锁定 / 删除在弹窗内操作，**简历名称支持在预览卡内联编辑**
- **简历锁定**：锁定后禁止网页编辑、删除与 MCP 改写，仅允许复制（副本默认未锁定）；可随时解锁
- **模板快照（完全固化）**：每份简历创建 / 切换模板时持有模板完整副本（HTML/CSS/变量/页面），模板中心后续修改不影响已有简历；旧简历渲染自动回退模板中心
- **简历内嵌模板编辑器**：编辑页「模板」分区直接改本简历的模板副本（HTML/CSS/变量/页边距，复用设计器组件），支持撤销 / 重做 / 校验与实时预览
- 代码化 HTML 模板引擎：模板作者写 HTML + CSS，通过变量与简历 JSON 拼装
- 模板设计器双模式：代码模式（HTML/CSS + 变量树）与区块模式（拖拽画布）
- 模板变量声明与调参，用户的调参结果存在简历侧，内置模板可被每人各自定制
- **模板中心「我的模板」**：分类展示个人模板；简历里微调的模板可一键保存到模板中心复用
- 隔离渲染预览（`sandbox=""` iframe + CSP，零脚本）
- 浏览器打印导出 PDF；导出 HTML（内嵌结构化数据，可再导入）
- 在线分享预览链接
- **MCP 接入**：创建 API Key；一键复制**安装** / **更新**提示词；Agent 可通过 MCP 读写简历（推荐先 `duplicate_resume` 再改副本）、调整简历样式（`update_resume_style`）、调整简历模板（`get/update_resume_template`）、创建「我的模板」（`create_my_template` / `save_resume_template_to_center`）
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

部署：

```bash
cd backend
npm run db:migrate:remote   # 有新 migration 时
npm run deploy
```

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

### 4. 前端（Tauri 桌面）

需已安装 [Rust](https://www.rust-lang.org/tools/install)。

```bash
cd frontend
npx tauri icon public/favicon.svg   # 首次
npm run tauri:dev
npm run tauri:build                 # 使用 .env.production 中的 API
```

### 5. MCP 包（本地开发 / 发布）

```bash
cd mcp
npm install
npm run build
npm publish --access public   # 需 npm 登录且具备 publish 权限
```

## MCP：用 AI 改简历

不必把提示词塞进 HTML。推荐流程：

1. 打开网页 [MCP 接入](https://cv.sloan.dpdns.org/mcp)（简历首页顶栏，模板中心旁）
2. 创建 API Key（明文仅显示一次）
3. **一键复制安装提示词**，粘贴到 Cursor / Claude 等 Agent
4. Agent 写入全局 MCP（`npx -y @waxilo/cv-mcp`）后即可 `list_resumes` / 改简历
5. 包有更新时：同一页 **一键复制更新提示词**，让 Agent 清 npx 缓存、拉最新包并重启 MCP

推荐改简历流程：空账号用 **`create_resume`**（可带完整 `data` 迁移旧简历）；已有简历则 `list_resumes` → **`duplicate_resume`**（得到副本）→ 再 `update_*` 只改副本，降低覆盖原件的风险。锁定简历也可复制；副本默认未锁定。

锁定中的简历：MCP 可 `list` / `get` / `duplicate`，但直接 `update_*` 原件会收到 `RESUME_LOCKED`；请在首页预览弹窗解锁，或先复制再改副本。

### 更新已安装的 MCP

已通过 `npx -y @waxilo/cv-mcp` 接入时，一般**不必改配置**，只需拉最新包：

1. 打开 [MCP 接入](https://cv.sloan.dpdns.org/mcp) → **一键复制更新提示词** → 粘贴给 Agent  
   或手动执行：
   ```bash
   npx clear-npx-cache
   # 或 npm cache clean --force
   ```
2. 在 Cursor：**Settings → MCP** 关闭再打开 `cv-builder`，或 Reload MCP
3. 用 `list_resumes` 验证；密钥未吊销则无需重建 API Key

也可把 args 钉死版本（发新版后改号再重启）：`"args": ["-y", "@waxilo/cv-mcp@0.1.2"]`。

手动配置示例：

```json
{
  "mcpServers": {
    "cv-builder": {
      "command": "npx",
      "args": ["-y", "@waxilo/cv-mcp"],
      "env": {
        "CV_API_BASE": "https://cv-api.sloan.dpdns.org",
        "CV_API_TOKEN": "cvk_你的API_Key"
      }
    }
  }
}
```

| 环境变量 | 说明 |
|----------|------|
| `CV_API_TOKEN` | 网页创建的 API Key（`cvk_…`），也可用登录 JWT |
| `CV_API_BASE` | API 根地址，默认 `https://cv-api.sloan.dpdns.org` |

鉴权：简历等接口同时支持 **JWT**（网页登录）与 **API Key**（MCP）。管理 API Key 的接口仅允许网页 JWT。

更多说明见 [`mcp/README.md`](./mcp/README.md)。

## API 约定

| 服务 | 路径前缀 |
|------|----------|
| 认证 / API Key | `POST /api/auth-service/v1/*` |
| 简历 | `POST /api/resume-service/v1/*` |
| 模板 | `POST /api/template-service/v1/*` |
| 分享 | `POST /api/share-service/v1/*` |

统一响应：`{ success, code, message, data }`，字段 `snake_case`。

简历 `update-resume` 可传 `is_locked`；已锁定时改内容或删除返回 `403` / `RESUME_LOCKED`（解锁时只传 `is_locked: false` 即可）。

常用认证相关：

| 动作 | 路径 |
|------|------|
| 登录 | `/api/auth-service/v1/login` |
| 创建 API Key | `/api/auth-service/v1/create-api-key` |
| 列出 API Key | `/api/auth-service/v1/list-api-keys` |
| 吊销 API Key | `/api/auth-service/v1/revoke-api-key` |

请求头：`Authorization: Bearer <JWT 或 cvk_…>`。

## 模板引擎

模板是**代码**，不是写死的 Vue 组件。用户填的所有信息存为一份 JSON（`resume.data`），模板通过变量与之拼装。

两种引擎：

| engine | 说明 |
| --- | --- |
| `html` | 主力形态。模板作者写完整的 HTML + CSS，拥有全部 DOM 控制权 |
| `blocks` | v1 的行-列-区块拖拽画布，作为兼容路径保留 |

模板配置结构、校验与迁移放在 `shared/template-schema/`，前后端共用同一份实现。

### 写一个 HTML 模板

模板不直接消费原始简历 JSON，而是消费归一化后的渲染上下文 —— 不同模块的条目被统一成 `title` / `subtitle` / `meta` / `dateRange` / `description` / `keywords` 五元组，所以一段循环就能渲染全部 11 种模块：

```html
{{#each sections}}
  <section>
    <h2>{{this.name}}</h2>
    {{#each this.items}}
      <div class="item">
        <strong>{{this.title}}</strong>
        <span>{{this.dateRange}}</span>
        {{#if this.descriptionSafe}}<div>{{& this.descriptionSafe}}</div>{{/if}}
      </div>
    {{/each}}
  </section>
{{/each}}
```

CSS 会自动作用域化到 `.cv-root`，不必自己加前缀；模板声明的变量注入为 `var(--tpl-*)`：

```css
.cv { padding: var(--page-margin-top) var(--page-margin-right); }
h2  { color: var(--tpl-primary-color); }
```

支持的语法与全部可用变量见 [模板变量契约](./docs/模板变量契约.md)，架构与安全模型见 [模板引擎 v2 设计方案](./docs/模板引擎-v2-设计方案.md)。

### 新增内置模板

内置模板不入库，直接在 `shared/template-schema/src/builtin/index.ts` 的 `BUILTIN_TEMPLATES` 里加一项即可 —— 它同时作为模板中心的选项、新建模板的预设起点和语法参考实现。改内置模板不需要写数据库 migration。

用户自定义模板走 `template` 表（`POST /api/template-service/v1/create-template`），或在模板设计器里直接写。

### 安全约束

模板可能来自其他用户，因此渲染产物必须是零脚本的静态 HTML：

- 预览在 `<iframe sandbox="">` 内，配合 `default-src 'none'` 的 CSP，完全不能执行脚本或发起请求
- HTML 走白名单清洗（`script` / `iframe` / `form` / 事件属性一律剥离）
- 禁止 `{{{ }}}`；富文本只能通过 `{{& xxxSafe}}` 输出已清洗的内容
- CSS 拦截 `@import` / `expression()` / `javascript:`，`url()` 仅放行 `data:image` 与 `https:`

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Hono、Cloudflare Workers、D1、Drizzle、jose、Zod |
| 前端 Web | Vue 3、Vite、Pinia、Vue Router、Element Plus、Cloudflare Pages |
| MCP | `@waxilo/cv-mcp`（`@modelcontextprotocol/sdk`、stdio / npx） |
| 共享 | `shared/template-schema`（纯 TS，前后端共用的模板 schema / 校验 / 迁移） |
| 桌面 | Tauri 2 |
