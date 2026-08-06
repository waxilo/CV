import { describe, expect, it } from 'vitest';
import { buildExportHtmlDocument } from '/@/features/export/exportHtml';

describe('buildExportHtmlDocument', () => {
  it('生成无脚本的纯 HTML+CSS 单文件', () => {
    const html = buildExportHtmlDocument({
      bodyHtml: '<div class="cv-root"><h1>陈昊</h1></div>',
      css: '.cv-root h1 { color: #111; }',
      title: '陈昊的简历',
      pageCount: 2,
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>陈昊的简历</title>');
    expect(html).toContain('.cv-root h1 { color: #111; }');
    expect(html).toContain('<div class="cv-root"><h1>陈昊</h1></div>');
    expect(html).toContain('min-height: 594mm');
    expect(html).toContain('@page');
    expect(html).not.toMatch(/<script[\s>]/i);
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
