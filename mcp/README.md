# @waxilo/cv-mcp

CV Builder 的 MCP Server：在 Cursor / Claude Desktop 里用工具读写简历 JSON（不改 HTML）。

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

密钥未吊销则无需重建。锁定简历的改写会被 API 拒绝（`RESUME_LOCKED`），需在网页解锁。

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
| `list_resumes` | 列出简历摘要 |
| `get_resume` | 拉取完整 JSON |
| `update_resume` | 整份 data 写回 |
| `update_basics` | 合并更新 basics |
| `update_section` | 按 id/type 合并更新某一模块 |
| `validate_resume_data` | 校验结构 |

## 本地开发（维护者）

```bash
cd mcp
npm install
npm run build
npm run dev
```
