import { describe, expect, it } from 'vitest';
import {
  compileTemplateHtml,
  createDefaultTemplateConfig,
  migrateTemplateConfig,
  renderMustache,
  sanitizeCss,
  sanitizeHtml,
  validateCustomCss,
  validateTemplateConfig,
} from '../index';
import { createSampleResumeData } from '../sampleData';

describe('migrateTemplateConfig', () => {
  it('upgrades legacy layout config to schemaVersion 1', () => {
    const cfg = migrateTemplateConfig({
      layout: 'sidebar-left',
      primaryColor: '#111111',
      fontFamily: 'Inter',
      fontSize: 14,
      spacing: 1.2,
    });
    expect(cfg.schemaVersion).toBe(1);
    expect(cfg.document.rows.length).toBeGreaterThan(0);
    expect(cfg.primaryColor).toBe('#111111');
  });

  it('keeps existing document when schemaVersion is 1', () => {
    const base = createDefaultTemplateConfig('single-column');
    const cfg = migrateTemplateConfig(base);
    expect(cfg.document.rows).toHaveLength(base.document.rows.length);
  });
});

describe('validateTemplateConfig', () => {
  it('accepts default config', () => {
    const result = validateTemplateConfig(createDefaultTemplateConfig());
    expect(result.valid).toBe(true);
  });

  it('rejects dangerous css', () => {
    const cfg = createDefaultTemplateConfig();
    cfg.customCss = '@import url("https://evil.test/x.css");';
    const result = validateTemplateConfig(cfg);
    expect(result.valid).toBe(false);
  });

  it('rejects triple mustache in html block', () => {
    const cfg = createDefaultTemplateConfig();
    cfg.document.rows[0].columns[0].blocks.push({
      id: 'html1',
      type: 'html',
      visible: true,
      content: '{{{basics.name}}}',
    });
    const result = validateTemplateConfig(cfg);
    expect(result.valid).toBe(false);
  });
});

describe('sanitize', () => {
  it('strips script tags and event handlers', () => {
    const html = sanitizeHtml('<div onclick="alert(1)"><script>alert(2)</script><p>ok</p></div>');
    expect(html).toContain('<p>ok</p>');
    expect(html.toLowerCase()).not.toContain('script');
    expect(html.toLowerCase()).not.toContain('onclick');
  });

  it('blocks dangerous css patterns', () => {
    expect(validateCustomCss('body{background:url(https://x.test/a.png)}').length).toBeGreaterThan(0);
    const cleaned = sanitizeCss('h1{color:red} @import "x";');
    expect(cleaned).toContain('blocked');
  });
});

describe('mustache', () => {
  it('escapes variables and renders sections', () => {
    const out = renderMustache('Hi {{name}} {{#items}}{{title}};{{/items}}', {
      name: '<b>A</b>',
      items: [{ title: 'One' }, { title: 'Two' }],
    });
    expect(out).toContain('&lt;b&gt;A&lt;/b&gt;');
    expect(out).toContain('One;Two;');
  });

  it('throws on triple braces', () => {
    expect(() => renderMustache('{{{name}}}', { name: 'x' })).toThrow();
  });
});

describe('compileTemplateHtml', () => {
  it('compiles sample resume with default templates', () => {
    const data = createSampleResumeData();
    for (const layout of ['single-column', 'sidebar-left', 'sidebar-right', 'two-column'] as const) {
      const html = compileTemplateHtml(createDefaultTemplateConfig(layout), data);
      expect(html).toContain('cv-root');
      expect(html).toContain('张三');
      expect(html).toContain('工作经历');
    }
  });
});
