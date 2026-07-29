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

function rootCss(cssVars: Record<string, string>, paged: boolean): string {
  return `
${SCOPE_SELECTOR} {
${cssVarsToDeclarations(cssVars)}
  box-sizing: border-box;
  width: var(--page-width);
  min-height: var(--page-height);
  margin: 0 auto;
  background: #fff;
  color: var(--tpl-text-color, #0f172a);
  font-family: var(--tpl-font-family, Inter), 'PingFang SC', system-ui, sans-serif;
  font-size: var(--tpl-font-size, 14px);
  line-height: var(--tpl-line-height, 1.15);
  overflow-wrap: break-word;
}
${SCOPE_SELECTOR} *,
${SCOPE_SELECTOR} *::before,
${SCOPE_SELECTOR} *::after { box-sizing: inherit; }
${paged ? pagedCss() : ''}
@media print {
  ${SCOPE_SELECTOR} { width: 100%; min-height: auto; box-shadow: none; margin: 0; }
}
`;
}

function pagedCss(): string {
  return `
${SCOPE_SELECTOR} .page-break { break-before: page; }
${SCOPE_SELECTOR} .no-break { break-inside: avoid; }
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
    rootCss(cssVars, config.page?.paged ?? true),
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
export function wrapResumeDocument(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:;" />
<title>Resume</title></head><body style="margin:0;background:#fff;">${body}</body></html>`;
}

/** 把渲染结果拼成完整文档 */
export function resultToDocument(result: IRenderResult): string {
  return wrapResumeDocument(`${result.body}<style>${result.css}</style>`);
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
