import { describe, expect, it } from 'vitest';
import {
  BUILTIN_TEMPLATES,
  getBuiltinTemplate,
  TEMPLATE_LIMITS,
} from '@cv/template-schema';
import {
  buildCssVars,
  buildRenderContext,
  checkTemplateSyntax,
  compileTemplateDocument,
  compileTemplateHtml,
  createDefaultTemplateConfig,
  date,
  dateRange,
  normalizeTemplateConfig,
  renderMustache,
  renderTemplate,
  renderTemplateSource,
  sanitizeCss,
  sanitizeHtml,
  scopeCss,
  validateCustomCss,
  validateTemplateConfig,
} from '../index';
import { createSampleResumeData } from '../sampleData';

/* ============================================================
 * 迁移
 * ============================================================ */

describe('normalizeTemplateConfig', () => {
  it('把只有主题字段的最早期配置升级为 v2 blocks 模板', () => {
    const cfg = normalizeTemplateConfig({
      layout: 'sidebar-left',
      primaryColor: '#111111',
      fontFamily: 'Inter',
      fontSize: 14,
      spacing: 1.2,
    });

    expect(cfg.schemaVersion).toBe(2);
    expect(cfg.engine).toBe('blocks');
    expect(cfg.document.rows.length).toBeGreaterThan(0);
    expect(cfg.primaryColor).toBe('#111111');
    // 基础变量应该被补齐，且与顶层主题字段同步
    expect(cfg.variables.find((v) => v.key === 'primaryColor')?.default).toBe('#111111');
  });

  it('保留 v1 的 document，不重新生成', () => {
    const base = createDefaultTemplateConfig('single-column');
    const v1 = {
      schemaVersion: 1,
      layout: base.layout,
      primaryColor: base.primaryColor,
      fontFamily: base.fontFamily,
      fontSize: base.fontSize,
      spacing: base.spacing,
      document: base.document,
    };

    const cfg = normalizeTemplateConfig(v1);
    expect(cfg.engine).toBe('blocks');
    expect(cfg.document.rows).toHaveLength(base.document.rows.length);
    expect(cfg.document.rows[0].columns[0].id).toBe(base.document.rows[0].columns[0].id);
  });

  it('engine=html 但没有源码时降级为 blocks，避免渲染空白', () => {
    const cfg = normalizeTemplateConfig({
      schemaVersion: 2,
      engine: 'html',
      source: { html: '   ', css: '' },
    });
    expect(cfg.engine).toBe('blocks');
  });

  it('幂等：重复 normalize 结果稳定', () => {
    const once = normalizeTemplateConfig(getBuiltinTemplate('modern')?.config);
    const twice = normalizeTemplateConfig(once);
    expect(twice.engine).toBe(once.engine);
    expect(twice.source.html).toBe(once.source.html);
    expect(twice.variables.length).toBe(once.variables.length);
  });
});

/* ============================================================
 * 校验
 * ============================================================ */

