/**
 * 受限 Mustache：仅支持 {{path}} 与 {{#section}}...{{/section}}
 * 禁止三花括号、partial 与 lambda
 */

function getPath(ctx: unknown, path: string): unknown {
  if (!path) return ctx;
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function escapeHtml(value: unknown): string {
  const str = value == null ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 渲染受限 Mustache 模板
 */
export function renderMustache(template: string, data: Record<string, unknown>): string {
  if (template.includes('{{{')) {
    throw new Error('禁止三花括号原始输出');
  }

  let result = template;

  // sections: {{#key}}...{{/key}}
  const sectionRe = /\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  result = result.replace(sectionRe, (_m, key: string, inner: string) => {
    const value = getPath(data, key);
    if (Array.isArray(value)) {
      return value.map((item) => renderMustache(inner, { ...data, ...(item as object), '.': item })).join('');
    }
    if (value) {
      return renderMustache(inner, typeof value === 'object' ? { ...data, ...(value as object) } : data);
    }
    return '';
  });

  // inverted: {{^key}}...{{/key}}
  const invertedRe = /\{\{\^([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  result = result.replace(invertedRe, (_m, key: string, inner: string) => {
    const value = getPath(data, key);
    const empty = value == null || value === false || (Array.isArray(value) && value.length === 0);
    return empty ? renderMustache(inner, data) : '';
  });

  // variables
  result = result.replace(/\{\{([\w.]+)\}\}/g, (_m, key: string) => escapeHtml(getPath(data, key)));

  return result;
}
