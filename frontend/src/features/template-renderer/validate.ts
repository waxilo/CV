import type { ITemplateConfig, ITemplateBlock, ITemplateColumn, ITemplateRow } from '/@/types/template';
import { TEMPLATE_LIMITS } from '/@/types/template';

const LAYOUTS = new Set(['sidebar-left', 'sidebar-right', 'single-column', 'two-column']);
const BLOCK_TYPES = new Set(['basics', 'section', 'divider', 'text', 'avatar', 'html']);
const SECTION_TYPES = new Set([
  'basics',
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'languages',
  'certificates',
  'awards',
  'interests',
  'custom',
]);

export interface ITemplateValidationResult {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validateStyle(style: unknown, path: string, errors: string[]) {
  if (style == null) return;
  if (typeof style !== 'object') {
    errors.push(`${path}.style 必须是对象`);
    return;
  }
  const s = style as Record<string, unknown>;
  for (const [key, val] of Object.entries(s)) {
    if (val != null && typeof val !== 'string') {
      errors.push(`${path}.style.${key} 必须是字符串`);
    }
  }
}

function validateBlock(block: ITemplateBlock, path: string, errors: string[]) {
  if (!isNonEmptyString(block.id)) errors.push(`${path}.id 无效`);
  if (!BLOCK_TYPES.has(block.type)) errors.push(`${path}.type 无效`);
  if (typeof block.visible !== 'boolean') errors.push(`${path}.visible 必须是布尔值`);

  if (block.type === 'section') {
    if (!block.sectionType || !SECTION_TYPES.has(block.sectionType)) {
      errors.push(`${path}.sectionType 无效`);
    }
  }

  if (block.type === 'html') {
    const html = block.content || '';
    if (html.length > TEMPLATE_LIMITS.maxHtmlLength) {
      errors.push(`${path} HTML 超过 ${TEMPLATE_LIMITS.maxHtmlLength} 字符`);
    }
    if (html.includes('{{{')) {
      errors.push(`${path} 禁止三花括号原始输出`);
    }
  }

  if (block.type === 'text') {
    const text = block.content || '';
    if (text.length > TEMPLATE_LIMITS.maxTextLength) {
      errors.push(`${path} 文本超过 ${TEMPLATE_LIMITS.maxTextLength} 字符`);
    }
  }

  validateStyle(block.style, path, errors);
}

function validateColumn(column: ITemplateColumn, path: string, errors: string[]) {
  if (!isNonEmptyString(column.id)) errors.push(`${path}.id 无效`);
  if (!Number.isInteger(column.span) || column.span < 1 || column.span > 12) {
    errors.push(`${path}.span 必须是 1-12 的整数`);
  }
  if (!Array.isArray(column.blocks)) {
    errors.push(`${path}.blocks 必须是数组`);
    return;
  }
  if (column.blocks.length > TEMPLATE_LIMITS.maxBlocksPerColumn) {
    errors.push(`${path} 区块数量超限`);
  }
  column.blocks.forEach((b, i) => validateBlock(b, `${path}.blocks[${i}]`, errors));
  validateStyle(column.style, path, errors);
}

function validateRow(row: ITemplateRow, path: string, errors: string[]) {
  if (!isNonEmptyString(row.id)) errors.push(`${path}.id 无效`);
  if (!Array.isArray(row.columns)) {
    errors.push(`${path}.columns 必须是数组`);
    return;
  }
  if (row.columns.length === 0) errors.push(`${path} 至少需要一列`);
  if (row.columns.length > TEMPLATE_LIMITS.maxColumnsPerRow) {
    errors.push(`${path} 列数超限`);
  }
  const spanSum = row.columns.reduce((sum, c) => sum + (Number(c.span) || 0), 0);
  if (spanSum > 12) errors.push(`${path} 列宽之和不能超过 12`);
  row.columns.forEach((c, i) => validateColumn(c, `${path}.columns[${i}]`, errors));
  validateStyle(row.style, path, errors);
}

/**
 * 校验自定义 CSS：禁止外联、脚本与表达式
 */
export function validateCustomCss(css: string): string[] {
  const errors: string[] = [];
  if (css.length > TEMPLATE_LIMITS.maxCssLength) {
    errors.push(`CSS 超过 ${TEMPLATE_LIMITS.maxCssLength} 字符`);
  }
  const lower = css.toLowerCase();
  const forbidden = [
    /@import/i,
    /url\s*\(/i,
    /expression\s*\(/i,
    /javascript\s*:/i,
    /behavior\s*:/i,
    /@charset/i,
    /-moz-binding/i,
  ];
  for (const re of forbidden) {
    if (re.test(lower)) {
      errors.push(`CSS 包含禁止语法: ${re.source}`);
    }
  }
  return errors;
}

export function validateTemplateConfig(config: unknown): ITemplateValidationResult {
  const errors: string[] = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['config 无效'] };
  }

  const cfg = config as ITemplateConfig;
  if (cfg.schemaVersion !== 1) errors.push('schemaVersion 必须为 1');
  if (!LAYOUTS.has(cfg.layout)) errors.push('layout 无效');
  if (typeof cfg.primaryColor !== 'string' || !cfg.primaryColor) errors.push('primaryColor 无效');
  if (typeof cfg.fontFamily !== 'string' || !cfg.fontFamily) errors.push('fontFamily 无效');
  if (typeof cfg.fontSize !== 'number' || cfg.fontSize < 10 || cfg.fontSize > 20) {
    errors.push('fontSize 需在 10-20 之间');
  }
  if (typeof cfg.spacing !== 'number' || cfg.spacing < 0.8 || cfg.spacing > 2) {
    errors.push('spacing 需在 0.8-2 之间');
  }

  if (cfg.customCss) {
    errors.push(...validateCustomCss(cfg.customCss));
  }

  if (!cfg.document || !Array.isArray(cfg.document.rows)) {
    errors.push('document.rows 必须是数组');
  } else {
    if (cfg.document.rows.length === 0) errors.push('document 至少需要一行');
    if (cfg.document.rows.length > TEMPLATE_LIMITS.maxRows) errors.push('行数超限');
    cfg.document.rows.forEach((r, i) => validateRow(r, `document.rows[${i}]`, errors));
  }

  return { valid: errors.length === 0, errors };
}
