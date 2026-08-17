# @waxilo/cv-mcp

CV Builder 的 MCP Server：在 Cursor / Claude Desktop 里用工具读写简历 JSON，并可调整简历的模板（HTML/CSS/变量/页边距）。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `CV_API_TOKEN` | 是 | 在网页 **MCP 接入** 创建的 API Key（`cvk_…`） |
| `CV_API_BASE` | 否 | API 根地址，默认 `https://cv-api.sloan.dpdns.org` |

## 快速接入

1. 打开 [CV Builder → MCP 接入](https://cv.sloan.dpdns.org/mcp)
2. 创建 API Key
3. **一键复制安装提示词**，粘贴到 Cursor / Claude 等 Agent
4. Agent 会写入全局 MCP（`npx -y @waxilo/cv-mcp`）
5. 已安装、只需升级时：同一页 **一键复制更新提示词**（清 npx 缓存 → 拉最新包 → 重启 MCP）

## 更新 MCP

配置仍是 `npx -y @waxilo/cv-mcp` 时，优先用网页上的**更新提示词**；或手动：

```bash
npx clear-npx-cache
# 然后在 Cursor Settings → MCP 重启 cv-builder
```

密钥未吊销则无需重建。改简历请默认 `duplicate_resume` 后再 `update_*`。锁定原件的直接改写会被 API 拒绝（`RESUME_LOCKED`），可先复制再改副本。

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

## 工具

| Tool | 作用 |
|------|------|
| `list_resumes` | 列出简历摘要（含 `is_locked`） |
| `create_resume` | **从零新建**；可选传入完整 `data` 一次写入（适合迁移旧简历） |
| `get_resume` | 拉取完整 JSON |
| `duplicate_resume` | **推荐**：深拷贝副本（可自定义标题），再改副本，避免动原件 |
| `update_resume` | 整份 data 写回 |
| `update_basics` | 合并更新 basics |
| `update_section` | 按 id/type 合并更新某一模块 |
| `validate_resume_data` | 校验结构 |
| `update_resume_style` | 调整样式：主题色/文字色/字体/字号/行距/页边距/模板变量 |
| `get_resume_template` | 读取简历当前模板：HTML/CSS 源码、变量声明、页面设置 |
| `update_resume_template` | 调整简历模板：替换 HTML/CSS、变量声明、页边距（未固化简历自动先固化） |

新用户 / 空账号：`create_resume`（可带 `data`）→ 网页刷新查看。

已有简历：`list_resumes` → `duplicate_resume` → `get_resume(副本)` → `update_*`。锁定原件也可复制；副本默认未锁定。

内置模板：`modern` / `classic` / `minimal` / `technical` / `business`（默认 `modern`）。

调整样式：`update_resume_style`（primary_color / text_color / font_family / font_size / line_height / margin_mm / variables）。

调整模板：`get_resume_template` → `update_resume_template`（html / css / variables / margin 局部修改）。模板语法：`{{path}}` 插值、`{{#each}}` 循环、`{{& fieldSafe}}` 富文本；禁止 `<script>` 与事件属性。

## 本地开发（维护者）

```bash
cd mcp
npm install
npm run build
npm run dev
```
