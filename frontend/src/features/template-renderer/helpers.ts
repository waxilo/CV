/**
 * 模板 helper / 过滤器
 *
 * HTML 引擎里以过滤器形式调用：{{value | date('YYYY.MM')}}
 * 全部是纯函数，白名单注册在 HELPERS 里，模板无法调用未注册的函数。
 */

/** 标记「已清洗、可原样输出」的 HTML 片段 */
export class SafeHtml {
  constructor(public readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export function markSafe(html: string): SafeHtml {
  return new SafeHtml(html);
}

export function escapeHtml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
 * 日期
 * ============================================================ */

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface IParsedDate {
  year: number;
  month?: number;
  day?: number;
}

/** 容忍多种输入：2022 / 2022-03 / 2022-03-15 / 2022/03 / 2022.03 */
function parseDate(value: unknown): IParsedDate | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const m = raw.match(/^(\d{4})(?:[-/.](\d{1,2}))?(?:[-/.](\d{1,2}))?/);
  if (!m) return null;

  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : undefined;
  const day = m[3] ? Number(m[3]) : undefined;

  if (!Number.isFinite(year)) return null;
  if (month !== undefined && (month < 1 || month > 12)) return { year };
  return { year, month, day };
}

const DATE_TOKEN_RE = /YYYY|YY|MMMM|MMM|MM|M|DD|D/g;

/**
 * 格式化日期。解析失败时原样返回输入，不抛错。
 */
export function date(value: unknown, format = 'YYYY.MM'): string {
  const parsed = parseDate(value);
  if (!parsed) return value == null ? '' : String(value);

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = String(format);

  /*
   * 只有当格式里要求了月/日、而输入里恰好缺这一级时，才需要清理尾部悬挂的分隔符
   * （'2022' + 'YYYY.MM' → '2022.' → '2022'）。
   * 否则不能动尾部，'YYYY年M月' 的「月」是格式的一部分，不是悬挂分隔符。
   */
  const needsTrim =
    (!parsed.month && /M/.test(fmt)) || (!parsed.day && /D/.test(fmt));

  const rendered = fmt.replace(DATE_TOKEN_RE, (token) => {
    switch (token) {
      case 'YYYY':
        return String(parsed.year);
      case 'YY':
        return String(parsed.year).slice(-2);
      case 'MMMM':
        return parsed.month ? MONTH_LONG[parsed.month - 1] : '';
      case 'MMM':
        return parsed.month ? MONTH_SHORT[parsed.month - 1] : '';
      case 'MM':
        return parsed.month ? pad(parsed.month) : '';
      case 'M':
        return parsed.month ? String(parsed.month) : '';
      case 'DD':
        return parsed.day ? pad(parsed.day) : '';
      case 'D':
        return parsed.day ? String(parsed.day) : '';
      default:
        return token;
    }
  });

  return (needsTrim ? rendered.replace(/[.\-/年月日\s]+$/u, '') : rendered).trim();
}

export const PRESENT_LABEL = '至今';

/**
 * 拼接时间区间。end 为空视为「至今」。
 */
export function dateRange(
  start: unknown,
  end: unknown,
  isCurrent: unknown = false,
  format = 'YYYY.MM'
): string {
  const s = date(start, format);
  const rawEnd = end == null ? '' : String(end).trim();
  const e = isCurrent || !rawEnd ? PRESENT_LABEL : date(end, format);

  if (!s && !rawEnd) return '';
  if (!s) return e;
  if (e === s) return s;
  return `${s} – ${e}`;
}

/* ============================================================
 * 字符串 / 数组
 * ============================================================ */

export function join(value: unknown, separator = ' · '): string {
  if (Array.isArray(value)) return value.filter((v) => v != null && v !== '').join(separator);
  return value == null ? '' : String(value);
}

export function truncate(value: unknown, max = 100, suffix = '…'): string {
  const str = value == null ? '' : String(value);
  const limit = Number(max) || 0;
  if (limit <= 0 || str.length <= limit) return str;
  return str.slice(0, limit) + suffix;
}

export function upper(value: unknown): string {
  return value == null ? '' : String(value).toUpperCase();
}

export function lower(value: unknown): string {
  return value == null ? '' : String(value).toLowerCase();
}

/** 换行转 <br>，结果标记为可原样输出 */
export function nl2br(value: unknown): SafeHtml {
  const escaped = escapeHtml(value);
  return markSafe(escaped.replace(/\r?\n/g, '<br />'));
}

/**
 * 简历描述 Markdown → HTML（先转义再解析，输出仍需走 sanitizeHtml）。
 * 支持：段落/换行、**加粗**、*斜体*、~~删除线~~、`代码`、[链接](https://…)、- / 1. 列表。
 */
export function richTextToHtml(text: string): string {
  if (!text) return '';
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        const raw = lines[index].replace(/^\s*[-*+]\s+/, '');
        items.push(`<li>${inlineMarkdown(escapeHtml(raw))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        const raw = lines[index].replace(/^\s*\d+\.\s+/, '');
        items.push(`<li>${inlineMarkdown(escapeHtml(raw))}</li>`);
        index += 1;
      }
      blocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(inlineMarkdown(escapeHtml(lines[index])));
      index += 1;
    }
    blocks.push(`<p>${paragraph.join('<br />')}</p>`);
  }

  return blocks.join('');
}

/** 已转义文本上的行内 Markdown */
function inlineMarkdown(escaped: string): string {
  let html = escaped;
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>'
  );
  html = html.replace(/\*\*((?:[^*]|\*(?!\*))+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__((?:[^_]|_(?!_))+?)__/g, '<strong>$1</strong>');
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  // 单星斜体，避开已处理的 **
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
  return html;
}

export type TMarkdownMarker = '**' | '*' | '~~' | '`';

/**
 * 对选区切换 Markdown 标记包裹。无选区时插入一对标记并把光标放中间。
 */
export function toggleMarkdownMarkers(
  value: string,
  start: number,
  end: number,
  marker: TMarkdownMarker
): { value: string; start: number; end: number } {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  const open = marker;
  const close = marker;
  const wrapLen = open.length;

  if (safeStart === safeEnd) {
    const insert = `${open}${close}`;
    const next = `${value.slice(0, safeStart)}${insert}${value.slice(safeEnd)}`;
    return { value: next, start: safeStart + wrapLen, end: safeStart + wrapLen };
  }

  const selected = value.slice(safeStart, safeEnd);
  if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= wrapLen * 2) {
    const inner = selected.slice(wrapLen, selected.length - wrapLen);
    const next = `${value.slice(0, safeStart)}${inner}${value.slice(safeEnd)}`;
    return { value: next, start: safeStart, end: safeStart + inner.length };
  }

  if (
    safeStart >= wrapLen &&
    safeEnd + wrapLen <= value.length &&
    value.slice(safeStart - wrapLen, safeStart) === open &&
    value.slice(safeEnd, safeEnd + wrapLen) === close
  ) {
    const next = `${value.slice(0, safeStart - wrapLen)}${selected}${value.slice(safeEnd + wrapLen)}`;
    return { value: next, start: safeStart - wrapLen, end: safeEnd - wrapLen };
  }

  const wrapped = `${open}${selected}${close}`;
  const next = `${value.slice(0, safeStart)}${wrapped}${value.slice(safeEnd)}`;
  return { value: next, start: safeStart, end: safeStart + wrapped.length };
}

/** @deprecated 使用 toggleMarkdownMarkers(value, start, end, '**') */
export function toggleBoldMarkers(
  value: string,
  start: number,
  end: number
): { value: string; start: number; end: number } {
  return toggleMarkdownMarkers(value, start, end, '**');
}

/** 给选中行（或当前行）加上无序列表前缀 */
export function toggleListMarkers(
  value: string,
  start: number,
  end: number
): { value: string; start: number; end: number } {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  const lineStart = value.lastIndexOf('\n', Math.max(0, safeStart - 1)) + 1;
  const lineEndIdx = value.indexOf('\n', safeEnd);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allListed = lines.every((line) => /^\s*[-*+]\s+/.test(line) || !line.trim());
  const nextLines = lines.map((line) => {
    if (!line.trim()) return line;
    if (allListed) return line.replace(/^\s*[-*+]\s+/, '');
    if (/^\s*[-*+]\s+/.test(line)) return line;
    return `- ${line}`;
  });
  const nextBlock = nextLines.join('\n');
  const next = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
  return { value: next, start: lineStart, end: lineStart + nextBlock.length };
}

/** 把选区包成 Markdown 链接；无选区时插入占位 */
export function wrapLinkMarkers(
  value: string,
  start: number,
  end: number,
  url = 'https://'
): { value: string; start: number; end: number } {
  const safeStart = Math.max(0, Math.min(start, value.length));
  const safeEnd = Math.max(safeStart, Math.min(end, value.length));
  const selected = value.slice(safeStart, safeEnd) || '链接文字';
  const wrapped = `[${selected}](${url})`;
  const next = `${value.slice(0, safeStart)}${wrapped}${value.slice(safeEnd)}`;
  const urlStart = safeStart + selected.length + 3;
  return { value: next, start: urlStart, end: urlStart + url.length };
}

/** 空值兜底。空字符串、null、undefined、空数组都算空 */
export function fallback(value: unknown, replacement: unknown = ''): unknown {
  if (value == null) return replacement;
  if (typeof value === 'string' && value.trim() === '') return replacement;
  if (Array.isArray(value) && value.length === 0) return replacement;
  return value;
}

/* ============================================================
 * 数值 / 比较
 * ============================================================ */

/** 把 value 换算为占 max 的百分比字符串，用于技能条宽度 */
export function percent(value: unknown, max: unknown = 100): string {
  const v = Number(value) || 0;
  const m = Number(max) || 100;
  if (m <= 0) return '0%';
  const ratio = Math.min(1, Math.max(0, v / m));
  return `${Math.round(ratio * 1000) / 10}%`;
}

export function eq(value: unknown, other: unknown): boolean {
  if (value === other) return true;
  if (value == null || other == null) return false;
  return String(value) === String(other);
}

export function ne(value: unknown, other: unknown): boolean {
  return !eq(value, other);
}

export function gt(value: unknown, other: unknown): boolean {
  return Number(value) > Number(other);
}

export function lt(value: unknown, other: unknown): boolean {
  return Number(value) < Number(other);
}

/* ============================================================
 * 模块筛选（用于自由分栏）
 * ============================================================ */

interface ITypedItem {
  type?: string;
}

/** 只保留指定 type 的模块，并保持传入的 type 顺序无关、沿用原始顺序 */
export function only(value: unknown, ...types: unknown[]): unknown[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(types.map((t) => String(t)));
  return value.filter((item) => wanted.has(String((item as ITypedItem)?.type)));
}

/** 排除指定 type 的模块 */
export function exclude(value: unknown, ...types: unknown[]): unknown[] {
  if (!Array.isArray(value)) return [];
  const unwanted = new Set(types.map((t) => String(t)));
  return value.filter((item) => !unwanted.has(String((item as ITypedItem)?.type)));
}

/** 取数组前 n 项 */
export function take(value: unknown, n: unknown = 1): unknown[] {
  if (!Array.isArray(value)) return [];
  const count = Number(n);
  return Number.isFinite(count) && count > 0 ? value.slice(0, count) : [];
}

/** 数组长度 / 字符串长度 */
export function size(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'string') return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

/* ============================================================
 * 白名单注册表
 * ============================================================ */

export type THelperFn = (...args: unknown[]) => unknown;

export const HELPERS: Record<string, THelperFn> = {
  date: (...a) => date(a[0], a[1] as string | undefined),
  dateRange: (...a) => dateRange(a[0], a[1], a[2], a[3] as string | undefined),
  join: (...a) => join(a[0], a[1] as string | undefined),
  truncate: (...a) => truncate(a[0], a[1] as number | undefined, a[2] as string | undefined),
  upper: (...a) => upper(a[0]),
  lower: (...a) => lower(a[0]),
  nl2br: (...a) => nl2br(a[0]),
  default: (...a) => fallback(a[0], a[1]),
  percent: (...a) => percent(a[0], a[1]),
  eq: (...a) => eq(a[0], a[1]),
  ne: (...a) => ne(a[0], a[1]),
  gt: (...a) => gt(a[0], a[1]),
  lt: (...a) => lt(a[0], a[1]),
  only: (...a) => only(a[0], ...a.slice(1)),
  exclude: (...a) => exclude(a[0], ...a.slice(1)),
  take: (...a) => take(a[0], a[1]),
  size: (...a) => size(a[0]),
};

/** 输出结果可以直接作为 {{& x}} 原样输出的 helper */
export const RAW_SAFE_HELPERS = new Set(['nl2br']);

export function isKnownHelper(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(HELPERS, name);
}

export function listHelperNames(): string[] {
  return Object.keys(HELPERS);
}
