/**
 * 模板配置校验 —— 前后端唯一来源（纯 TS，无第三方依赖）
 *
 * 使用顺序：normalizeTemplateConfig(raw) → validateTemplateConfig(config)
 */

import { TEMPLATE_LIMITS } from './limits';
import { checkCss, checkTemplateHtml } from './safety';
import {
  BLOCK_TYPES,
  ENABLED_ENGINES,
  SECTION_TYPES,
  TEMPLATE_ENGINES,
  TEMPLATE_LAYOUTS,
  VARIABLE_TYPES,
  type ITemplateBlock,
  type ITemplateColumn,
  type ITemplateConfigV2,
  type ITemplateRow,
  type ITemplateVariable,
  type IValidationResult,
} from './types';

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_VARIABLE_KEYS = new Set(['this', 'vars', 'basics', 'sections', 's', 'page', 'meta', 'helpers']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  // eslint-disable-next-line no-control-regex
  return unescape(encodeURIComponent(value)).length;
}

/* ============================================================
 * 变量声明
 * ============================================================ */

export function validateVariables(variables: unknown, errors: string[], warnings: string[]): void {
  if (variables === undefined) return;
  if (!Array.isArray(variables)) {
    errors.push('variables 必须是数组');
    return;
  }
  if (variables.length > TEMPLATE_LIMITS.maxVariables) {
    errors.push(`variables 数量不能超过 ${TEMPLATE_LIMITS.maxVariables}`);
  }

  const seen = new Set<string>();

  variables.forEach((raw, i) => {
    const path = `variables[${i}]`;
    if (!isPlainObject(raw)) {
      errors.push(`${path} 必须是对象`);
      return;
    }
    const v = raw as unknown as ITemplateVariable;

    if (!isNonEmptyString(v.key)) {
      errors.push(`${path}.key 不能为空`);
    } else if (!IDENTIFIER_RE.test(v.key)) {
      errors.push(`${path}.key「${v.key}」必须是合法标识符（字母/下划线开头，仅含字母数字下划线）`);
    } else if (RESERVED_VARIABLE_KEYS.has(v.key)) {
      errors.push(`${path}.key「${v.key}」是保留名，请改用其他名称`);
    } else if (seen.has(v.key)) {
      errors.push(`${path}.key「${v.key}」重复`);
    } else {
      seen.add(v.key);
    }

    if (!isNonEmptyString(v.label)) {
      warnings.push(`${path}.label 为空，属性面板将显示 key`);
    }

    if (!VARIABLE_TYPES.includes(v.type)) {
      errors.push(`${path}.type「${String(v.type)}」无效，可选：${VARIABLE_TYPES.join(' / ')}`);
      return;
    }

    const d = v.default;
    if (d === undefined || d === null) {
      errors.push(`${path}.default 不能为空`);
      return;
    }

    switch (v.type) {
      case 'number':
        if (typeof d !== 'number' || Number.isNaN(d)) {
          errors.push(`${path}.default 必须是数字`);
        } else {
          if (typeof v.min === 'number' && d < v.min) errors.push(`${path}.default 小于 min`);
          if (typeof v.max === 'number' && d > v.max) errors.push(`${path}.default 大于 max`);
        }
        break;
      case 'boolean':
        if (typeof d !== 'boolean') errors.push(`${path}.default 必须是布尔值`);
        break;
      case 'select': {
        if (!Array.isArray(v.options) || v.options.length === 0) {
          errors.push(`${path} 为 select 类型，必须提供 options`);
          break;
        }
        const values = v.options.map((o) => (isPlainObject(o) ? o.value : undefined));
        if (!values.includes(d as string)) {
          errors.push(`${path}.default 必须是 options 中的某个 value`);
        }
        break;
      }
      case 'color':
        if (typeof d !== 'string') errors.push(`${path}.default 必须是颜色字符串`);
        break;
      case 'length':
      case 'text':
        if (typeof d !== 'string') errors.push(`${path}.default 必须是字符串`);
        break;
    }

    if (v.cssVar !== undefined) {
      if (typeof v.cssVar !== 'string' || !/^--[A-Za-z0-9_-]+$/.test(v.cssVar)) {
        errors.push(`${path}.cssVar 必须形如 --my-var`);
      }
    }
  });
}

/* ============================================================
 * v1 区块 DSL
 * ============================================================ */

function validateStyle(style: unknown, path: string, errors: string[]): void {
  if (style == null) return;
  if (!isPlainObject(style)) {
    errors.push(`${path}.style 必须是对象`);
    return;
  }
  for (const [key, val] of Object.entries(style)) {
    if (val != null && typeof val !== 'string') {
      errors.push(`${path}.style.${key} 必须是字符串`);
    }
  }
}

