/**
 * HTML / CSS 安全清洗（无脚本、无外联）
 */

const FORBIDDEN_CSS = [
  /@import/i,
  /url\s*\(/i,
  /expression\s*\(/i,
  /javascript\s*:/i,
  /behavior\s*:/i,
  /-moz-binding/i,
];

/**
 * 清洗自定义 CSS：去掉危险规则，并限制在 .cv-root 作用域
 */
export function sanitizeCss(css: string): string {
  if (!css) return '';
  let cleaned = css;
  for (const re of FORBIDDEN_CSS) {
    if (re.test(cleaned)) {
      cleaned = cleaned.replace(re, '/* blocked */');
    }
  }
  // 去掉 HTML 标签，防止 style 中夹带 markup
  cleaned = cleaned.replace(/<\/?[^>]+>/g, '');
  return cleaned;
}

const ALLOWED_TAGS = new Set([
  'div',
  'span',
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'a',
  'img',
  'hr',
  'section',
  'article',
  'header',
  'footer',
  'small',
]);

const ALLOWED_ATTRS = new Set([
  'class',
  'id',
  'style',
  'href',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'colspan',
  'rowspan',
]);

/**
 * 轻量 HTML 清洗：仅允许白名单标签/属性，去掉事件与脚本
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    return sanitizeHtmlFallback(html);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__root');
  if (!root) return '';

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'iframe' || tag === 'object' || tag === 'embed' || tag === 'link' || tag === 'meta' || tag === 'base' || tag === 'form' || tag === 'input' || tag === 'button' || tag === 'textarea' || tag === 'svg') {
          el.remove();
          continue;
        }
        if (!ALLOWED_TAGS.has(tag)) {
          // unwrap unknown tags
          while (el.firstChild) {
            el.parentNode?.insertBefore(el.firstChild, el);
          }
          el.remove();
          continue;
        }

        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          const value = attr.value;
          if (name.startsWith('on') || !ALLOWED_ATTRS.has(name)) {
            el.removeAttribute(attr.name);
            continue;
          }
          if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (name === 'href' && !/^(https?:|mailto:|#|\/)/i.test(value)) {
            el.removeAttribute(attr.name);
          }
          if (name === 'src' && !/^(https?:|data:image\/)/i.test(value)) {
            el.removeAttribute(attr.name);
          }
          if (name === 'style' && FORBIDDEN_CSS.some((re) => re.test(value))) {
            el.removeAttribute(attr.name);
          }
        }
        walk(el);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.parentNode?.removeChild(child);
      }
    }
  };

  walk(root);
  return root.innerHTML;
}

function sanitizeHtmlFallback(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|link|meta|base|form|input|button|textarea|svg)[\s\S]*?>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|meta|base|form|input|button|textarea|svg)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '');
}
