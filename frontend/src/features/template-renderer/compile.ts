import type { IResumeData, IResumeSection, TSectionItem } from '/@/types/resume';
import type { IBlockStyle, ITemplateBlock, ITemplateConfig } from '/@/types/template';
import { migrateTemplateConfig } from './migrate';
import { renderMustache } from './mustache';
import { sanitizeCss, sanitizeHtml } from './sanitize';

function escapeHtml(value: unknown): string {
  const str = value == null ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
    return `<div class="cv-avatar cv-avatar--placeholder">${escapeHtml((data.basics.name || '?').slice(0, 1))}</div>`;
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
        <div class="cv-entry-head"><strong>${escapeHtml(f(item, 'position'))} · ${escapeHtml(f(item, 'company'))}</strong>
        <span>${escapeHtml(f(item, 'startDate'))} – ${escapeHtml(f(item, 'endDate') || '至今')}</span></div>
        <p class="cv-desc">${escapeHtml(f(item, 'description'))}</p></div>`
      )
      .join('')}</div>`;
  }
  if (section.type === 'education') {
    return `<div class="cv-entries">${items
      .map(
        (item) => `<div class="cv-entry">
        <div class="cv-entry-head"><strong>${escapeHtml(f(item, 'school'))} · ${escapeHtml(f(item, 'degree'))} ${escapeHtml(f(item, 'major'))}</strong>
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
      .map((item) => `<span>${escapeHtml(f(item, 'name'))}（${escapeHtml(f(item, 'level'))}）</span>`)
      .join('')}</div>`;
  }
  return `<div class="cv-entries">${items
    .map(
      (item) => `<div class="cv-entry"><strong>${escapeHtml(f(item, 'title') || f(item, 'name'))}</strong>
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

function buildMustacheContext(data: IResumeData): Record<string, unknown> {
  const ctx: Record<string, unknown> = {
    basics: { ...data.basics },
  };
  for (const section of data.sections) {
    if (!section.visible) continue;
    ctx[section.type] = visibleItems(section).map((item) => ({ ...(item as object) }));
    ctx[`${section.type}_content`] = section.content || '';
    ctx[`${section.type}_name`] = section.name;
  }
  return ctx;
}

function renderBlock(data: IResumeData, block: ITemplateBlock): string {
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
      return wrap(`<div class="cv-text">${escapeHtml(block.content || '').replace(/\n/g, '<br/>')}</div>`, 'cv-block--text');
    case 'section':
      return wrap(renderSectionBlock(data, block), 'cv-block--section');
    case 'html': {
      let rendered = '';
      try {
        rendered = renderMustache(block.content || '', buildMustacheContext(data));
      } catch {
        rendered = '<p class="cv-error">HTML 模板渲染失败</p>';
      }
      return wrap(sanitizeHtml(rendered), 'cv-block--html');
    }
    default:
      return '';
  }
}

function baseStyles(config: ITemplateConfig, margin: number): string {
  return `
.cv-root {
  --primary: ${config.primaryColor};
  --font: ${config.fontFamily};
  --size: ${config.fontSize}px;
  --lh: ${config.spacing};
  --margin: ${margin}px;
  box-sizing: border-box;
  width: 210mm;
  min-height: 297mm;
  background: #fff;
  color: #0f172a;
  font-family: var(--font), 'PingFang SC', sans-serif;
  font-size: var(--size);
  line-height: var(--lh);
}
.cv-root *, .cv-root *::before, .cv-root *::after { box-sizing: border-box; }
.cv-row { display: flex; flex-wrap: wrap; width: 100%; }
.cv-col { min-width: 0; }
${Array.from({ length: 12 }, (_, i) => `.cv-col-${i + 1}{ width:${((i + 1) / 12) * 100}%; }`).join('\n')}
.cv-name { font-size: 1.7em; line-height: 1.2; margin: 0 0 8px; }
.cv-headline { opacity: 0.9; margin: 0 0 16px; }
.cv-contacts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 0.9em; }
.cv-section { margin-bottom: 16px; }
.cv-section-title {
  font-size: 1.05em; color: var(--primary);
  border-bottom: 2px solid var(--primary); padding-bottom: 4px; margin: 0 0 10px;
}
.cv-entry { margin-bottom: 12px; }
.cv-entry-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.cv-entry-head span { color: #64748b; white-space: nowrap; font-size: 0.9em; }
.cv-desc, .cv-summary { white-space: pre-wrap; color: #334155; margin: 0; }
.cv-skills { display: flex; flex-direction: column; gap: 8px; }
.cv-skill { display: grid; grid-template-columns: 90px 1fr; gap: 10px; align-items: center; }
.cv-bar { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
.cv-bar i { display: block; height: 100%; background: var(--primary); }
.cv-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.cv-tags span { background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 0.9em; }
.cv-divider { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
.cv-avatar { width: 72px; height: 72px; border-radius: 50%; overflow: hidden; margin-bottom: 12px; background: rgba(255,255,255,0.2); display: grid; place-items: center; font-size: 28px; font-weight: 700; }
.cv-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cv-error { color: #dc2626; font-size: 12px; }
@media print {
  .cv-root { box-shadow: none; width: 100%; min-height: auto; }
}
`;
}

/**
 * 将模板 DSL + 简历数据编译为完整 HTML 文档片段（含样式）
 */
export function compileTemplateHtml(
  rawConfig: unknown,
  data: IResumeData,
  options: { includeDocumentShell?: boolean } = {}
): string {
  const config = migrateTemplateConfig(rawConfig);
  const rowsHtml = config.document.rows
    .map((row) => {
      const cols = row.columns
        .map((col) => {
          const blocks = col.blocks.map((b) => renderBlock(data, b)).join('');
          return `<div class="cv-col cv-col-${col.span}" style="${styleToCss(col.style)}">${blocks}</div>`;
        })
        .join('');
      return `<div class="cv-row" style="${styleToCss(row.style)}">${cols}</div>`;
    })
    .join('');

  const custom = sanitizeCss(config.customCss || '');
  const css = `${baseStyles(config, data.metadata.page.margin)}\n${custom}`;
  const body = `<div class="cv-root">${rowsHtml}</div><style>${css}</style>`;

  if (!options.includeDocumentShell) return body;

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:;" />
<title>Resume</title></head><body style="margin:0;background:#fff;">${body}</body></html>`;
}

/**
 * 生成供 iframe srcdoc 使用的隔离文档
 */
export function compileTemplateDocument(rawConfig: unknown, data: IResumeData): string {
  return compileTemplateHtml(rawConfig, data, { includeDocumentShell: true });
}
