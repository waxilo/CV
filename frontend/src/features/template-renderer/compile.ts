/**
 * 统一渲染入口
 *
 * 按 engine 分派到具体引擎，产出「已清洗的 body HTML + 已作用域化的 CSS」，
 * 最终包装为可以直接塞进 sandbox iframe 的隔离文档。
 */

import {
  normalizeTemplateConfig,
  type ITemplateConfigV2,
  type TTemplateEngine,
} from '@cv/template-schema';
import type { IResumeData } from '/@/types/resume';
import { buildCssVars, buildRenderContext, cssVarsToDeclarations, type IRenderContext } from './context';
import { scopeCss, SCOPE_SELECTOR } from './css-scope';
import { blocksBaseCss, renderBlocksToHtml } from './engines/blocks';
import { htmlBaseCss, renderHtmlTemplate } from './engines/html';
import { escapeHtml } from './helpers';
import { sanitizeCss } from './sanitize';

export interface IRenderResult {
  engine: TTemplateEngine;
  /** 含 .cv-root 包裹的 body HTML，已清洗 */
  body: string;
  /** 已作用域化的完整 CSS */
  css: string;
  /** 渲染过程中的错误，非空说明输出是降级内容 */
  errors: string[];
  config: ITemplateConfigV2;
  context: IRenderContext;
}

/* ============================================================
 * 根样式
 * ============================================================ */

function rootCss(cssVars: Record<string, string>): string {
  return `
${SCOPE_SELECTOR} {
${cssVarsToDeclarations(cssVars)}
  box-sizing: border-box;
  position: relative;
  width: 210mm;
  max-width: 210mm;
  min-width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  background: #fff;
  color: var(--tpl-text-color, #0f172a);
  font-family: var(--tpl-font-family, Inter), 'PingFang SC', system-ui, sans-serif;
  font-size: var(--tpl-font-size, 14px);
  line-height: var(--tpl-line-height, 1.15);
  overflow: visible;
  overflow-wrap: anywhere;
}
${SCOPE_SELECTOR} *,
${SCOPE_SELECTOR} *::before,
${SCOPE_SELECTOR} *::after {
  box-sizing: inherit;
  max-width: 100% !important;
}
${pagedCss()}
@page { size: A4; margin: 0; }
@media print {
  ${SCOPE_SELECTOR} {
    width: 210mm;
    max-width: 210mm;
    min-width: 210mm;
    min-height: 297mm;
    box-shadow: none;
    margin: 0;
  }
}
`;
}

function pagedCss(): string {
  return `
${SCOPE_SELECTOR} .page-break {
  break-before: page;
  page-break-before: always;
}
${SCOPE_SELECTOR} .no-break {
  break-inside: avoid;
  page-break-inside: avoid;
}
${SCOPE_SELECTOR} img,
${SCOPE_SELECTOR} svg,
${SCOPE_SELECTOR} table { max-width: 100%; }
`;
}

/* ============================================================
 * 主渲染
 * ============================================================ */

export function renderTemplate(rawConfig: unknown, data: IResumeData): IRenderResult {
  const config = normalizeTemplateConfig(rawConfig);
  const context = buildRenderContext(data, config);
  const cssVars = buildCssVars(config, context);

  const capabilities = {
    allowRemoteImages: config.capabilities?.allowRemoteImages ?? true,
    allowWebFonts: config.capabilities?.allowWebFonts ?? false,
  };

  const errors: string[] = [];
  let inner = '';
  let engineCss = '';

  if (config.engine === 'html') {
    const result = renderHtmlTemplate(config, context);
    inner = result.html;
    errors.push(...result.errors);
    engineCss = htmlBaseCss();
  } else if (config.engine === 'vue') {
    // Vue 引擎尚未启用（方案 P3），给出明确提示而不是白屏
    inner = `<div class="cv-notice"><strong>Vue 模板引擎尚未启用</strong><p>${escapeHtml(
      '请将模板改为 HTML 引擎，或等待 Vue 沙箱上线。'
    )}</p></div>`;
    errors.push('engine=vue 尚未启用');
    engineCss = htmlBaseCss();
  } else {
    inner = renderBlocksToHtml(config, data, context);
    engineCss = blocksBaseCss();
  }

  // 模板 CSS：先按安全规则清洗，再作用域化
  const templateCss = scopeCss(sanitizeCss(config.source?.css || '', capabilities));
  const legacyCss =
    config.engine === 'blocks' ? scopeCss(sanitizeCss(config.customCss || '', capabilities)) : '';

  const css = [
    rootCss(cssVars),
    scopeCss(engineCss),
    templateCss,
    legacyCss,
  ]
    .filter((part) => part && part.trim())
    .join('\n');

  return {
    engine: config.engine,
    body: `<div class="cv-root">${inner}</div>`,
    css,
    errors,
    config,
    context,
  };
}

