/**
 * 后端模板 schema 自检
 *
 * 后端没有测试运行器（依赖 wrangler 环境），这里用可执行的断言函数替代，
 * 既是文档也能在需要时用 tsx/node 跑一遍。真正的回归覆盖在前端 vitest 里，
 * 因为校验实现是前后端共享的同一份代码。
 */

import {
  BUILTIN_TEMPLATES,
  assertSafeCss,
  normalizeIncomingConfig,
  parseTemplateConfig,
  validateTemplateConfig,
} from './schema';

export function runTemplateSchemaSelfCheck(): string[] {
  const errors: string[] = [];
  const expect = (condition: boolean, message: string) => {
    if (!condition) errors.push(message);
  };

  /* --- 旧配置迁移 --- */
  const legacy = normalizeIncomingConfig({
    layout: 'sidebar-left',
    primaryColor: '#2563eb',
    fontFamily: 'Microsoft YaHei',
    fontSize: 14,
    spacing: 1.15,
  });
  expect(legacy.schemaVersion === 2, 'legacy config should migrate to schemaVersion 2');
  expect(legacy.engine === 'blocks', 'legacy config should land on blocks engine');
  expect(legacy.document.rows.length > 0, 'legacy config should get a document');
  expect(validateTemplateConfig(legacy).valid, 'migrated legacy config should validate');

  /* --- CSS 安全 --- */
  expect(assertSafeCss('@import url(x)') !== null, 'css should reject @import');
  expect(assertSafeCss('.a{color:red}') === null, 'safe css should pass');
  expect(
    assertSafeCss('.a{background:url(data:image/png;base64,AAA)}') === null,
    'data:image url should be allowed'
  );
  expect(
    assertSafeCss('.a{background:url(http://evil.test/a.png)}') !== null,
    'http url should be rejected'
  );

  /* --- 内置模板必须自洽 --- */
  for (const builtin of BUILTIN_TEMPLATES) {
    const result = validateTemplateConfig(builtin.config);
    expect(result.valid, `builtin template ${builtin.id} invalid: ${result.errors[0] || ''}`);
    expect(builtin.config.engine === 'html', `builtin template ${builtin.id} should use html engine`);
    expect(
      Boolean(builtin.config.source.html?.trim()),
      `builtin template ${builtin.id} should have html source`
    );
  }

  /* --- 危险 HTML 必须被拒 --- */
  const dangerous = parseTemplateConfig({
    ...BUILTIN_TEMPLATES[0].config,
    source: {
      html: '<div onclick="steal()">{{basics.name}}</div>',
      css: '',
    },
  });
  expect(!dangerous.success, 'html with event attribute should be rejected');

  const tripleBrace = parseTemplateConfig({
    ...BUILTIN_TEMPLATES[0].config,
    source: { html: '<div>{{{basics.name}}}</div>', css: '' },
  });
  expect(!tripleBrace.success, 'triple mustache should be rejected');

  const scriptTag = parseTemplateConfig({
    ...BUILTIN_TEMPLATES[0].config,
    source: { html: '<div><script>alert(1)</script></div>', css: '' },
  });
  expect(!scriptTag.success, 'script tag should be rejected');

  /* --- engine=html 必须有源码 --- */
  const emptyHtml = validateTemplateConfig({
    ...BUILTIN_TEMPLATES[0].config,
    engine: 'html',
    source: { html: '   ', css: '' },
  });
  expect(!emptyHtml.valid, 'engine=html with blank source should be invalid');

  /* --- vue 引擎当前不放行 --- */
  const vueConfig = validateTemplateConfig({
    ...BUILTIN_TEMPLATES[0].config,
    engine: 'vue',
    source: { vue: '<template><div /></template>', css: '' },
  });
  expect(!vueConfig.valid, 'vue engine should be rejected while disabled');

  /* --- 变量声明 --- */
  const badVariable = validateTemplateConfig({
    ...BUILTIN_TEMPLATES[0].config,
    variables: [{ key: '2bad', label: 'x', type: 'text', default: '' }],
  });
  expect(!badVariable.valid, 'invalid variable key should be rejected');

  return errors;
}