function validateBlock(block: ITemplateBlock, path: string, errors: string[]): void {
  if (!isNonEmptyString(block?.id)) errors.push(`${path}.id 无效`);
  if (!BLOCK_TYPES.includes(block?.type)) {
    errors.push(`${path}.type「${String(block?.type)}」无效`);
    return;
  }
  if (typeof block.visible !== 'boolean') errors.push(`${path}.visible 必须是布尔值`);

  if (block.type === 'section') {
    if (!block.sectionType || !SECTION_TYPES.includes(block.sectionType)) {
      errors.push(`${path}.sectionType 无效`);
    }
  }

  if (block.type === 'html') {
    errors.push(
      ...checkTemplateHtml(block.content || '', {
        maxLength: TEMPLATE_LIMITS.maxBlockHtmlLength,
      }).map((e) => `${path} ${e}`)
    );
  }

  if (block.type === 'text' && (block.content || '').length > TEMPLATE_LIMITS.maxTextLength) {
    errors.push(`${path} 文本超过 ${TEMPLATE_LIMITS.maxTextLength} 字符`);
  }

  validateStyle(block.style, path, errors);
}

function validateColumn(column: ITemplateColumn, path: string, errors: string[]): void {
  if (!isNonEmptyString(column?.id)) errors.push(`${path}.id 无效`);
  if (!Number.isInteger(column?.span) || column.span < 1 || column.span > 12) {
    errors.push(`${path}.span 必须是 1-12 的整数`);
  }
  if (!Array.isArray(column?.blocks)) {
    errors.push(`${path}.blocks 必须是数组`);
    return;
  }
  if (column.blocks.length > TEMPLATE_LIMITS.maxBlocksPerColumn) {
    errors.push(`${path} 区块数量超过 ${TEMPLATE_LIMITS.maxBlocksPerColumn}`);
  }
  column.blocks.forEach((b, i) => validateBlock(b, `${path}.blocks[${i}]`, errors));
  validateStyle(column.style, path, errors);
}

function validateRow(row: ITemplateRow, path: string, errors: string[]): void {
  if (!isNonEmptyString(row?.id)) errors.push(`${path}.id 无效`);
  if (!Array.isArray(row?.columns)) {
    errors.push(`${path}.columns 必须是数组`);
    return;
  }
  if (row.columns.length === 0) errors.push(`${path} 至少需要一列`);
  if (row.columns.length > TEMPLATE_LIMITS.maxColumnsPerRow) {
    errors.push(`${path} 列数超过 ${TEMPLATE_LIMITS.maxColumnsPerRow}`);
  }
  const spanSum = row.columns.reduce((sum, c) => sum + (Number(c?.span) || 0), 0);
  if (spanSum > 12) errors.push(`${path} 列宽之和不能超过 12`);
  row.columns.forEach((c, i) => validateColumn(c, `${path}.columns[${i}]`, errors));
  validateStyle(row.style, path, errors);
}

function validateDocument(document: unknown, errors: string[]): void {
  if (!isPlainObject(document) || !Array.isArray(document.rows)) {
    errors.push('document.rows 必须是数组');
    return;
  }
  const rows = document.rows as ITemplateRow[];
  if (rows.length === 0) errors.push('document 至少需要一行');
  if (rows.length > TEMPLATE_LIMITS.maxRows) errors.push(`行数不能超过 ${TEMPLATE_LIMITS.maxRows}`);
  rows.forEach((r, i) => validateRow(r, `document.rows[${i}]`, errors));
}

/* ============================================================
 * 页面
 * ============================================================ */

function validatePage(page: unknown, errors: string[]): void {
  if (!isPlainObject(page)) {
    errors.push('page 必须是对象');
    return;
  }
  if (page.format !== 'a4' && page.format !== 'letter') {
    errors.push("page.format 必须是 'a4' 或 'letter'");
  }
  if (!isPlainObject(page.margin)) {
    errors.push('page.margin 必须是对象');
  } else {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const v = (page.margin as Record<string, unknown>)[side];
      if (typeof v !== 'number' || Number.isNaN(v) || v < 0 || v > 50) {
        errors.push(`page.margin.${side} 必须是 0-50 之间的数字（毫米）`);
      }
    }
  }
  if (page.paged !== undefined && typeof page.paged !== 'boolean') {
    errors.push('page.paged 必须是布尔值');
  }
}

/* ============================================================
 * 主入口
 * ============================================================ */

export interface IValidateOptions {
  /**
   * 是否跳过模板源码的语法编译检查。
   * 后端没有渲染引擎，只能做文本级检查，因此默认 true。
   * 前端会额外调用 compileTemplateSource 做语法检查。
   */
  skipSyntaxCheck?: boolean;
}