describe('validateTemplateConfig', () => {
  it('默认区块配置通过校验', () => {
    expect(validateTemplateConfig(createDefaultTemplateConfig()).valid).toBe(true);
  });

  it('三个内置 HTML 模板都通过校验', () => {
    for (const builtin of BUILTIN_TEMPLATES) {
      const result = validateTemplateConfig(builtin.config);
      expect(result.valid, `${builtin.id}: ${result.errors[0] || ''}`).toBe(true);
    }
  });

  it('拒绝危险 CSS', () => {
    const cfg = createDefaultTemplateConfig();
    cfg.customCss = '@import url("https://evil.test/x.css");';
    expect(validateTemplateConfig(cfg).valid).toBe(false);
  });

  it('拒绝 html 区块里的三花括号', () => {
    const cfg = createDefaultTemplateConfig();
    cfg.document.rows[0].columns[0].blocks.push({
      id: 'html1',
      type: 'html',
      visible: true,
      content: '{{{basics.name}}}',
    });
    expect(validateTemplateConfig(cfg).valid).toBe(false);
  });

  it('拒绝 engine=html 但源码为空', () => {
    const cfg = normalizeTemplateConfig(getBuiltinTemplate('classic')?.config);
    cfg.source.html = '   ';
    // 直接改字段绕过 normalize 的降级，模拟接口收到的脏数据
    cfg.engine = 'html';
    expect(validateTemplateConfig(cfg).valid).toBe(false);
  });

  it('拒绝尚未启用的 vue 引擎', () => {
    const cfg = normalizeTemplateConfig(getBuiltinTemplate('classic')?.config);
    cfg.engine = 'vue';
    cfg.source = { vue: '<template><div /></template>', css: '' };
    expect(validateTemplateConfig(cfg).valid).toBe(false);
  });

  it('拒绝非法的变量名与重复变量名', () => {
    const cfg = normalizeTemplateConfig(getBuiltinTemplate('classic')?.config);
    cfg.variables = [
      { key: '2bad', label: 'x', type: 'text', default: '' },
      { key: 'dup', label: 'a', type: 'text', default: '' },
      { key: 'dup', label: 'b', type: 'text', default: '' },
    ];
    const result = validateTemplateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('2bad');
    expect(result.errors.join()).toContain('dup');
  });

  it('拒绝超出长度上限的模板源码', () => {
    const cfg = normalizeTemplateConfig(getBuiltinTemplate('classic')?.config);
    cfg.source.html = 'a'.repeat(TEMPLATE_LIMITS.maxHtmlLength + 1);
    expect(validateTemplateConfig(cfg).valid).toBe(false);
  });

  it('报出 HTML 模板的语法错误行', () => {
    const cfg = normalizeTemplateConfig(getBuiltinTemplate('classic')?.config);
    cfg.source.html = '<div>\n  <p>ok</p>\n  {{#each sections}}\n</div>';
    const result = validateTemplateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errorLine).toBe(3);
  });
});

describe('validateCustomCss', () => {
  it('拦截 @import 与 expression', () => {
    expect(validateCustomCss('@import "x";').length).toBeGreaterThan(0);
    expect(validateCustomCss('a{width:expression(1)}').length).toBeGreaterThan(0);
  });

  it('url() 按协议条件放行：data:image 通过，http 与相对路径拦截', () => {
    // 行为相对 v1 有变化：v1 无条件拦截所有 url()，导致合法的内嵌图片也用不了
    expect(validateCustomCss('a{background:url(data:image/png;base64,AAA)}')).toHaveLength(0);
    expect(validateCustomCss('a{background:url(https://x.test/a.png)}')).toHaveLength(0);
    expect(validateCustomCss('a{background:url(http://x.test/a.png)}').length).toBeGreaterThan(0);
    expect(validateCustomCss('a{background:url(/local.png)}').length).toBeGreaterThan(0);
  });

  it('默认拦截 @font-face', () => {
    expect(validateCustomCss('@font-face{font-family:x;}').length).toBeGreaterThan(0);
  });
});

/* ============================================================
 * 清洗
 * ============================================================ */

describe('sanitize', () => {
  it('移除 script 标签与事件属性', () => {
    const html = sanitizeHtml('<div onclick="alert(1)"><script>alert(2)</script><p>ok</p></div>');
    expect(html).toContain('<p>ok</p>');
    expect(html.toLowerCase()).not.toContain('script');
    expect(html.toLowerCase()).not.toContain('onclick');
  });

  it('移除 style/iframe/form 等标签', () => {
    const html = sanitizeHtml(
      '<div><style>body{}</style><iframe src="x"></iframe><form><input /></form><span>keep</span></div>'
    );
    expect(html).toContain('keep');
    expect(html.toLowerCase()).not.toContain('iframe');
    expect(html.toLowerCase()).not.toContain('<form');
    expect(html.toLowerCase()).not.toContain('<input');
  });

  it('剥离 javascript: 链接，保留正常链接', () => {
    const bad = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(bad).not.toContain('javascript:');

    const good = sanitizeHtml('<a href="https://example.com">x</a>');
    expect(good).toContain('https://example.com');
  });

  it('按 allowRemoteImages 控制图片来源', () => {
    const remote = '<img src="https://example.com/a.png" alt="" />';
    expect(sanitizeHtml(remote, { allowRemoteImages: true })).toContain('https://example.com');
    // 关闭后 img 失去合法 src，整个元素被移除
    expect(sanitizeHtml(remote, { allowRemoteImages: false })).not.toContain('img');
  });

  it('未知标签脱壳但保留子内容', () => {
    const html = sanitizeHtml('<unknown-tag><strong>keep</strong></unknown-tag>');
    expect(html).toContain('<strong>keep</strong>');
    expect(html).not.toContain('unknown-tag');
  });

  it('清洗 CSS 时把危险规则替换为注释', () => {
    expect(sanitizeCss('h1{color:red} @import "x";')).toContain('blocked');
  });
});

