/**
 * CSS 作用域化
 *
 * 模板作者写 `h1 { ... }`，编译后变成 `.cv-root h1 { ... }`，
 * 这样模板样式不会泄漏到预览容器之外，也不必要求作者自己加前缀。
 */

const SCOPE_SELECTOR = '.cv-root';

/** 这些 at-rule 内部还是规则列表，需要递归处理 */
const NESTED_AT_RULES = new Set(['media', 'supports', 'container', 'layer', 'document', 'scope']);

/** 这些 at-rule 内部不是选择器，原样保留 */
const OPAQUE_AT_RULES = new Set(['keyframes', 'font-face', 'page', 'counter-style', 'property', 'font-feature-values']);

/** 直接映射为作用域根的选择器 */
const ROOT_SELECTORS = new Set([':root', 'html', 'body', ':host']);

/**
 * 给单条选择器加作用域前缀
 */
function scopeSelector(selector: string, scope: string): string {
  const sel = selector.trim();
  if (!sel) return '';

  // 已经手动写了作用域前缀
  if (sel === scope || sel.startsWith(`${scope} `) || sel.startsWith(`${scope}.`) ||
      sel.startsWith(`${scope}:`) || sel.startsWith(`${scope}>`)) {
    return sel;
  }

  if (ROOT_SELECTORS.has(sel)) return scope;

  // :root.dark → .cv-root.dark
  for (const rootSel of ROOT_SELECTORS) {
    if (sel.startsWith(rootSel) && /^[.:[]/.test(sel.slice(rootSel.length))) {
      return scope + sel.slice(rootSel.length);
    }
  }

  // 组合器开头（> + ~）无法作用域化，保持原样避免产出非法选择器
  if (/^[>+~]/.test(sel)) return sel;

  return `${scope} ${sel}`;
}

function scopeSelectorList(prelude: string, scope: string): string {
  return splitSelectors(prelude)
    .map((s) => scopeSelector(s, scope))
    .filter(Boolean)
    .join(', ');
}

/** 按逗号分割选择器，忽略括号与字符串内的逗号（:not(a, b)） */
function splitSelectors(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      current += ch;
      if (ch === '\\' && i + 1 < input.length) {
        current += input[i + 1];
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

interface IScanState {
  index: number;
}

/** 从 state.index 开始找到顶层的 { 或 } 或 ; */
function findStructural(css: string, state: IScanState): { char: string; index: number } | null {
  let quote: string | null = null;

  for (let i = state.index; i < css.length; i++) {
    const ch = css[i];

    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    // 注释
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 1;
      continue;
    }

    if (ch === '{' || ch === '}' || ch === ';') {
      return { char: ch, index: i };
    }
  }

  return null;
}

/** 找到与 openIndex 处 { 匹配的 } 的下标；找不到返回 css.length */
function findBlockEnd(css: string, openIndex: number): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = openIndex; i < css.length; i++) {
    const ch = css[i];

    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 1;
      continue;
    }

    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return css.length;
}

function atRuleName(prelude: string): string | null {
  const m = prelude.trim().match(/^@([A-Za-z-]+)/);
  return m ? m[1].toLowerCase() : null;
}

/**
 * 递归处理一段规则列表
 */
function scopeRuleList(css: string, scope: string, depth: number): string {
  if (depth > 8) return css;

  const out: string[] = [];
  const state: IScanState = { index: 0 };
  let cursor = 0;

  while (state.index < css.length) {
    const found = findStructural(css, state);
    if (!found) break;

    if (found.char === ';') {
      // 无块的语句（@import / @charset 等，安全层已拦截，这里原样透传）
      out.push(css.slice(cursor, found.index + 1));
      cursor = found.index + 1;
      state.index = cursor;
      continue;
    }

    if (found.char === '}') {
      // 多余的右括号，原样输出避免破坏后续内容
      out.push(css.slice(cursor, found.index + 1));
      cursor = found.index + 1;
      state.index = cursor;
      continue;
    }

    // found.char === '{'
    const prelude = css.slice(cursor, found.index);
    const blockEnd = findBlockEnd(css, found.index);
    const body = css.slice(found.index + 1, blockEnd);

    const at = atRuleName(prelude);

    if (at && OPAQUE_AT_RULES.has(at)) {
      out.push(`${prelude}{${body}}`);
    } else if (at && NESTED_AT_RULES.has(at)) {
      out.push(`${prelude}{${scopeRuleList(body, scope, depth + 1)}}`);
    } else if (at) {
      // 未知 at-rule：保守原样输出
      out.push(`${prelude}{${body}}`);
    } else {
      const scoped = scopeSelectorList(prelude, scope);
      // 保留 prelude 前的空白与注释，让输出仍然可读
      const leading = prelude.match(/^\s*/)?.[0] ?? '';
      out.push(`${leading}${scoped} {${body}}`);
    }

    cursor = blockEnd + 1;
    state.index = cursor;
  }

  if (cursor < css.length) out.push(css.slice(cursor));

  return out.join('');
}

/**
 * 把 CSS 限制在作用域选择器下。
 *
 * @param css   模板 CSS
 * @param scope 作用域选择器，默认 .cv-root
 */
export function scopeCss(css: string, scope: string = SCOPE_SELECTOR): string {
  if (!css || !css.trim()) return '';
  try {
    return scopeRuleList(css, scope, 0);
  } catch {
    // 解析失败时退化为整体包裹，保证样式不泄漏
    return `${scope} { ${css} }`;
  }
}

export { SCOPE_SELECTOR };
