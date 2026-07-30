/**
 * 渲染视图模型（契约版本 1）
 *
 * 把用户填写的那一份简历 JSON（IResumeData）归一化为模板可直接消费的上下文。
 * 不把原始 JSON 丢给模板的原因：
 *   - sections 是数组，模板要取「工作经历」得自己 find
 *   - 每类条目字段名各异（position/company vs school/degree vs name/level）
 *   - 日期是裸字符串，需要格式化与「至今」处理
 *   - 富文本描述需要一个受控的 raw 输出通道
 *
 * 详见 docs/模板变量契约.md
 */

import { CONTEXT_VERSION, type ITemplateConfigV2, type TVariableValue } from '@cv/template-schema';
import type { IResumeData, IResumeSection, TSectionItem, TSectionType } from '/@/types/resume';
import { dateRange as fmtDateRange, date as fmtDate, HELPERS } from './helpers';
import { sanitizeHtml } from './sanitize';

/* ============================================================
 * 类型
 * ============================================================ */

export interface IRenderContact {
  key: string;
  label: string;
  value: string;
  href: string;
}

export interface IRenderBasics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  url: string;
  avatarUrl: string;
  initial: string;
  contacts: IRenderContact[];
}

export interface IRenderItem {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  meta: string;
  dateRange: string;
  description: string;
  descriptionSafe: string;
  keywords: string[];
  raw: Record<string, unknown>;
}

export interface IRenderSection {
  id: string;
  type: TSectionType;
  name: string;
  isText: boolean;
  content: string;
  contentSafe: string;
  items: IRenderItem[];
  isEmpty: boolean;
}

export interface IRenderPage {
  format: string;
  margin: { top: number; right: number; bottom: number; left: number };
  widthMm: number;
  heightMm: number;
}

export interface IRenderContext {
  contextVersion: number;
  basics: IRenderBasics;
  sections: IRenderSection[];
  s: Record<string, IRenderSection | undefined>;
  vars: Record<string, TVariableValue>;
  page: IRenderPage;
  meta: { templateId: string; generatedAt: string };
  helpers: typeof HELPERS;
}

/* ============================================================
 * 变量取值
 * ============================================================ */

/** 旧 metadata.theme 字段 → 变量 key 的映射 */
const THEME_TO_VAR: Record<string, keyof IResumeData['metadata']['theme']> = {
  primaryColor: 'primaryColor',
  textColor: 'textColor',
  fontFamily: 'fontFamily',
  fontSize: 'fontSize',
  lineHeight: 'spacing',
};

function coerceVarValue(value: unknown, type: string): TVariableValue | undefined {
  switch (type) {
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return undefined;
    case 'color':
    case 'length':
    case 'text':
    case 'select':
      return typeof value === 'string' ? value : undefined;
    default:
      return undefined;
  }
}

/**
 * 合并变量取值：variables[].default → metadata.theme → metadata.templateVars
 */
export function resolveVars(
  config: ITemplateConfigV2,
  data: IResumeData
): Record<string, TVariableValue> {
  const out: Record<string, TVariableValue> = {};
  const typeByKey = new Map<string, string>();

  for (const v of config.variables || []) {
    out[v.key] = v.default;
    typeByKey.set(v.key, v.type);
  }

  const overrides = data.metadata?.templateVars;

  /*
   * 旧数据兼容：metadata.theme 映射到同名变量。
   *
   * 只在 templateVars 缺失时才应用。原因是 metadata.theme 永远有值
   * （createDefaultResumeData 就填了默认主题），如果无条件应用，
   * 模板自己声明的变量默认值就永远不会生效 —— 换模板会看不出差别。
   * templateVars 一旦存在（哪怕是空对象），就说明这份简历已经在新体系下，
   * 此时 theme 完全让位。
   */
  const theme = data.metadata?.theme;
  if (theme && overrides === undefined) {
    for (const [varKey, themeKey] of Object.entries(THEME_TO_VAR)) {
      if (!(varKey in out)) continue;
      const themeValue = theme[themeKey];
      if (themeValue === undefined || themeValue === null || themeValue === '') continue;
      const coerced = coerceVarValue(themeValue, typeByKey.get(varKey) || 'text');
      if (coerced !== undefined) out[varKey] = coerced;
    }
  }

  // 用户覆写
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (!(key in out)) continue;
      const coerced = coerceVarValue(value, typeByKey.get(key) || 'text');
      if (coerced !== undefined) out[key] = coerced;
    }
  }

  return out;
}

/* ============================================================
 * basics
 * ============================================================ */

