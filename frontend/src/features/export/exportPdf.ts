/**
 * 客户端直接导出 PDF
 *
 * 流程与预览一致：renderTemplate → paginateResumeRoot → 按 297mm 切片 → jsPDF 下载。
 * 不走浏览器打印对话框。
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { getBuiltinTemplate } from '@cv/template-schema';
import type { IResumeData } from '/@/types/resume';
import { normalizeTemplateConfig, renderTemplate } from '/@/features/template-renderer';
import { paginateResumeRoot } from '/@/features/template-renderer/paginate';
import { useTemplateStore } from '/@/stores/template';

const PX_PER_MM = 96 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_WIDTH_PX = A4_WIDTH_MM * PX_PER_MM;
const A4_HEIGHT_PX = A4_HEIGHT_MM * PX_PER_MM;
const CAPTURE_SCALE = 2;

export interface IExportPdfOptions {
  data: IResumeData;
  /** 可选；不传则按 templateId 解析 */
  config?: unknown;
  filename?: string;
}

/**
 * 解析导出用模板配置（与 ResumePreview 同一套回退顺序）。
 */
export async function resolveExportTemplateConfig(
  data: IResumeData,
  explicitConfig?: unknown
): Promise<unknown> {
  if (explicitConfig) return normalizeTemplateConfig(explicitConfig);

  const templateStore = useTemplateStore();
  const templateId = data.metadata.templateId;

  if (!templateStore.list.length) {
    await templateStore.fetchList();
  }

  const found = templateStore.getById(templateId);
  if (found) return normalizeTemplateConfig(found.config);

  try {
    const detail = await templateStore.loadDetail(templateId);
    if (detail) return normalizeTemplateConfig(detail.config);
  } catch {
    // 接口不可用时走内置模板
  }

  const builtin = getBuiltinTemplate(templateId);
  return normalizeTemplateConfig(builtin?.config || getBuiltinTemplate('minimal')?.config);
}

function sanitizeFilename(name: string): string {
  const trimmed = (name || '简历').trim() || '简历';
  return trimmed.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * 渲染简历并直接下载 PDF 文件。
 */
export async function exportResumePdf(options: IExportPdfOptions): Promise<void> {
  const config = await resolveExportTemplateConfig(options.data, options.config);
  const result = renderTemplate(config, options.data);
  const filename = sanitizeFilename(options.filename || options.data.basics.name || '简历') + '.pdf';

  const host = document.createElement('div');
  host.setAttribute('data-cv-pdf-export', '1');
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

    const canvas = await html2canvas(root, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: A4_WIDTH_PX,
      windowWidth: A4_WIDTH_PX,
    });

    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    });

    const sliceHeight = A4_HEIGHT_PX * CAPTURE_SCALE;
    const sliceWidth = canvas.width;

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      if (pageIndex > 0) pdf.addPage();

      const sourceY = pageIndex * sliceHeight;
      if (sourceY >= canvas.height) break;

      const sourceHeight = Math.min(sliceHeight, canvas.height - sourceY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = sliceWidth;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建 PDF 画布');
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceWidth, sliceHeight);
      ctx.drawImage(canvas, 0, sourceY, sliceWidth, sourceHeight, 0, 0, sliceWidth, sourceHeight);

      const imageData = pageCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imageData, 'JPEG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, 'FAST');
    }

    pdf.save(filename);
  } finally {
    host.remove();
  }
}