/* ============================================================
 * CSS 作用域
 * ============================================================ */

describe('scopeCss', () => {
  it('给普通选择器加作用域前缀', () => {
    expect(scopeCss('h1 { color: red; }')).toContain('.cv-root h1');
  });

  it('逗号分隔的选择器逐个加前缀', () => {
    const out = scopeCss('h1, h2 { margin: 0; }');
    expect(out).toContain('.cv-root h1');
    expect(out).toContain('.cv-root h2');
  });

  it(':not() 内部的逗号不被当作选择器分隔', () => {
    const out = scopeCss('p:not(.a, .b) { color: red; }');
    expect(out).toContain('.cv-root p:not(.a, .b)');
  });

  it('@media 内部递归加前缀，@media 本身不加', () => {
    const out = scopeCss('@media print { h1 { color: red; } }');
    expect(out).toContain('@media print');
    expect(out).toContain('.cv-root h1');
    expect(out).not.toContain('.cv-root @media');
  });

  it(':root 映射为作用域根', () => {
    const out = scopeCss(':root { --x: 1px; }');
    expect(out).toContain('.cv-root {');
    expect(out).not.toContain(':root');
  });

  it('@keyframes 内部的百分比选择器不加前缀', () => {
    const out = scopeCss('@keyframes spin { 0% { opacity: 0; } 100% { opacity: 1; } }');
    expect(out).not.toContain('.cv-root 0%');
    expect(out).toContain('0% {');
  });

  it('已经手写了作用域前缀的选择器不重复加', () => {
    const out = scopeCss('.cv-root .x { color: red; }');
    expect(out).toContain('.cv-root .x');
    expect(out).not.toContain('.cv-root .cv-root');
  });

  it('声明里带花括号的字符串不破坏解析', () => {
    const out = scopeCss('.a::before { content: "{"; } .b { color: red; }');
    expect(out).toContain('.cv-root .b');
  });
});

/* ============================================================
 * 模板语法
 * ============================================================ */

