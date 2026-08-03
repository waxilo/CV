/**
 * 模板渲染器
 *
 * 数据流：
 *   resume.data ──buildRenderContext──▶ IRenderContext ──engine──▶ HTML + CSS ──▶ sandbox iframe
 */

/* 配置：类型、限额、校验、迁移（转发 shared 实现） */
export * from './migrate';
export * from './validate';

/* 渲染上下文与 helper */
export * from './context';
export * from './helpers';

/* 模板语法引擎 */
export * from './template-lang';
export { renderMustache } from './mustache';

/* 清洗与作用域 */
export { sanitizeHtml, sanitizeCss, sanitizeHtmlFallback, type ISanitizeOptions } from './sanitize';
export { scopeCss, SCOPE_SELECTOR } from './css-scope';

/* 引擎 */
export { renderHtmlTemplate, htmlBaseCss } from './engines/html';
export { renderBlocksToHtml, blocksBaseCss, buildBlockInterpolationContext } from './engines/blocks';

/* 统一入口 */
export {
  renderTemplate,
  compileTemplateHtml,
  compileTemplateDocument,
  resultToDocument,
  wrapResumeDocument,
  snapshotHtml,
  type IRenderResult,
  type ICompileOptions,
} from './compile';

/* 示例数据 */
export * from './sampleData';

/* 预览智能分页 */
export { paginateResumeRoot, clearPageSpacers, type IPaginateOptions, type IPageMarginMm } from './paginate';
