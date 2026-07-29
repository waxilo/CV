/**
 * 模板校验（前端侧）
 *
 * 结构与安全规则复用 shared/template-schema，前端额外做一件后端做不到的事：
 * 用真实的模板引擎编译一遍源码，捕获语法错误并给出行号。
 */

import {
  validateTemplateConfig as validateStructure,
  validateCustomCss,
  type ITemplateConfigV2,
  type IValidationResult,
} from '@cv/template-schema';
import { checkTemplateSyntax } from './template-lang';

export { validateCustomCss };
export type { IValidationResult };

/** 兼容旧的返回结构名 */
export interface ITemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** 首个语法错误所在行，供编辑器标注 */
  errorLine?: number;
}

/**
 * 完整校验：结构 + 安全 + 模板语法
 */
export function validateTemplateConfig(config: unknown): ITemplateValidationResult {
  const structure = validateStructure(config);
  const errors = [...structure.errors];
  const warnings = [...structure.warnings];
  let errorLine: number | undefined;

  const cfg = config as ITemplateConfigV2 | null;

  if (cfg && typeof cfg === 'object') {
    // HTML 模板源码的语法检查
    if (cfg.engine === 'html' && typeof cfg.source?.html === 'string' && cfg.source.html.trim()) {
      const syntax = checkTemplateSyntax(cfg.source.html);
      if (!syntax.valid) {
        errors.push(...syntax.errors);
        errorLine = syntax.line;
      }
    }

    // v1 html 区块也用同一套语法
    if (cfg.engine === 'blocks' && cfg.document?.rows) {
      for (const row of cfg.document.rows) {
        for (const col of row.columns || []) {
          for (const block of col.blocks || []) {
            if (block.type !== 'html' || !block.content?.trim()) continue;
            const syntax = checkTemplateSyntax(block.content);
            if (!syntax.valid) {
              errors.push(`区块 ${block.id}：${syntax.errors[0]}`);
            }
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, errorLine };
}

/**
 * 只检查 HTML 模板源码的语法，供编辑器实时提示
 */
export function validateHtmlSource(source: string): { valid: boolean; errors: string[]; line?: number } {
  if (!source.trim()) return { valid: true, errors: [] };
  return checkTemplateSyntax(source);
}
