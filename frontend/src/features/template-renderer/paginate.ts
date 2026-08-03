/**
 * 预览智能分页
 *
 * 屏幕预览用「按内容区高度裁切」模拟多页，CSS break-* 不生效。
 * 在测量阶段给会跨页的块前面插入垫片，把块推到下一页内容区起点，
 * 避免标题孤立、条目被拦腰切断。
 */

export interface IPageMarginMm {
  top: number;
  bottom: number;
}

export interface IPaginateOptions {
  /** A4 页高，默认 297mm */
  pageHeightMm?: number;
  margin: IPageMarginMm;
  /** CSS px/mm，默认 96/25.4 */
  pxPerMm?: number;
}

const PAGE_SPACER_ATTR = 'data-cv-page-spacer';

/** 可作为分页原子的块（由细到粗；嵌套时取最外层候选中不相含的节点） */
const BREAK_UNIT_SELECTOR = [
  '.item',
  '.skill-item',
  '.cv-entry',
  '.side-item',
  '.side-sec',
  '.sec-title',
  '.cv-section-title',
  '.head',
  '.cv-header',
].join(',');

const TITLE_SELECTOR = '.sec-title, .cv-section-title';

/**
 * 清除上次分页插入的垫片，便于重新测量。
 */
export function clearPageSpacers(root: HTMLElement): void {
  root.querySelectorAll(`[${PAGE_SPACER_ATTR}]`).forEach((node) => node.remove());
}

/**
 * 相对 root 顶部的偏移（px）。
 */
function offsetFromRoot(root: HTMLElement, el: HTMLElement): { top: number; bottom: number; height: number } {
  const rootRect = root.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top - rootRect.top,
    bottom: rect.bottom - rootRect.top,
    height: rect.height,
  };
}

/**
 * 收集互不嵌套的分页单元（文档顺序）。
 */
function collectBreakUnits(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll(BREAK_UNIT_SELECTOR)) as HTMLElement[];
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
}

/**
 * 标题后紧跟的同 section 内容，用于 keep-with-next。
 * 优先取条目单元；文本型章节则取紧随的 rich/summary。
 */
function findKeepWithTarget(title: HTMLElement, units: HTMLElement[]): HTMLElement | null {
  const index = units.indexOf(title);
  const section = title.closest('.sec, .cv-section, .side-sec');

  if (index >= 0) {
    for (let i = index + 1; i < units.length; i += 1) {
      const next = units[i];
      if (next.matches(TITLE_SELECTOR)) break;
      if (section && !section.contains(next)) break;
      return next;
    }
  }

  let sibling = title.nextElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement) {
      if (sibling.matches('.rich, .summary, .sec-body, .cv-desc, .cv-summary')) {
        return sibling;
      }
      break;
    }
    sibling = sibling.nextElementSibling;
  }
  return null;
}

/**
 * 标题孤立时下推整节，避免 flex 横向标题被垫片拆开。
 */
function spacerAnchor(el: HTMLElement): HTMLElement {
  if (!el.matches(TITLE_SELECTOR)) return el;
  const section = el.closest('.sec, .cv-section, .side-sec');
  return section instanceof HTMLElement ? section : el;
}

function insertSpacerBefore(el: HTMLElement, heightPx: number): void {
  if (heightPx <= 0.5 || !el.parentElement) return;
  const spacer = el.ownerDocument.createElement('div');
  spacer.setAttribute(PAGE_SPACER_ATTR, '1');
  spacer.setAttribute('aria-hidden', 'true');
  spacer.style.cssText = [
    'display:block',
    `height:${heightPx}px`,
    'width:100%',
    'margin:0',
    'padding:0',
    'border:0',
    'overflow:hidden',
    'pointer-events:none',
    'flex-shrink:0',
  ].join(';');
  el.parentElement.insertBefore(spacer, el);
}

/**
 * 在 root 内插入分页垫片，返回分页后的页数。
 */
export function paginateResumeRoot(root: HTMLElement, options: IPaginateOptions): number {
  clearPageSpacers(root);

  const pxPerMm = options.pxPerMm ?? 96 / 25.4;
  const pageHeightPx = (options.pageHeightMm ?? 297) * pxPerMm;
  const topPx = Math.max(0, options.margin.top) * pxPerMm;
  const bottomPx = Math.max(0, options.margin.bottom) * pxPerMm;
  const contentHeightPx = pageHeightPx - topPx - bottomPx;

  if (contentHeightPx <= 1) {
    return 1;
  }

  const units = collectBreakUnits(root);
  // 多轮：前一轮垫片会影响后续块的位置；通常 2～3 轮即可稳定
  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false;

    for (const el of units) {
      if (!el.isConnected) continue;

      const box = offsetFromRoot(root, el);
      if (box.height <= 0) continue;

      // 落在首页上边距之前的跳过
      if (box.bottom <= topPx) continue;

      const flowTop = Math.max(box.top, topPx);
      const pageIndex = Math.max(0, Math.floor((flowTop - topPx) / contentHeightPx));
      const pageContentEnd = topPx + (pageIndex + 1) * contentHeightPx;

      const isTitle = el.matches(TITLE_SELECTOR);
      let blockBottom = box.bottom;
      let blockHeight = box.height;

      if (isTitle) {
        const keepWith = findKeepWithTarget(el, units);
        if (keepWith?.isConnected) {
          const keepBox = offsetFromRoot(root, keepWith);
          blockBottom = Math.max(blockBottom, keepBox.bottom);
          blockHeight = blockBottom - box.top;
        }
      }

      // 未跨过本页内容底边
      if (blockBottom <= pageContentEnd + 0.5) continue;

      // 整块能放进一页内容区 → 推到下一页；否则允许自然拆分（超长条目）
      if (blockHeight <= contentHeightPx + 0.5) {
        const anchor = spacerAnchor(el);
        const anchorBox = anchor === el ? box : offsetFromRoot(root, anchor);
        const spacerHeight = pageContentEnd - anchorBox.top;
        if (spacerHeight > 0.5) {
          insertSpacerBefore(anchor, spacerHeight);
          moved = true;
        }
        continue;
      }

      // 标题本身还能放下、但和首条一起放不下 → 标题会成孤行，仍整组下推
      if (isTitle && box.bottom <= pageContentEnd + 0.5 && box.height <= contentHeightPx + 0.5) {
        const anchor = spacerAnchor(el);
        const anchorBox = anchor === el ? box : offsetFromRoot(root, anchor);
        const spacerHeight = pageContentEnd - anchorBox.top;
        if (spacerHeight > 0.5) {
          insertSpacerBefore(anchor, spacerHeight);
          moved = true;
        }
      }
    }

    if (!moved) break;
  }

  const rootRect = root.getBoundingClientRect();
  let maxBottom = rootRect.height;
  const nodes = root.querySelectorAll('*');
  for (let i = 0; i < nodes.length; i += 1) {
    const rect = (nodes[i] as HTMLElement).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    maxBottom = Math.max(maxBottom, rect.bottom - rootRect.top);
  }

  const usedContentPx = Math.max(contentHeightPx, maxBottom - topPx - bottomPx);
  return Math.max(1, Math.ceil((usedContentPx - 1) / contentHeightPx));
}