function buildContacts(basics: IResumeData['basics']): IRenderContact[] {
  const defs: { key: string; label: string; value: string; href: string }[] = [
    { key: 'email', label: '邮箱', value: basics.email, href: basics.email ? `mailto:${basics.email}` : '' },
    { key: 'phone', label: '电话', value: basics.phone, href: basics.phone ? `tel:${basics.phone}` : '' },
    { key: 'location', label: '所在地', value: basics.location, href: '' },
    { key: 'url', label: '主页', value: basics.url, href: basics.url },
  ];
  return defs.filter((c) => c.value && c.value.trim() !== '');
}

function safeAvatarUrl(url: string, allowRemoteImages: boolean): string {
  if (!url) return '';
  if (/^data:image\//i.test(url)) return url;
  if (/^https:\/\//i.test(url)) return allowRemoteImages ? url : '';
  return '';
}

function buildBasics(data: IResumeData, allowRemoteImages: boolean): IRenderBasics {
  const b = data.basics;
  const name = b.name || '';
  return {
    name,
    headline: b.headline || '',
    email: b.email || '',
    phone: b.phone || '',
    location: b.location || '',
    url: b.url || '',
    avatarUrl: safeAvatarUrl(b.avatarUrl || '', allowRemoteImages),
    initial: name.trim() ? name.trim().slice(0, 1) : '?',
    contacts: buildContacts(b),
  };
}

/* ============================================================
 * 条目归一化
 * ============================================================ */

function field(item: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = item[key];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return '';
}

function keywordsOf(item: Record<string, unknown>): string[] {
  const raw = item.keywords;
  if (!Array.isArray(raw)) return [];
  return raw.map((k) => String(k)).filter((k) => k.trim() !== '');
}

function joinNonEmpty(parts: string[], sep = ' '): string {
  return parts.filter((p) => p && p.trim() !== '').join(sep);
}

interface INormalizeOptions {
  dateFormat: string;
}

function normalizeItem(
  sectionType: TSectionType,
  raw: TSectionItem,
  index: number,
  options: INormalizeOptions
): IRenderItem {
  const item = (raw || {}) as Record<string, unknown>;
  const fmt = options.dateFormat;

  let title = '';
  let subtitle = '';
  let meta = '';
  let range = '';
  let description = '';

  switch (sectionType) {
    case 'experience':
      title = field(item, 'position');
      subtitle = field(item, 'company');
      meta = field(item, 'location');
      range = fmtDateRange(item.startDate, item.endDate, item.isCurrent, fmt);
      description = field(item, 'description');
      break;

    case 'education':
      title = field(item, 'school');
      subtitle = joinNonEmpty([field(item, 'degree'), field(item, 'major')]);
      meta = field(item, 'location');
      range = fmtDateRange(item.startDate, item.endDate, item.isCurrent, fmt);
      description = field(item, 'description');
      break;

    case 'skills':
      title = field(item, 'name');
      break;

    case 'projects':
      title = field(item, 'name');
      subtitle = field(item, 'role');
      meta = field(item, 'url');
      range = fmtDateRange(item.startDate, item.endDate, item.isCurrent, fmt);
      description = field(item, 'description');
      break;

    case 'languages':
      title = field(item, 'name');
      subtitle = field(item, 'level');
      break;

    case 'certificates':
      title = field(item, 'name');
      subtitle = field(item, 'issuer');
      meta = field(item, 'url');
      range = fmtDate(item.date, fmt);
      break;

    case 'awards':
      title = field(item, 'title', 'name');
      subtitle = field(item, 'subtitle', 'issuer', 'awarder');
      range = fmtDate(item.date, fmt);
      description = field(item, 'description', 'summary');
      break;

    case 'interests':
      title = field(item, 'title', 'name');
      description = field(item, 'description');
      break;

    case 'custom':
      title = field(item, 'title', 'name');
      subtitle = field(item, 'subtitle');
      range = fmtDate(item.date, fmt);
      description = field(item, 'description');
      break;

    default:
      title = field(item, 'title', 'name');
      subtitle = field(item, 'subtitle');
      range = item.startDate || item.endDate
        ? fmtDateRange(item.startDate, item.endDate, item.isCurrent, fmt)
        : fmtDate(item.date, fmt);
      description = field(item, 'description');
      break;
  }

  return {
    id: field(item, 'id') || `${sectionType}-${index}`,
    index,
    title,
    subtitle,
    meta,
    dateRange: range,
    description,
    descriptionSafe: description ? sanitizeHtml(textToHtml(description)) : '',
    keywords: keywordsOf(item),
    raw: item,
  };
}

/** 纯文本转最小 HTML：转义 + 换行成 <br> */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\r?\n/g, '<br />');
}

