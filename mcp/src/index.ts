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

【从零创建 / 迁移旧简历】
1. list_resumes；若 count=0 或用户要新建，调用 create_resume。
2. 迁移：把旧简历整理成 IResumeData 后，create_resume({ title, template_id?, data }) 一次写入；或先 create 再 update_resume。
3. 内置模板：modern / classic / minimal / technical / business（默认 modern）。

【推荐工作流：先复制再改】
1. list_resumes 选中源简历；若 is_locked=true，必须先 duplicate_resume。
2. 默认先调用 duplicate_resume 得到新 resume_id（可自定义 title），再只改副本。
3. 对副本 get_resume → update_basics / update_section / update_resume。
4. 除非用户明确要求「直接改原件」，否则不要 update 源 resume_id。

【工作方式】
1. 内容编辑只改结构化数据（basics / sections / metadata），不要尝试生成或改 HTML/CSS。
2. 小改用 update_basics / update_section；大改组装完整 data 后用 update_resume。
3. 写回前可用 validate_resume_data 检查结构。
4. 尽量保留原有 section id、item id、order、visible、metadata.templateId。
5. metadata.templateConfig 是简历持有的模板快照（HTML/CSS）；update_resume 整体写回时原样保留，不要手动改它。
6. description / content 支持 Markdown（加粗、列表、链接）。
7. 改完后用户在 CV Builder 网页刷新即可看到；导入 HTML 不是必需步骤。

【调整模板（用户要求改模板样式 / 布局 / 颜色 / 字体时才用）】
1. 先 get_resume_template 读取当前模板源码与变量声明，不要凭空改写。
2. 改颜色/字体/字号/行距/页边距/模板变量 → update_resume_style（对应网页「主题」面板），不动模板结构。
3. 改 HTML/CSS 结构 → update_resume_template：html / css 整体替换源码，variables 替换变量声明，margin 改页边距。
4. 模板语法：{{path}} 插值、{{#each}} 循环、{{& fieldSafe}} 输出富文本；CSS 作用域自动限制在 .cv-root，变量用 var(--tpl-*)。
5. 禁止在 HTML 中写 <script> 或 onclick 等事件属性；不要改动 basics / sections 内容。
6. 未固化的旧简历首次 update_resume_template / update_resume_style 前，样式与模板仍跟随模板中心；update_resume_template 首次修改会自动固化，之后模板中心不影响它。
7. 调整会改变渲染结果，改动前先读取现状，改完提醒用户到网页预览检查。

【禁止】
- 编造用户未提供的经历、公司、学历
- 删除 metadata.theme / metadata.templateConfig 或把 data 改成非对象结构
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
      version: '0.1.4',
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
