/**
 * 模板语法引擎入口
 */

export * from './ast';
export { compileTemplate, parseTemplate, parseExpr, clearTemplateCache } from './parse';
export { renderAst, evalExpr, resolvePath, truthy } from './evaluate';

import { compileTemplate } from './parse';
import { renderAst } from './evaluate';
import { TemplateSyntaxError, type TNode } from './ast';

/**
 * 编译并渲染模板。
 * 语法错误抛 TemplateSyntaxError，运行时错误抛 TemplateRuntimeError。
 */
export function renderTemplateSource(
  source: string,
  data: Record<string, unknown>
): string {
  const ast = compileTemplate(source);
  return renderAst(ast, data);
}

export interface ISyntaxCheckResult {
  valid: boolean;
  errors: string[];
  /** 首个错误所在行，供编辑器标注 */
  line?: number;
  ast?: TNode[];
}

/**
 * 只做语法检查，不求值。设计器保存前调用。
 */
export function checkTemplateSyntax(source: string): ISyntaxCheckResult {
  try {
    const ast = compileTemplate(source);
    return { valid: true, errors: [], ast };
  } catch (e) {
    if (e instanceof TemplateSyntaxError) {
      return { valid: false, errors: [e.message], line: e.line };
    }
    return { valid: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
}