export function validateTemplateConfig(
  config: unknown,
  options: IValidateOptions = {}
): IValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(config)) {
    return { valid: false, errors: ['config 必须是对象'], warnings };
  }

  const cfg = config as unknown as ITemplateConfigV2;

  /* --- 版本与引擎 --- */
  if (cfg.schemaVersion !== 2) {
    errors.push('schemaVersion 必须为 2（请先经过 normalizeTemplateConfig 迁移）');
  }

  if (!TEMPLATE_ENGINES.includes(cfg.engine)) {
    errors.push(`engine「${String(cfg.engine)}」无效，可选：${TEMPLATE_ENGINES.join(' / ')}`);
    return { valid: false, errors, warnings };
  }
  if (!ENABLED_ENGINES.includes(cfg.engine)) {
    errors.push(`engine「${cfg.engine}」尚未启用，当前支持：${ENABLED_ENGINES.join(' / ')}`);
  }

  /* --- meta --- */
  if (!isPlainObject(cfg.meta)) {
    errors.push('meta 必须是对象');
  } else {
    if (!isNonEmptyString(cfg.meta.title)) warnings.push('meta.title 为空');
    if (typeof cfg.meta.contextVersion !== 'number') {
      errors.push('meta.contextVersion 必须是数字');
    }
    if (cfg.meta.tags !== undefined && !Array.isArray(cfg.meta.tags)) {
      errors.push('meta.tags 必须是数组');
    }
  }

  /* --- page --- */
  validatePage(cfg.page, errors);

  /* --- capabilities --- */
  const caps = isPlainObject(cfg.capabilities)
    ? (cfg.capabilities as unknown as ITemplateConfigV2['capabilities'])
    : undefined;
  if (cfg.capabilities !== undefined && !caps) {
    errors.push('capabilities 必须是对象');
  }
  if (caps?.allowScript) {
    errors.push('capabilities.allowScript 尚未开放');
  }

  /* --- variables --- */
  validateVariables(cfg.variables, errors, warnings);

  /* --- v1 兼容主题字段 --- */
  if (!TEMPLATE_LAYOUTS.includes(cfg.layout)) errors.push('layout 无效');
  if (!isNonEmptyString(cfg.primaryColor)) errors.push('primaryColor 无效');
  if (!isNonEmptyString(cfg.fontFamily)) errors.push('fontFamily 无效');
  if (typeof cfg.fontSize !== 'number' || cfg.fontSize < 10 || cfg.fontSize > 20) {
    errors.push('fontSize 需在 10-20 之间');
  }
  if (typeof cfg.spacing !== 'number' || cfg.spacing < 0.8 || cfg.spacing > 2) {
    errors.push('spacing 需在 0.8-2 之间');
  }

  const cssOptions = {
    allowRemoteImages: caps?.allowRemoteImages ?? true,
    allowWebFonts: caps?.allowWebFonts ?? false,
  };

  /* --- source / document 按引擎分派 --- */
  if (!isPlainObject(cfg.source)) {
    errors.push('source 必须是对象');
  } else {
    errors.push(...checkCss(cfg.source.css || '', cssOptions));

    if (cfg.engine === 'html') {
      if (!isNonEmptyString(cfg.source.html)) {
        errors.push('engine=html 时 source.html 不能为空');
      } else {
        errors.push(...checkTemplateHtml(cfg.source.html, cssOptions));
      }
    }

    if (cfg.engine === 'vue') {
      if (!isNonEmptyString(cfg.source.vue)) {
        errors.push('engine=vue 时 source.vue 不能为空');
      }
      if (typeof cfg.source.vue === 'string' && cfg.source.vue.length > TEMPLATE_LIMITS.maxVueLength) {
        errors.push(`source.vue 超过 ${TEMPLATE_LIMITS.maxVueLength} 字符`);
      }
    }
  }

  if (cfg.engine === 'blocks') {
    validateDocument(cfg.document, errors);
    errors.push(
      ...checkCss(cfg.customCss || '', {
        ...cssOptions,
        maxLength: TEMPLATE_LIMITS.maxCssLength,
      })
    );
  }

  /* --- 总体积 --- */
  try {
    const size = byteLength(JSON.stringify(cfg));
    if (size > TEMPLATE_LIMITS.maxTotalConfigBytes) {
      errors.push(`模板配置总大小 ${size} 字节，超过上限 ${TEMPLATE_LIMITS.maxTotalConfigBytes}`);
    }
  } catch {
    errors.push('模板配置无法序列化，可能包含循环引用');
  }

  void options.skipSyntaxCheck;

  return { valid: errors.length === 0, errors, warnings };
}

/** 兼容旧导出：仅校验 CSS */
export function validateCustomCss(css: string): string[] {
  return checkCss(css, { allowWebFonts: false, allowRemoteImages: true });
}
