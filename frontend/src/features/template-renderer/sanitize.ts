/**
 * HTML / CSS 清洗
 *
 * 规则来自 @cv/template-schema/safety（前后端共享），这里只负责 DOM 级执行。
 * 渲染管线里这是最后一道关：模板可能来自其他用户，输出必须是零脚本的静态 HTML。
 */

import {
  ALLOWED_ATTRS,
  ALLOWED_TAGS,
  FORBIDDEN_CSS_PATTERNS,
  STRIPPED_TAGS,
  isSafeImageUrl,
  isSafeLinkUrl,
  sanitizeCssText,
} from '@cv/template-schema';

const ALLOWED_TAG_SET = new Set(ALLOWED_TAGS);
const ALLOWED_ATTR_SET = new Set(ALLOWED_ATTRS);
const STRIPPED_TAG_SET = new Set(STRIPPED_TAGS);

export interface ISanitizeOptions {
  allowRemoteImages?: boolean;
  allowWebFonts?: boolean;
}

/* ============================================================
 * CSS
 * ============================================================ */

/**
 * 清洗自定义 CSS：把危险规则替换为注释。
 * 注意这里不做作用域化，作用域化在 css-scope.ts。
 */
export function sanitizeCss(css: string, options: ISanitizeOptions = {}): string {
  return sanitizeCssText(css, options);
}

/* ============================================================
 * HTML
 * ============================================================ */

/**
 * 白名单清洗 HTML。
 *
 * 浏览器环境走 DOMParser；无 DOM 的环境（Node / Worker）退化为正则实现。
 * 两条路径的白名单是同一份，但 DOM 路径更严格，因此生产渲染务必在浏览器侧执行。
 */
export function sanitizeHtml(html: string, options: ISanitizeOptions = {}): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    return sanitizeHtmlFallback(html);
  }

  const allowRemoteImages = options.allowRemoteImages ?? true;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__cv_root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__cv_root');
  if (!root) return '';

  walk(root, allowRemoteImages);
  return root.innerHTML;
}

function walk(node: Node, allowRemoteImages: boolean): void {
  const children = Array.from(node.childNodes);

  for (const child of children) {
    if (child.nodeType === 8 /* COMMENT_NODE */) {
      child.parentNode?.removeChild(child);
      continue;
    }

    if (child.nodeType !== 1 /* ELEMENT_NODE */) continue;

    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // 危险标签：整体移除（含子树）
    if (STRIPPED_TAG_SET.has(tag)) {
      el.remove();
      continue;
    }

    // 未知标签：脱壳，保留子节点
    if (!ALLOWED_TAG_SET.has(tag)) {
      while (el.firstChild) {
        el.parentNode?.insertBefore(el.firstChild, el);
      }
      el.remove();
      continue;
    }

    cleanAttributes(el, tag, allowRemoteImages);
    walk(el, allowRemoteImages);
  }
}

function cleanAttributes(el: HTMLElement, tag: string, allowRemoteImages: boolean): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;

    if (name.startsWith('on') || !ALLOWED_ATTR_SET.has(name)) {
      el.removeAttribute(attr.name);
      continue;
    }

    if (name === 'href') {
      if (!isSafeLinkUrl(value)) el.removeAttribute(attr.name);
      continue;
    }

    if (name === 'src') {
      if (!isSafeImageUrl(value, allowRemoteImages)) el.removeAttribute(attr.name);
      continue;
    }

    if (name === 'style') {
      const cleaned = sanitizeInlineStyle(value, allowRemoteImages);
      if (cleaned) el.setAttribute('style', cleaned);
      else el.removeAttribute(attr.name);
      continue;
    }
  }

  // img 缺少合法 src 时直接移除，避免留下破图
  if (tag === 'img' && !el.getAttribute('src')) {
    el.remove();
  }
}

function sanitizeInlineStyle(value: string, allowRemoteImages: boolean): string {
  if (!value) return '';
  for (const { re } of FORBIDDEN_CSS_PATTERNS) {
    if (re.test(value)) return '';
  }
  // 内联样式里的 url() 按图片规则判定
  const urlMatch = value.match(/url\s*\(\s*(['"]?)([^'")]*)\1\s*\)/i);
  if (urlMatch && !isSafeImageUrl((urlMatch[2] || '').trim(), allowRemoteImages)) {
    return '';
  }
  return value;
}

/* ============================================================
 * 无 DOM 环境的降级实现
 * ============================================================ */

const STRIPPED_TAGS_PATTERN = STRIPPED_TAGS.join('|');

export function sanitizeHtmlFallback(html: string): string {
  return html
    .replace(
      new RegExp(`<\\s*(${STRIPPED_TAGS_PATTERN})\\b[\\s\\S]*?<\\s*/\\s*\\1\\s*>`, 'gi'),
      ''
    )
    .replace(new RegExp(`<\\s*/?\\s*(${STRIPPED_TAGS_PATTERN})\\b[^>]*>`, 'gi'), '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}
