#!/usr/bin/env node
/**
 * CV Builder MCP Server（stdio）。
 *
 * 环境变量：
 * - CV_API_TOKEN（或 CV_TOKEN）：网页「MCP 接入」页创建的 API Key（cvk_…）或登录 JWT，必填
 * - CV_API_BASE：API 根地址，默认 https://cv-api.sloan.dpdns.org
 *
 * 注意：不要向 stdout 打日志，会破坏 MCP JSON-RPC。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { CvApiClient } from './api/client.js';
import { registerTools } from './tools/register.js';

const INSTRUCTIONS = `你正在通过 MCP 编辑 CV Builder 简历。

【推荐工作流：先复制再改】
1. list_resumes 选中源简历；若 is_locked=true，必须先 duplicate_resume。
2. 默认先调用 duplicate_resume 得到新 resume_id（可自定义 title），再只改副本。
3. 对副本 get_resume → update_basics / update_section / update_resume。
4. 除非用户明确要求「直接改原件」，否则不要 update 源 resume_id。

【工作方式】
1. 只改结构化数据（basics / sections / metadata），不要尝试生成或改 HTML/CSS。
2. 小改用 update_basics / update_section；大改组装完整 data 后用 update_resume。
3. 写回前可用 validate_resume_data 检查结构。
4. 尽量保留原有 section id、item id、order、visible、metadata.templateId。
5. description / content 支持 Markdown（加粗、列表、链接）。
6. 改完后用户在 CV Builder 网页刷新即可看到副本；导入 HTML 不是必需步骤。

【禁止】
- 编造用户未提供的经历、公司、学历
- 删除 metadata.theme 或把 data 改成非对象结构
- 输出半截 JSON 或只改可见 HTML
- 在未获用户明确同意时直接改写已锁定或正式原件`;

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cv-mcp] ${message}`);
    process.exit(1);
  }

  const api = new CvApiClient(config);
  const server = new McpServer(
    {
      name: 'cv-builder',
      version: '0.1.3',
    },
    {
      instructions: INSTRUCTIONS,
    }
  );

  registerTools(server, api);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[cv-mcp] ready · api=${config.apiBase}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[cv-mcp] fatal: ${message}`);
  process.exit(1);
});
