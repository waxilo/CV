/**
 * blocks 引擎：v1 区块 DSL 的渲染实现（兼容路径）
 *
 * 这段逻辑从原 compile.ts 平移而来，行为保持不变，
 * 只把 html 区块的插值上下文换成新的渲染视图模型（同时保留旧的扁平别名）。
 */

import type { ITemplateBlock, ITemplateConfigV2, IBlockStyle } from '@cv/template-schema';
import type { IResumeData, IResumeSection, TSectionItem } from '/@/types/resume';
import type { IRenderContext } from '../context';
import { escapeHtml } from '../helpers';
import { sanitizeHtml } from '../sanitize';
import { renderTemplateSource } from '../template-lang';

function styleToCss(style?: IBlockStyle): string {
  if (!style) return '';
  const map: Record<string, string | undefined> = {
    padding: style.padding,
    margin: style.margin,
    'font-size': style.fontSize,
    color: style.color,
    'background-color': style.backgroundColor,
    'text-align': style.textAlign,
    'font-weight': style.fontWeight,
    'border-radius': style.borderRadius,
  };
  return Object.entries(map)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

function visibleItems(section: IResumeSection): TSectionItem[] {
  return section.items.filter((i) => (i as { visible?: boolean }).visible !== false);
}

function f(item: TSectionItem, key: string): string {
  const val = (item as Record<string, unknown>)[key];
  return val == null ? '' : String(val);
}

function n(item: TSectionItem, key: string): number {
  return Number((item as Record<string, unknown>)[key] || 0);
}

function findSection(data: IResumeData, type: string): IResumeSection | undefined {
  return data.sections.find((s) => s.type === type && s.visible);
}

function renderBasics(data: IResumeData): string {
  const b = data.basics;
  return `<div class="cv-basics">
    <h1 class="cv-name">${escapeHtml(b.name || '你的姓名')}</h1>
    <p class="cv-headline">${escapeHtml(b.headline || '求职方向')}</p>
    <ul class="cv-contacts">
      ${b.email ? `<li>${escapeHtml(b.email)}</li>` : ''}
      ${b.phone ? `<li>${escapeHtml(b.phone)}</li>` : ''}
      ${b.location ? `<li>${escapeHtml(b.location)}</li>` : ''}
      ${b.url ? `<li>${escapeHtml(b.url)}</li>` : ''}
    </ul>
  </div>`;
}

function renderAvatar(data: IResumeData): string {
  const url = data.basics.avatarUrl;
  if (!url || !/^(https?:|data:image\/)/i.test(url)) {
    return `<div class="cv-avatar cv-avatar--placeholder">${escapeHtml(
      (data.basics.name || '?').slice(0, 1)
    )}</div>`;
  }
  return `<div class="cv-avatar"><img src="${escapeHtml(url)}" alt="avatar" /></div>`;
}

function renderSectionBody(section: IResumeSection): string {
  const items = visibleItems(section);

  if (section.type === 'summary') {
    return `<p class="cv-summary">${escapeHtml(section.content || '')}</p>`;
  }

  if (section.type === 'experience') {
    return `<div class="cv-entries">${items
      .map(
        (item) => `<div class="cv-entry">
        <div class="cv-entry-head"><strong>${escapeHtml(f(item, 'position'))} · ${escapeHtml(
          f(item, 'company')
        )}</strong>
        <span>${escapeHtml(f(item, 'startDate'))} – ${escapeHtml(
          f(item, 'endDate') || '至今'
        )}</span></div>
        <p class="cv-desc">${escapeHtml(f(item, 'description'))}</p></div>`
      )
      .join('')}</div>`;
  }

  if (section.type === 'education') {
    return `<div class="cv-entries">${items
      .map(
        (item) => `<div class="cv-entry">
        <div class="cv-entry-head"><strong>${escapeHtml(f(item, 'school'))} · ${escapeHtml(
          f(item, 'degree')
        )} ${escapeHtml(f(item, 'major'))}</strong>
        <span>${escapeHtml(f(item, 'startDate'))} – ${escapeHtml(f(item, 'endDate'))}</span></div>
        <p class="cv-desc">${escapeHtml(f(item, 'description'))}</p></div>`
      )
      .join('')}</div>`;
  }

  if (section.type === 'skills') {
    return `<div class="cv-skills">${items
      .map(
        (item) => `<div class="cv-skill"><span>${escapeHtml(f(item, 'name'))}</span>
        <div class="cv-bar"><i style="width:${(n(item, 'level') / 5) * 100}%"></i></div></div>`
      )
      .join('')}</div>`;
  }

  if (section.type === 'projects') {
    return `<div class="cv-entries">${items
      .map(
        (item) => `<div class="cv-entry">
        <div class="cv-entry-head"><strong>${escapeHtml(f(item, 'name'))}</strong>
        <span>${escapeHtml(f(item, 'startDate'))} – ${escapeHtml(f(item, 'endDate'))}</span></div>
        <p class="cv-desc">${escapeHtml(f(item, 'description'))}</p></div>`
      )
      .join('')}</div>`;
  }

  if (section.type === 'languages') {
    return `<div class="cv-tags">${items
      .map(
        (item) =>
          `<span>${escapeHtml(f(item, 'name'))}（${escapeHtml(f(item, 'level'))}）</span>`
      )
      .join('')}</div>`;
  }

  return `<div class="cv-entries">${items
    .map(
      (item) => `<div class="cv-entry"><strong>${escapeHtml(
        f(item, 'title') || f(item, 'name')
      )}</strong>
      <p class="cv-desc">${escapeHtml(f(item, 'description'))}</p></div>`
    )
    .join('')}</div>`;
}

function renderSectionBlock(data: IResumeData, block: ITemplateBlock): string {
  const section = findSection(data, block.sectionType || '');
  if (!section) return '';
  return `<section class="cv-block cv-section">
    <h2 class="cv-section-title">${escapeHtml(section.name)}</h2>
    ${renderSectionBody(section)}
  </section>`;
}

/**
 * html 区块的插值上下文。
 *
 * 在新的渲染视图模型之上补一层旧的扁平别名（experience / experience_name 等），
 * 这样历史上保存的自定义 html 区块内容不会因为升级而失效。
 */
export function buildBlockInterpolationContext(
  data: IResumeData,
  context: IRenderContext
): Record<string, unknown> {
  const ctx: Record<string, unknown> = { ...context };

  for (const section of data.sections) {
    if (!section.visible) continue;
    ctx[section.type] = visibleItems(section).map((item) => ({ ...(item as object) }));
    ctx[`${section.type}_content`] = section.content || '';
    ctx[`${section.type}_name`] = section.name;
  }

  return ctx;
}

function renderBlock(
  data: IResumeData,
  block: ITemplateBlock,
  interpolationCtx: Record<string, unknown>
): string {
  if (!block.visible) return '';
  const style = styleToCss(block.style);
  const wrap = (inner: string, cls: string) =>
    `<div class="cv-block ${cls}" style="${style}">${inner}</div>`;

  switch (block.type) {
    case 'basics':
      return wrap(renderBasics(data), 'cv-block--basics');
    case 'avatar':
      return wrap(renderAvatar(data), 'cv-block--avatar');
    case 'divider':
      return wrap('<hr class="cv-divider" />', 'cv-block--divider');
    case 'text':
      return wrap(
        `<div class="cv-text">${escapeHtml(block.content || '').replace(/\n/g, '<br/>')}</div>`,
        'cv-block--text'
      );
    case 'section':
      return wrap(renderSectionBlock(data, block), 'cv-block--section');
    case 'html': {
      let rendered: string;
      try {
        rendered = renderTemplateSource(block.content || '', interpolationCtx);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return wrap(
          `<p class="cv-error">HTML 区块渲染失败：${escapeHtml(message)}</p>`,
          'cv-block--html'
        );
      }
      return wrap(sanitizeHtml(rendered), 'cv-block--html');
    }
    default:
      return '';
  }
}

/**
 * 渲染 v1 区块文档
 */
export function renderBlocksToHtml(
  config: ITemplateConfigV2,
  data: IResumeData,
  context: IRenderContext
): string {
  const interpolationCtx = buildBlockInterpolationContext(data, context);

  return config.document.rows
    .map((row) => {
      const cols = row.columns
        .map((col) => {
          const blocks = col.blocks
            .map((b) => renderBlock(data, b, interpolationCtx))
            .join('');
          return `<div class="cv-col cv-col-${col.span}" style="${styleToCss(
            col.style
          )}">${blocks}</div>`;
        })
        .join('');
      return `<div class="cv-row" style="${styleToCss(row.style)}">${cols}</div>`;
    })
    .join('');
}

/**
 * blocks 引擎的内置样式
 */
export function blocksBaseCss(): string {
  return `
.cv-row { display: flex; flex-wrap: wrap; width: 100%; }
.cv-col { min-width: 0; }
${Array.from({ length: 12 }, (_, i) => `.cv-col-${i + 1}{ width:${((i + 1) / 12) * 100}%; }`).join('\n')}
.cv-name { font-size: 1.7em; line-height: 1.2; margin: 0 0 8px; }
.cv-headline { opacity: 0.9; margin: 0 0 16px; }
.cv-contacts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 0.9em; }
.cv-section { margin-bottom: 16px; }
.cv-section-title {
  font-size: 1.05em; color: var(--tpl-primary-color);
  border-bottom: 2px solid var(--tpl-primary-color); padding-bottom: 4px; margin: 0 0 10px;
}
.cv-entry { margin-bottom: 12px; break-inside: avoid; }
.cv-entry-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.cv-entry-head span { color: var(--tpl-muted-color); white-space: nowrap; font-size: 0.9em; }
.cv-desc, .cv-summary { white-space: pre-wrap; color: #334155; margin: 0; }
.cv-skills { display: flex; flex-direction: column; gap: 8px; }
.cv-skill { display: grid; grid-template-columns: 90px 1fr; gap: 10px; align-items: center; }
.cv-bar { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
.cv-bar i { display: block; height: 100%; background: var(--tpl-primary-color); }
.cv-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.cv-tags span { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 0.9em; }
.cv-divider { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
.cv-avatar { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; margin-bottom: 12px; background: rgba(255,255,255,0.2); display: grid; place-items: center; font-size: 28px; font-weight: 700; }
.cv-avatar img { width: 100%; height: 100%; object-fit: cover; }
`;
}
