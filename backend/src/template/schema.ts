/**
 * 模板配置校验（后端）
 *
 * 结构、安全规则、迁移全部来自 shared/template-schema，与前端同一份实现。
 * 这里只做 Workers 侧的入参包装与错误信息整理。
 *
 * 后端拿不到 DOM，也没有渲染引擎，因此不做模板语法编译检查 ——
 * 那一步由前端在保存前执行。后端负责的是结构、限额与文本级安全规则。
 */

import {
  normalizeTemplateConfig,
  validateTemplateConfig,
  checkCss,
  type ITemplateConfigV2,
  type TTemplateEngine,
} from './shared';

export {
  TEMPLATE_LIMITS,
  CONTEXT_VERSION,
  TEMPLATE_SCHEMA_VERSION,
  BUILTIN_TEMPLATES,
  getBuiltinTemplate,
  normalizeTemplateConfig,
  validateTemplateConfig,
} from './shared';

export type { ITemplateConfigV2, TTemplateEngine } from './shared';

/** 兼容旧命名 */
export const normalizeIncomingConfig = normalizeTemplateConfig;

/** 兼容旧命名：返回错误信息或 null */
export function assertSafeCss(css: string | undefined): string | null {
  if (!css) return null;
  const errors = checkCss(css, { allowWebFonts: false, allowRemoteImages: true });
  return errors.length ? errors[0] : null;
}

export type TTemplateConfig = ITemplateConfigV2;

export interface IParseSuccess {
  success: true;
  data: ITemplateConfigV2;
  engine: TTemplateEngine;
  schemaVersion: number;
  warnings: string[];
}

export interface IParseFailure {
  success: false;
  error: string;
  errors: string[];
}

export type TParseResult = IParseSuccess | IParseFailure;

/**
 * 迁移 + 校验入库前的模板配置。
 */
export function parseTemplateConfig(raw: unknown): TParseResult {
  let normalized: ITemplateConfigV2;
  try {
    normalized = normalizeTemplateConfig(raw);
  } catch (e) {
    return {
      success: false,
      error: `模板配置无法解析：${e instanceof Error ? e.message : String(e)}`,
      errors: [],
    };
  }

  const result = validateTemplateConfig(normalized);
  if (!result.valid) {
    return {
      success: false,
      error: result.errors[0] || '模板配置无效',
      errors: result.errors,
    };
  }

  return {
    success: true,
    data: normalized,
    engine: normalized.engine,
    schemaVersion: normalized.schemaVersion,
    warnings: result.warnings,
  };
}

/**
 * 读取时的宽松解析：即使校验不通过也要能把模板渲染出来，
 * 否则历史脏数据会让整个模板列表接口失败。
 */
export function normalizeForRead(raw: unknown): ITemplateConfigV2 {
  try {
    return normalizeTemplateConfig(raw);
  } catch {
    return normalizeTemplateConfig({});
  }
}
