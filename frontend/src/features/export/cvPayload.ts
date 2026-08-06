/**
 * HTML 导出载荷：结构化简历 JSON + AI 编辑提示词。
 *
 * 导入时只读取 #cv-data；可见正文仅供人类预览，不作为数据源。
 */

import type { IResumeData } from '/@/types/resume';

export const CV_DATA_SCRIPT_ID = 'cv-data';
export const CV_AI_PROMPT_SCRIPT_ID = 'cv-ai-prompt';

/** 写进 HTML 的 AI 提示词：要求只改 JSON */
export const CV_AI_EDIT_PROMPT = `你正在编辑一份 CV Builder 导出的简历 HTML 文件。

【必须遵守】
1. 只修改 id="cv-data" 的 <script type="application/json"> 标签内部的 JSON 内容。
2. 不要修改、删除或重排页面上的 HTML 结构、CSS、分页垫片、可见正文。
3. 不要新增可执行 <script>；不要改 id、class、样式。
4. 保持 JSON 合法：双引号键名、无尾逗号、字符串内换行用 \\n。
5. 尽量保留原有字段、id、order、visible、metadata.templateId；只改文案与事实内容。
6. description / content 等长文本支持 Markdown（加粗、列表、链接）。
7. 改完后整份 HTML 原样保存，用户会导回 CV Builder；导入只读取 cv-data。

【可改字段示例】
- basics：name、headline、email、phone、location、url、wechat、gender、age、workYears 等
- sections[]：name、content、items[] 内的公司/职位/学校/项目名/描述等

【禁止】
- 为了「看起来改过」而去改渲染出来的可见 HTML
- 把 JSON 改成数组、或包一层无关字段导致 basics/sections/metadata 丢失
`;

/**
 * 将 JSON 嵌入 script 标签内容时，转义可截断标签的字符。
 */
export function encodeJsonForScriptTag(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
}

/**
 * 组装导出 HTML 中的数据载荷片段（注释 + JSON + 提示词）。
 */
export function buildCvPayloadHtml(data: IResumeData): string {
  const json = encodeJsonForScriptTag(data);
  const prompt = escapeHtmlText(CV_AI_EDIT_PROMPT);

  return `<!--
================================================================
CV Builder · AI 编辑说明（请先读）
----------------------------------------------------------------
1. 只修改下方 id="${CV_DATA_SCRIPT_ID}" 中的 JSON。
2. 不要改 HTML / CSS / 可见正文。
3. 详细规则见 id="${CV_AI_PROMPT_SCRIPT_ID}"。
4. 改完后把本文件导入回 CV Builder。
================================================================
-->
<script type="application/json" id="${CV_DATA_SCRIPT_ID}">
${json}
</script>
<script type="text/plain" id="${CV_AI_PROMPT_SCRIPT_ID}">
${prompt}
</script>
<aside class="cv-ai-hint" aria-label="AI 编辑提示">
  <strong>AI 编辑提示</strong>
  请只修改本文件中 <code>#${CV_DATA_SCRIPT_ID}</code> 的 JSON；不要改页面样式与可见正文。
  改完后在 CV Builder 编辑页选择「导入 HTML」。打印时本提示会隐藏。
</aside>
`;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
