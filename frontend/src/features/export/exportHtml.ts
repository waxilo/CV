/**
 * 导出带模板样式的纯 HTML+CSS 单文件。
 *
 * 复用预览/PDF 同一套 renderTemplate；在离屏 DOM 跑分页垫片后序列化。
 * 额外内嵌 #cv-data（结构化 JSON）与 AI 提示词，支持「导出 → AI 改 JSON → 导入」往返。
 * application/json / text/plain 的 script 不会执行，页面仍为静态文档。
 */

import type { IResumeData } from '/@/types/resume';
import { renderTemplate } from '/@/features/template-renderer';
import { paginateResumeRoot } from '/@/features/template-renderer/paginate';
import { resolveExportTemplateConfig } from './exportPdf';
import { downloadTextFile, sanitizeFilename } from './filename';
import { buildCvPayloadHtml } from './cvPayload';

const PX_PER_MM = 96 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_WIDTH_PX = A4_WIDTH_MM * PX_PER_MM;

export interface IExportHtmlOptions {
  data: IResumeData;
  /** 可选；不传则按 templateId 解析 */
  config?: unknown;
  filename?: string;
  /** 文档 <title>，默认取姓名/文件名 */
  title?: string;
}

export interface IBuildHtmlDocumentOptions {
  bodyHtml: string;
  css: string;
  title: string;
  /** 内嵌的结构化简历；有则写入 #cv-data 与 AI 提示 */
  resumeData?: IResumeData;
  widthMm?: number;
  heightMm?: number;
  pageCount?: number;
}

/**
 * 组装可独立打开的 HTML 文档（展示层无脚本；数据层为 application/json）。
 */
export function buildExportHtmlDocument(options: IBuildHtmlDocumentOptions): string {
  const widthMm = options.widthMm ?? A4_WIDTH_MM;
  const heightMm = options.heightMm ?? A4_HEIGHT_MM;
  const pageCount = Math.max(1, options.pageCount ?? 1);
  const title = escapeHtml(options.title || '简历');
  // 防止 CSS 中的 "</style>" 提前闭合 style 标签
  const css = String(options.css || '').replace(/<\/style/gi, '<\\/style');
  const payloadHtml = options.resumeData ? buildCvPayloadHtml(options.resumeData) : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
html, body {
  margin: 0;
  padding: 0;
  background: #e8e8e8;
}
body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  box-sizing: border-box;
  gap: 12px;
}
.cv-ai-hint {
  width: ${widthMm}mm;
  max-width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
}
.cv-ai-hint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.cv-export-sheet {
  width: ${widthMm}mm;
  min-height: ${pageCount * heightMm}mm;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.cv-export-sheet .cv-root {
  width: ${widthMm}mm;
  max-width: ${widthMm}mm;
  min-width: ${widthMm}mm;
  min-height: ${pageCount * heightMm}mm;
  margin: 0;
  box-shadow: none;
  overflow: visible;
}
@media print {
  html, body {
    background: #fff;
    padding: 0;
  }
  body {
    display: block;
  }
  .cv-ai-hint {
    display: none !important;
  }
  .cv-export-sheet {
    box-shadow: none;
    width: ${widthMm}mm;
    min-height: auto;
  }
  @page {
    size: A4;
    margin: 0;
  }
}
</style>
<style>
${css}
</style>
</head>
<body>
${payloadHtml}
<div class="cv-export-sheet">
${options.bodyHtml}
</div>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * 渲染当前模板并生成带分页垫片的完整 HTML 字符串。
 */
export async function resumeToHtmlDocument(options: IExportHtmlOptions): Promise<string> {
  const config = await resolveExportTemplateConfig(options.data, options.config);
  const result = renderTemplate(config, options.data);
  const title =
    options.title ||
    options.filename ||
    options.data.basics.name ||
    '简历';

  const host = document.createElement('div');
  host.setAttribute('data-cv-html-export', '1');
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${A4_WIDTH_PX}px`,
    'background:#fff',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');
  host.innerHTML = `${result.body}<style>${result.css}</style>`;
  document.body.appendChild(host);

  try {
    const root = host.querySelector('.cv-root') as HTMLElement | null;
    if (!root) {
      throw new Error('简历渲染失败：未找到 .cv-root');
    }

    root.style.width = `${A4_WIDTH_MM}mm`;
    root.style.maxWidth = `${A4_WIDTH_MM}mm`;
    root.style.minWidth = `${A4_WIDTH_MM}mm`;
    root.style.height = 'auto';
    root.style.overflow = 'visible';
    root.style.margin = '0';
    root.style.boxShadow = 'none';

    const pageCount = paginateResumeRoot(root, {
      margin: {
        top: result.context.page.margin.top,
        bottom: result.context.page.margin.bottom,
      },
      pxPerMm: PX_PER_MM,
    });
    root.style.minHeight = `${pageCount * A4_HEIGHT_MM}mm`;

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await waitForNextPaint();

    // 只序列化简历根节点，外层样式由文档壳提供
    const bodyHtml = root.outerHTML;

    return buildExportHtmlDocument({
      bodyHtml,
      css: result.css,
      title,
      resumeData: options.data,
      widthMm: result.context.page.widthMm || A4_WIDTH_MM,
      heightMm: result.context.page.heightMm || A4_HEIGHT_MM,
      pageCount,
    });
  } finally {
    host.remove();
  }
}

/**
 * 导出纯 HTML+CSS 单文件并触发下载。
 */
export async function exportResumeHtml(options: IExportHtmlOptions): Promise<void> {
  const html = await resumeToHtmlDocument(options);
  const filename = sanitizeFilename(options.filename || options.data.basics.name || '简历') + '.html';
  downloadTextFile(html, filename, 'text/html;charset=utf-8');
}
