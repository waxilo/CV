/**
 * html 引擎：代码化 HTML 模板
 *
 * 模板作者写完整的 HTML 结构 + CSS，通过模板语法与简历 JSON 拼装。
 */

import type { ITemplateConfigV2 } from '@cv/template-schema';
import type { IRenderContext } from '../context';
import { escapeHtml } from '../helpers';
import { sanitizeHtml } from '../sanitize';
import { TemplateSyntaxError, renderTemplateSource } from '../template-lang';

export interface IHtmlRenderResult {
  html: string;
  errors: string[];
}

/**
 * 渲染 HTML 模板。
 *
 * 失败时不抛错，而是返回一个可见的错误块 —— 设计器里边写边预览，
 * 语法错误是常态，白屏会让人不知道发生了什么。
 */
export function renderHtmlTemplate(
  config: ITemplateConfigV2,
  context: IRenderContext
): IHtmlRenderResult {
  const source = config.source?.html || '';

  if (!source.trim()) {
    return {
      html: renderNotice('该模板还没有 HTML 内容', '在设计器的「HTML」标签里编写模板结构。'),
      errors: ['source.html 为空'],
    };
  }

  let rendered: string;
  try {
    rendered = renderTemplateSource(source, context as unknown as Record<string, unknown>);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const title = e instanceof TemplateSyntaxError ? '模板语法错误' : '模板渲染失败';
    return { html: renderNotice(title, message), errors: [message] };
  }

  const allowRemoteImages = config.capabilities?.allowRemoteImages ?? true;
  return { html: sanitizeHtml(rendered, { allowRemoteImages }), errors: [] };
}

function renderNotice(title: string, detail: string): string {
  return `<div class="cv-notice">
    <strong>${escapeHtml(title)}</strong>
    <p>${escapeHtml(detail)}</p>
  </div>`;
}

/**
 * html 引擎的内置样式：只做最小重置，把排版完全交给模板作者。
 */
export function htmlBaseCss(): string {
  return `
.cv-root img { max-width: 100%; }
.cv-root p:first-child { margin-top: 0; }
.cv-root p:last-child { margin-bottom: 0; }
.cv-notice {
  margin: 24px; padding: 16px 18px;
  border: 1px solid #fca5a5; border-left-width: 4px;
  border-radius: 6px; background: #fef2f2; color: #991b1b;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
}
.cv-notice strong { display: block; margin-bottom: 6px; }
.cv-notice p { margin: 0; white-space: pre-wrap; word-break: break-word; }
`;
}
