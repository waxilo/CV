import { describe, expect, it } from 'vitest';
import { createSampleResumeData } from '/@/features/template-renderer/sampleData';
import { buildExportHtmlDocument } from '/@/features/export/exportHtml';
import {
  CV_AI_EDIT_PROMPT,
  CV_AI_PROMPT_SCRIPT_ID,
  CV_DATA_SCRIPT_ID,
  encodeJsonForScriptTag,
} from '/@/features/export/cvPayload';
import { parseResumeDataFromHtml, ImportHtmlError } from '/@/features/export/importHtml';

describe('HTML 往返：内嵌 JSON + AI 提示', () => {
  it('导出包含 #cv-data 与 AI 提示词，且无执行脚本', () => {
    const data = createSampleResumeData();
    const html = buildExportHtmlDocument({
      bodyHtml: '<div class="cv-root"><h1>陈昊</h1></div>',
      css: '.cv-root h1 { color: #111; }',
      title: '陈昊的简历',
      resumeData: data,
      pageCount: 1,
    });

    expect(html).toContain(`id="${CV_DATA_SCRIPT_ID}"`);
    expect(html).toContain(`id="${CV_AI_PROMPT_SCRIPT_ID}"`);
    expect(html).toContain('type="application/json"');
    expect(html).toContain('type="text/plain"');
    expect(html).toContain('每次编辑都生成');
    expect(html).toContain(encodeJsonForScriptTag(data).slice(0, 40));
    expect(html).toContain('cv-ai-hint');
    // 不应出现可执行的裸 script（无 type 或 javascript）
    expect(html).not.toMatch(/<script(?![^>]*type=["'](?:application\/json|text\/plain)["'])/i);
  });

  it('导入能从导出 HTML 还原简历数据', () => {
    const data = createSampleResumeData();
    data.basics.headline = 'AI 优化后的一句话';
    const html = buildExportHtmlDocument({
      bodyHtml: '<div class="cv-root"></div>',
      css: '',
      title: '测试',
      resumeData: data,
    });

    const imported = parseResumeDataFromHtml(html);
    expect(imported.basics.name).toBe('陈昊');
    expect(imported.basics.headline).toBe('AI 优化后的一句话');
    expect(imported.sections.length).toBe(data.sections.length);
    expect(imported.metadata.templateId).toBe(data.metadata.templateId);
  });

  it('AI 提示词要求每次编辑生成完整新 HTML', () => {
    expect(CV_AI_EDIT_PROMPT).toContain('每次编辑都必须生成一份全新的');
    expect(CV_AI_EDIT_PROMPT).toContain('完整 HTML');
    expect(CV_AI_EDIT_PROMPT).toContain('cv-data');
  });

  it('缺少 #cv-data 时抛错', () => {
    expect(() => parseResumeDataFromHtml('<html><body>无数据</body></html>')).toThrow(
      ImportHtmlError
    );
  });

  it('JSON 非法时抛错', () => {
    const html = `<script type="application/json" id="${CV_DATA_SCRIPT_ID}">{not-json</script>`;
    expect(() => parseResumeDataFromHtml(html)).toThrow(ImportHtmlError);
  });

  it('转义 title 防止注入', () => {
    const html = buildExportHtmlDocument({
      bodyHtml: '<div class="cv-root"></div>',
      css: '',
      title: 'A <B> & "C"',
    });
    expect(html).toContain('<title>A &lt;B&gt; &amp; &quot;C&quot;</title>');
  });
});