describe('template-lang', () => {
  it('插值默认转义', () => {
    expect(renderTemplateSource('{{name}}', { name: '<b>A</b>' })).toBe('&lt;b&gt;A&lt;/b&gt;');
  });

  it('禁止三花括号', () => {
    expect(() => renderTemplateSource('{{{name}}}', { name: 'x' })).toThrow();
  });

  it('兼容 Mustache 的 {{#key}} 数组迭代与裸字段访问', () => {
    const out = renderMustache('Hi {{name}} {{#items}}{{title}};{{/items}}', {
      name: '<b>A</b>',
      items: [{ title: 'One' }, { title: 'Two' }],
    });
    expect(out).toContain('&lt;b&gt;A&lt;/b&gt;');
    expect(out).toContain('One;Two;');
  });

  it('each 支持 this / @index / @first / @last', () => {
    const out = renderTemplateSource(
      '{{#each list}}{{@index}}:{{this.v}}{{#unless @last}},{{/unless}}{{/each}}',
      { list: [{ v: 'a' }, { v: 'b' }] }
    );
    expect(out).toBe('0:a,1:b');
  });

  it('if / else 分支', () => {
    const tpl = '{{#if flag}}yes{{else}}no{{/if}}';
    expect(renderTemplateSource(tpl, { flag: true })).toBe('yes');
    expect(renderTemplateSource(tpl, { flag: false })).toBe('no');
  });

  it('空数组视为假值', () => {
    expect(renderTemplateSource('{{#if list}}y{{else}}n{{/if}}', { list: [] })).toBe('n');
    expect(renderTemplateSource('{{#if list}}y{{else}}n{{/if}}', { list: [1] })).toBe('y');
  });

  it('数字 0 视为真值', () => {
    expect(renderTemplateSource('{{#if n}}y{{else}}n{{/if}}', { n: 0 })).toBe('y');
  });

  it('嵌套同名 each 不会错配闭合标签', () => {
    const out = renderTemplateSource(
      '{{#each list}}[{{#each this.list}}{{this.v}}{{/each}}]{{/each}}',
      { list: [{ list: [{ v: 'a' }, { v: 'b' }] }, { list: [{ v: 'c' }] }] }
    );
    expect(out).toBe('[ab][c]');
  });

  it('with 切换作用域', () => {
    expect(renderTemplateSource('{{#with o}}{{v}}{{/with}}', { o: { v: 'x' } })).toBe('x');
  });

  it('内层找不到字段时回退到外层作用域', () => {
    const out = renderTemplateSource('{{#each list}}{{prefix}}{{this.v}}{{/each}}', {
      prefix: '-',
      list: [{ v: 'a' }],
    });
    expect(out).toBe('-a');
  });

  it('过滤器链与参数', () => {
    expect(renderTemplateSource("{{d | date('YYYY.MM')}}", { d: '2022-03' })).toBe('2022.03');
    expect(renderTemplateSource("{{x | default('fallback')}}", { x: '' })).toBe('fallback');
    expect(renderTemplateSource("{{list | join(' / ')}}", { list: ['a', 'b'] })).toBe('a / b');
  });

  it('only / exclude 按模块类型筛选', () => {
    const data = { sections: [{ type: 'a' }, { type: 'b' }, { type: 'c' }] };
    expect(renderTemplateSource("{{#each sections | only('a','c')}}{{this.type}}{{/each}}", data)).toBe('ac');
    expect(renderTemplateSource("{{#each sections | exclude('a')}}{{this.type}}{{/each}}", data)).toBe('bc');
  });

  it('拒绝未知过滤器', () => {
    expect(() => renderTemplateSource('{{x | nope}}', { x: 1 })).toThrow(/未知过滤器/);
  });

  it('拒绝访问原型链', () => {
    expect(() => renderTemplateSource('{{x.__proto__}}', { x: {} })).toThrow();
    expect(() => renderTemplateSource('{{x.constructor}}', { x: {} })).toThrow();
  });

  it('{{& }} 只允许 Safe 字段与 nl2br 输出', () => {
    expect(renderTemplateSource('{{& descriptionSafe}}', { descriptionSafe: '<b>x</b>' })).toBe('<b>x</b>');
    expect(renderTemplateSource('{{& t | nl2br}}', { t: 'a\nb' })).toBe('a<br />b');
    expect(() => renderTemplateSource('{{& raw}}', { raw: '<b>x</b>' })).toThrow(/不允许原样输出/);
  });

  it('注释被忽略', () => {
    expect(renderTemplateSource('a{{! 说明 }}b', {})).toBe('ab');
  });

  it('语法错误带行号', () => {
    const r = checkTemplateSyntax('line1\n{{#each x}}\nline3');
    expect(r.valid).toBe(false);
    expect(r.line).toBe(2);
  });

  it('闭合标签不匹配时报错', () => {
    const r = checkTemplateSyntax('{{#each x}}{{/if}}');
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain('闭合标签不匹配');
  });

  it('未闭合的 {{ 报错', () => {
    expect(checkTemplateSyntax('{{name').valid).toBe(false);
  });
});

/* ============================================================
 * helper
 * ============================================================ */

describe('helpers', () => {
  it('date 容忍多种输入，解析失败时原样返回', () => {
    expect(date('2022-03-15', 'YYYY.MM.DD')).toBe('2022.03.15');
    expect(date('2022/03', 'YYYY年M月')).toBe('2022年3月');
    expect(date('2022', 'YYYY.MM')).toBe('2022');
    expect(date('2022-03', 'MMM YYYY')).toBe('Mar 2022');
    expect(date('不是日期')).toBe('不是日期');
    expect(date('')).toBe('');
  });

  it('dateRange 在结束时间为空时显示至今', () => {
    expect(dateRange('2022-03', '', false)).toBe('2022.03 – 至今');
    expect(dateRange('2022-03', '2023-06')).toBe('2022.03 – 2023.06');
    expect(dateRange('2022-03', '2024-01', true)).toBe('2022.03 – 至今');
    expect(dateRange('', '')).toBe('');
  });
});

/* ============================================================
 * 渲染上下文
 * ============================================================ */

