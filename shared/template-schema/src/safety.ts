/**
 * 模板安全规则 —— 前后端唯一来源
 *
 * 这里只做「基于文本的规则检测」，用于保存前校验与错误提示。
 * 真正的 DOM 级清洗在前端 sanitize.ts（需要 DOMParser）。
 */

import { TEMPLATE_LIMITS } from './limits';

/* ============================================================
 * CSS
 * ============================================================ */

/** 与 url() 无关的危险 CSS 语法 */
export const FORBIDDEN_CSS_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /@import/i, label: '@import 外部样式' },
  { re: /expression\s*\(/i, label: 'expression()' },
  { re: /javascript\s*:/i, label: 'javascript: 协议' },
  { re: /behavior\s*:/i, label: 'behavior 属性' },
  { re: /-moz-binding/i, label: '-moz-binding' },
  { re: /@charset/i, label: '@charset' },
];

/** 匹配 url(...)，捕获组 2 是 URL 内容 */
const CSS_URL_RE = /url\s*\(\s*(['"]?)([^'")]*)\1\s*\)/gi;

export interface ICssCheckOptions {
  allowRemoteImages?: boolean;
  allowWebFonts?: boolean;
  maxLength?: number;
}

/**
 * 校验 CSS 文本。返回错误信息数组，空数组表示通过。
 *
 * url() 不再无条件拦截：
 *   - data:image/... 始终放行
 *   - https:// 视 allowRemoteImages
 *   - 其余（含 http:、相对路径、javascript:）拦截
 */
export function checkCss(css: string, options: ICssCheckOptions = {}): string[] {
  const errors: string[] = [];
  if (!css) return errors;

  const maxLength = options.maxLength ?? TEMPLATE_LIMITS.maxCssLength;
  if (css.length > maxLength) {
    errors.push(`CSS 超过 ${maxLength} 字符`);
  }

  for (const { re, label } of FORBIDDEN_CSS_PATTERNS) {
    if (re.test(css)) {
      errors.push(`CSS 包含禁止语法：${label}`);
    }
  }

  if (!options.allowWebFonts && /@font-face/i.test(css)) {
    errors.push('CSS 包含 @font-face，当前模板未开启网络字体能力');
  }

  // url() 逐个判定
  CSS_URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CSS_URL_RE.exec(css)) !== null) {
    const url = (match[2] || '').trim();
    const verdict = classifyCssUrl(url, options.allowRemoteImages ?? true);
    if (verdict) errors.push(verdict);
  }

  // HTML 标签夹带
  if (/<\s*\/?\s*[a-z]/i.test(css)) {
    errors.push('CSS 中不允许出现 HTML 标签');
  }

  return errors;
}

/** 返回错误信息，或 null 表示该 url() 合法 */
function classifyCssUrl(url: string, allowRemoteImages: boolean): string | null {
  if (!url) return 'CSS 中存在空的 url()';
  if (/^data:image\//i.test(url)) return null;
  if (/^https:\/\//i.test(url)) {
    return allowRemoteImages ? null : 'CSS 中的 https 外链资源已被禁用，请改用 data:image';
  }
  return `CSS 中的 url(${truncate(url, 40)}) 不被允许，仅支持 data:image/ 与 https://`;
}

/**
 * 运行时清洗 CSS：把违规片段替换为注释，而不是整体拒绝。
 * 用于渲染阶段的兜底（校验已在保存时拦过一轮）。
 */
export function sanitizeCssText(css: string, options: ICssCheckOptions = {}): string {
  if (!css) return '';
  let cleaned = css;

  for (const { re } of FORBIDDEN_CSS_PATTERNS) {
    cleaned = cleaned.replace(new RegExp(re.source, 'gi'), '/* blocked */');
  }

  if (!options.allowWebFonts) {
    cleaned = cleaned.replace(/@font-face\s*\{[^}]*\}/gi, '/* blocked @font-face */');
  }

  cleaned = cleaned.replace(CSS_URL_RE, (full, _quote: string, url: string) => {
    return classifyCssUrl((url || '').trim(), options.allowRemoteImages ?? true)
      ? 'none /* blocked url */'
      : full;
  });

  // 去掉夹带的 HTML 标签
  cleaned = cleaned.replace(/<\/?[a-z][^>]*>/gi, '');

  return cleaned;
}

/* ============================================================
 * HTML
 * ============================================================ */

/** 渲染结果允许保留的标签 */
export const ALLOWED_TAGS: readonly string[] = [
  'div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'a', 'img', 'hr', 'blockquote', 'code', 'pre',
  'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'figure', 'figcaption',
  'small', 'sub', 'sup', 'time', 'address', 'mark', 'abbr',
];

/** 渲染结果允许保留的属性 */
export const ALLOWED_ATTRS: readonly string[] = [
  'class', 'id', 'style', 'href', 'src', 'alt', 'title',
  'width', 'height', 'colspan', 'rowspan', 'span',
  'datetime', 'lang', 'dir', 'role', 'aria-label', 'aria-hidden',
];

/** 无论如何都要移除的标签 */
export const STRIPPED_TAGS: readonly string[] = [
  'script', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
  'form', 'input', 'button', 'textarea', 'select', 'option',
  'svg', 'math', 'style', 'template', 'noscript', 'frame', 'frameset', 'applet',
];

export interface IHtmlCheckOptions {
  allowRemoteImages?: boolean;
  maxLength?: number;
}

/**
 * 校验模板 HTML 源码（模板作者写的、含插值语法的原始文本）。
 *
 * 注意：这里检查的是「模板源码」，不是渲染结果。渲染结果还会经过 DOM 级清洗。
 */
export function checkTemplateHtml(html: string, options: IHtmlCheckOptions = {}): string[] {
  const errors: string[] = [];
  if (!html) return errors;

  const maxLength = options.maxLength ?? TEMPLATE_LIMITS.maxHtmlLength;
  if (html.length > maxLength) {
    errors.push(`HTML 超过 ${maxLength} 字符`);
  }

  if (html.includes('{{{')) {
    errors.push('禁止三花括号原始输出，请使用 {{& field}} 输出受信 HTML');
  }

  for (const tag of STRIPPED_TAGS) {
    // <style> 由 source.css 承载，单独给更明确的提示
    if (new RegExp(`<\\s*${tag}\\b`, 'i').test(html)) {
      errors.push(
        tag === 'style'
          ? 'HTML 中不允许 <style>，请把样式写在 CSS 面板'
          : `HTML 包含禁止的标签 <${tag}>`
      );
    }
  }

  if (/\son[a-z]+\s*=/i.test(html)) {
    errors.push('HTML 包含事件属性（on*），模板中不允许脚本');
  }

  if (/javascript\s*:/i.test(html)) {
    errors.push('HTML 包含 javascript: 协议');
  }

  if (/<\s*a\b[^>]*\bhref\s*=\s*["']?\s*data:/i.test(html)) {
    errors.push('HTML 中的链接不允许 data: 协议');
  }

  return errors;
}

/* ============================================================
 * 工具
 * ============================================================ */

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

/** URL 是否可作为 img src */
export function isSafeImageUrl(url: string, allowRemoteImages = true): boolean {
  if (!url) return false;
  if (/^data:image\//i.test(url)) return true;
  if (/^https:\/\//i.test(url)) return allowRemoteImages;
  return false;
}

/** URL 是否可作为 a href */
export function isSafeLinkUrl(url: string): boolean {
  if (!url) return false;
  return /^(https?:\/\/|mailto:|tel:|#|\/)/i.test(url);
}