/* ============================================================
 * 输出形态
 * ============================================================ */

export interface ICompileOptions {
  includeDocumentShell?: boolean;
}

/**
 * 编译为 HTML 片段（body + 内联 style）。
 * 保持与 v1 相同的签名，既有调用方无需改动。
 */
export function compileTemplateHtml(
  rawConfig: unknown,
  data: IResumeData,
  options: ICompileOptions = {}
): string {
  const result = renderTemplate(rawConfig, data);
  const body = `${result.body}<style>${result.css}</style>`;

  if (!options.includeDocumentShell) return body;
  return wrapDocument(body);
}

/**
 * 编译为供 iframe srcdoc 使用的隔离文档。
 *
 * CSP 里 default-src 'none' + 没有 script-src，配合 iframe 的 sandbox=""
 * 保证这份文档完全不能执行脚本、不能发起请求。
 */
export function compileTemplateDocument(rawConfig: unknown, data: IResumeData): string {
  return compileTemplateHtml(rawConfig, data, { includeDocumentShell: true });
}

/**
 * 包装为独立 HTML 文档。
 *
 * 导出出来是为了让调用方可以复用同一次 renderTemplate 的结果，
 * 避免为了拿页面尺寸而渲染两遍。
 */
export function wrapResumeDocument(body: string, previewId?: string): string {
  const scriptPolicy = previewId ? " script-src 'unsafe-inline';" : '';
  const paginationScript = previewId
    ? `<script>
(() => {
  const id = ${JSON.stringify(previewId)};
  const pageHeightPx = 297 * 96 / 25.4;
  let lastPageCount = 0;
  const update = () => {
    const root = document.querySelector('.cv-root');
    if (!root) return;
    root.style.minHeight = '297mm';
    const contentHeight = Math.max(root.scrollHeight, pageHeightPx);
    const pageCount = Math.max(1, Math.ceil((contentHeight - 1) / pageHeightPx));
    root.style.minHeight = (pageCount * 297) + 'mm';
    if (pageCount !== lastPageCount) {
      lastPageCount = pageCount;
      parent.postMessage({ type: 'cv-preview-pages', id, pageCount }, '*');
    }
  };
  addEventListener('load', update);
  document.addEventListener('load', update, true);
  requestAnimationFrame(update);
  setTimeout(update, 100);
})();
</script>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:;${scriptPolicy}" />
<title>Resume</title>
<style>
html, body { scrollbar-width: none; }
html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
</style></head><body style="margin:0;background:#fff;">${body}${paginationScript}</body></html>`;
}

/** 把渲染结果拼成完整文档 */
export function resultToDocument(result: IRenderResult, previewId?: string): string {
  return wrapResumeDocument(`${result.body}<style>${result.css}</style>`, previewId);
}

function wrapDocument(body: string): string {
  return wrapResumeDocument(body);
}

/**
 * 静态 HTML 快照：打印 / 分享 / 缩略图共用的出口。
 * html 与 blocks 引擎都是同步产出，直接复用编译结果。
 */
export function snapshotHtml(rawConfig: unknown, data: IResumeData): string {
  return compileTemplateDocument(rawConfig, data);
}