describe('buildRenderContext', () => {
  const data = createSampleResumeData();
  const config = normalizeTemplateConfig(getBuiltinTemplate('modern')?.config);
  const ctx = buildRenderContext(data, config);

  it('过滤空联系方式并生成可点击链接', () => {
    expect(ctx.basics.contacts.every((c) => c.value !== '')).toBe(true);
    expect(ctx.basics.contacts.find((c) => c.key === 'email')?.href).toContain('mailto:');
  });

  it('生成姓名首字用于头像占位', () => {
    expect(ctx.basics.initial).toBe('陈');
  });

  it('按 type 建立模块索引', () => {
    expect(ctx.s.experience?.type).toBe('experience');
    // 示例数据现在补齐了 awards，不再是 undefined
    expect(ctx.s.awards?.type).toBe('awards');
  });

  it('把不同模块的条目归一化为同一组字段', () => {
    const exp = ctx.s.experience?.items[0];
    expect(exp?.title).toBe('高级 Java 开发工程师');
    expect(exp?.subtitle).toBe('某电商科技有限公司');
    expect(exp?.dateRange).toContain('至今');

    const edu = ctx.s.education?.items[0];
    expect(edu?.title).toBe('某理工大学');
    expect(edu?.subtitle).toBe('本科 计算机科学与技术');

    const skill = ctx.s.skills?.items[0];
    expect(skill?.title).toBe('Java');
    // 类型专属字段通过 raw 访问
    expect(skill?.raw.level).toBe(5);
  });

  it('summary 识别为自由文本模块', () => {
    expect(ctx.s.summary?.isText).toBe(true);
    expect(ctx.s.summary?.contentSafe).toContain('Java 后端开发经验');
  });

  it('过滤隐藏的模块与条目', () => {
    const hidden = createSampleResumeData();
    const skillsCount = hidden.sections[3].items.length;
    hidden.sections[1].visible = false;
    (hidden.sections[3].items[0] as { visible: boolean }).visible = false;

    const c = buildRenderContext(hidden, config);
    expect(c.s.experience).toBeUndefined();
    expect(c.s.skills?.items).toHaveLength(skillsCount - 1);
  });

  it('templateVars 覆写模板声明的默认值', () => {
    const custom = createSampleResumeData();
    custom.metadata.templateVars = { primaryColor: '#ff0000' };
    const c = buildRenderContext(custom, config);
    expect(c.vars.primaryColor).toBe('#ff0000');
  });

  it('templateVars 缺失时（旧数据）回退读 metadata.theme', () => {
    const legacy = createSampleResumeData();
    delete legacy.metadata.templateVars;
    legacy.metadata.theme.primaryColor = '#00ff00';
    const c = buildRenderContext(legacy, config);
    expect(c.vars.primaryColor).toBe('#00ff00');
  });

  it('templateVars 为空对象时使用模板默认值，不再读 theme', () => {
    const fresh = createSampleResumeData();
    fresh.metadata.templateVars = {};
    fresh.metadata.theme.primaryColor = '#00ff00';
    const c = buildRenderContext(fresh, config);
    expect(c.vars.primaryColor).toBe(config.variables.find((v) => v.key === 'primaryColor')?.default);
  });

  it('忽略与变量类型不符的覆写值', () => {
    const bad = createSampleResumeData();
    bad.metadata.templateVars = { fontSize: 'not-a-number' as unknown as number };
    const c = buildRenderContext(bad, config);
    expect(typeof c.vars.fontSize).toBe('number');
  });
});

describe('buildCssVars', () => {
  const data = createSampleResumeData();
  const config = normalizeTemplateConfig(getBuiltinTemplate('modern')?.config);

  it('数字变量补单位，开关变量不注入', () => {
    const vars = buildCssVars(config, buildRenderContext(data, config));
    expect(vars['--tpl-font-size']).toMatch(/px$/);
    expect(vars['--tpl-line-height']).not.toMatch(/px$/);
    expect(vars['--tpl-show-avatar']).toBeUndefined();
  });

  it('注入页面尺寸与页边距', () => {
    const vars = buildCssVars(config, buildRenderContext(data, config));
    expect(vars['--page-width']).toBe('210mm');
    expect(vars['--page-margin-top']).toMatch(/mm$/);
  });

  it('拦截试图逃逸出 CSS 声明的覆写值', () => {
    const evil = createSampleResumeData();
    evil.metadata.templateVars = { primaryColor: 'red; } body { display:none' };
    const vars = buildCssVars(config, buildRenderContext(evil, config));
    expect(vars['--tpl-primary-color']).toBeUndefined();
  });
});

/* ============================================================
 * 端到端渲染
 * ============================================================ */

