/**
 * HTML 导出载荷：结构化简历 JSON + AI 编辑提示词。
 *
 * 导入时只读取 #cv-data；可见正文仅供人类预览，不作为数据源。
 */

import type { IResumeData } from '/@/types/resume';

export const CV_DATA_SCRIPT_ID = 'cv-data';
export const CV_AI_PROMPT_SCRIPT_ID = 'cv-ai-prompt';

/** 写进 HTML 的 AI 提示词：每次编辑都生成完整新 HTML */
export const CV_AI_EDIT_PROMPT = `你正在编辑一份 CV Builder 导出的简历 HTML 文件。

【核心要求】
每次编辑都必须生成一份全新的、可独立打开的完整 HTML 简历文件（含 <!DOCTYPE html>、完整 head/body、内联 CSS、可见正文）。
不要只改几处文案补丁；不要只改 JSON 却留下过时的可见 HTML。

【必须遵守】
1. 输出完整单文件 HTML：结构清晰、样式自洽、打印友好（A4），可直接在浏览器打开。
2. 同步更新 id="cv-data" 的 <script type="application/json">：其中 JSON 必须与可见简历内容一致（姓名、经历、教育、项目、技能等事实一致）。
3. 保留本文件中的 AI 提示区块（本提示词 / #cv-ai-prompt / .cv-ai-hint），方便下次继续交给 AI 编辑。
4. 不要新增可执行 <script>（允许 application/json 与 text/plain）；不要引入外链脚本。
5. 保持 JSON 合法：双引号键名、无尾逗号、字符串内换行用 \\n。
6. 尽量保留原有字段、id、order、visible、metadata.templateId；主要改文案与事实内容。
7. description / content 等长文本支持 Markdown（加粗、列表、链接）。
8. 改完后保存为完整 .html；用户可直接打开预览，也可在 CV Builder 中「导入 HTML」（导入只读取 cv-data）。

【可改字段示例（写进 cv-data，并反映到可见 HTML）】
- basics：name、headline、email、phone、location、url、wechat、gender、age、workYears 等
- sections[]：name、content、items[] 内的公司/职位/学校/项目名/描述等

【禁止】
- 只改可见 HTML 却不更新 cv-data，或只改 cv-data 却不重新生成可见简历
- 输出残缺片段（半截 HTML、只有 diff、只有 JSON）
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
1. 每次编辑都生成一份全新的完整 HTML 简历（不要只打补丁）。
2. 可见正文与 id="${CV_DATA_SCRIPT_ID}" 中的 JSON 必须同步一致。
3. 详细规则见 id="${CV_AI_PROMPT_SCRIPT_ID}"。
4. 改完后可直接打开预览，或导入回 CV Builder。
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
  每次编辑请生成一份全新的完整 HTML 简历；可见内容须与 <code>#${CV_DATA_SCRIPT_ID}</code> 的 JSON 保持一致。
  改完后可直接打开预览，或在 CV Builder 编辑页选择「导入 HTML」。打印时本提示会隐藏。
</aside>
`;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