/** 自由文本模块：summary，或没有条目但填了 content 的模块 */
function isTextSection(section: IResumeSection, itemCount: number): boolean {
  if (section.type === 'summary') return true;
  return itemCount === 0 && Boolean(section.content && section.content.trim());
}

function normalizeSection(section: IResumeSection, options: INormalizeOptions): IRenderSection {
  const visibleItems = (section.items || []).filter(
    (i) => (i as { visible?: boolean })?.visible !== false
  );
  const items = visibleItems.map((item, i) => normalizeItem(section.type, item, i, options));
  const content = section.content || '';
  const isText = isTextSection(section, items.length);

  return {
    id: section.id,
    type: section.type,
    name: section.name || '',
    isText,
    content,
    contentSafe: content ? sanitizeHtml(textToHtml(content)) : '',
    items,
    isEmpty: items.length === 0 && content.trim() === '',
  };
}

/* ============================================================
 * 页面
 * ============================================================ */

function buildPage(config: ITemplateConfigV2, data: IResumeData): IRenderPage {
  // 简历侧只存了一个统一 margin 数字，模板侧存了四向 margin。
  // 简历侧有值时按四向统一覆盖，保证用户在编辑器里调页边距对所有模板生效。
  const resumeMargin = data.metadata?.page?.margin;
  const base = config.page?.margin || { top: 16, right: 16, bottom: 16, left: 16 };
  const margin =
    typeof resumeMargin === 'number' && Number.isFinite(resumeMargin)
      ? { top: resumeMargin, right: resumeMargin, bottom: resumeMargin, left: resumeMargin }
      : { ...base };

  return { format: 'a4', margin, widthMm: 210, heightMm: 297 };
}

/* ============================================================
 * 主入口
 * ============================================================ */

export function buildRenderContext(data: IResumeData, config: ITemplateConfigV2): IRenderContext {
  const vars = resolveVars(config, data);
  const dateFormat = typeof vars.dateFormat === 'string' ? vars.dateFormat : 'YYYY.MM';
  const allowRemoteImages = config.capabilities?.allowRemoteImages ?? true;

  const sections = (data.sections || [])
    .filter((s) => s && s.visible !== false)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => normalizeSection(s, { dateFormat }));

  const s: Record<string, IRenderSection | undefined> = {};
  for (const section of sections) {
    if (!(section.type in s)) s[section.type] = section;
  }

  return {
    contextVersion: CONTEXT_VERSION,
    basics: buildBasics(data, allowRemoteImages),
    sections,
    s,
    vars,
    page: buildPage(config, data),
    meta: {
      templateId: data.metadata?.templateId || '',
      generatedAt: new Date().toISOString(),
    },
    helpers: HELPERS,
  };
}

/* ============================================================
 * CSS 变量
 * ============================================================ */

/** CSS 变量值里的危险字符，防止用户覆写值逃逸出声明 */
const CSS_VALUE_FORBIDDEN = /[;{}<>()"'\\]|javascript:|expression|url/i;

function sanitizeCssValue(value: string): string | null {
  const v = String(value).trim();
  if (!v || v.length > 120) return null;
  if (CSS_VALUE_FORBIDDEN.test(v)) return null;
  return v;
}

function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
}

export function cssVarName(variable: { key: string; cssVar?: string }): string {
  return variable.cssVar || `--tpl-${kebab(variable.key)}`;
}

/**
 * 把变量取值与页面尺寸编译为 CSS 自定义属性。
 * boolean 变量不注入（它们只用于模板逻辑分支）。
 */
export function buildCssVars(
  config: ITemplateConfigV2,
  context: IRenderContext
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const variable of config.variables || []) {
    const value = context.vars[variable.key];
    if (value === undefined || typeof value === 'boolean') continue;

    let text: string;
    if (typeof value === 'number') {
      const unit = variable.unit === undefined ? 'px' : variable.unit;
      text = `${value}${unit}`;
    } else {
      text = String(value);
    }

    const safe = sanitizeCssValue(text);
    if (safe !== null) out[cssVarName(variable)] = safe;
  }

  const { margin, widthMm, heightMm } = context.page;
  out['--page-margin-top'] = `${margin.top}mm`;
  out['--page-margin-right'] = `${margin.right}mm`;
  out['--page-margin-bottom'] = `${margin.bottom}mm`;
  out['--page-margin-left'] = `${margin.left}mm`;
  out['--page-width'] = `${widthMm}mm`;
  out['--page-height'] = `${heightMm}mm`;

  // 兼容 v1 区块模板里用到的 --primary
  if (out['--tpl-primary-color']) out['--primary'] = out['--tpl-primary-color'];

  return out;
}

export function cssVarsToDeclarations(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
}