describe('renderTemplate', () => {
  const data = createSampleResumeData();

  it('三个内置 HTML 模板都能渲染出简历内容', () => {
    for (const builtin of BUILTIN_TEMPLATES) {
      const result = renderTemplate(builtin.config, data);
      expect(result.engine, builtin.id).toBe('html');
      expect(result.errors, builtin.id).toHaveLength(0);
      expect(result.body).toContain('cv-root');
      expect(result.body).toContain('陈昊');
      expect(result.body).toContain('工作经历');
      expect(result.css).toContain('.cv-root');
    }
  });

  it('内置模板的样式被作用域化', () => {
    const result = renderTemplate(getBuiltinTemplate('minimal')?.config, data);
    // 模板里写的是裸选择器 .cv，编译后必须带上作用域
    expect(result.css).toContain('.cv-root .cv');
  });

  it('渲染结果不含脚本', () => {
    for (const builtin of BUILTIN_TEMPLATES) {
      const result = renderTemplate(builtin.config, data);
      expect(result.body.toLowerCase()).not.toContain('<script');
      expect(result.body.toLowerCase()).not.toMatch(/\son[a-z]+=/);
    }
  });

  it('模板语法错误时输出可见的错误块而不是抛异常', () => {
    const cfg = normalizeTemplateConfig(getBuiltinTemplate('classic')?.config);
    cfg.source.html = '{{#each sections}}';
    const result = renderTemplate(cfg, data);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.body).toContain('cv-notice');
  });

  it('vue 引擎给出未启用提示', () => {
    const cfg = normalizeTemplateConfig(getBuiltinTemplate('classic')?.config);
    cfg.engine = 'vue';
    const result = renderTemplate(cfg, data);
    expect(result.errors.join()).toContain('vue');
    expect(result.body).toContain('cv-notice');
  });

  it('blocks 引擎渲染四种预设布局', () => {
    for (const layout of ['single-column', 'sidebar-left', 'sidebar-right', 'two-column'] as const) {
      const html = compileTemplateHtml(createDefaultTemplateConfig(layout), data);
      expect(html).toContain('cv-root');
      expect(html).toContain('陈昊');
      expect(html).toContain('工作经历');
    }
  });

  it('blocks 引擎的 html 区块仍支持旧的扁平变量', () => {
    const cfg = createDefaultTemplateConfig('single-column');
    cfg.document.rows[0].columns[0].blocks.push({
      id: 'h1',
      type: 'html',
      visible: true,
      content: '<div class="legacy">{{basics.name}} / {{#experience}}{{company}}{{/experience}}</div>',
    });
    const html = compileTemplateHtml(cfg, data);
    expect(html).toContain('某电商科技有限公司');
  });

  it('完整文档带 CSP 且不含 script', () => {
    const doc = renderTemplate(getBuiltinTemplate('modern')?.config, data);
    const full = compileTemplateDocument(getBuiltinTemplate('modern')?.config, data);
    expect(full).toContain('Content-Security-Policy');
    expect(full).toContain("default-src 'none'");
    expect(full.toLowerCase()).not.toContain('<script');
    expect(doc.errors).toHaveLength(0);
  });

  it('页面尺寸始终固定为 A4', () => {
    const cfg = normalizeTemplateConfig({
      ...getBuiltinTemplate('modern')?.config,
      page: { ...getBuiltinTemplate('modern')?.config.page, format: 'letter' },
    });
    const result = renderTemplate(cfg, data);
    expect(result.context.page).toMatchObject({ format: 'a4', widthMm: 210, heightMm: 297 });
  });

  it('简历侧页边距覆写模板设置', () => {
    const cfg = normalizeTemplateConfig(getBuiltinTemplate('modern')?.config);
    const custom = createSampleResumeData();
    custom.metadata.page = { format: 'a4', margin: 30 };
    const result = renderTemplate(cfg, custom);
    expect(result.context.page.margin.top).toBe(30);
  });

  it('缺省页边距时跟随模板设置', () => {
    const cfg = normalizeTemplateConfig(getBuiltinTemplate('modern')?.config);
    cfg.page.margin = { top: 5, right: 6, bottom: 7, left: 8 };
    const result = renderTemplate(cfg, createSampleResumeData());
    expect(result.context.page.margin).toEqual({ top: 5, right: 6, bottom: 7, left: 8 });
  });
});
