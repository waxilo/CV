import { describe, expect, it } from 'vitest';
import { clearPageSpacers, paginateResumeRoot } from '../paginate';

function makeResume(html: string, css = ''): HTMLElement {
  document.body.innerHTML = `
    <div class="cv-root" style="width:210mm;position:relative;">
      <style>${css}</style>
      <article class="cv" style="padding:20mm 15mm;">${html}</article>
    </div>
  `;
  return document.querySelector('.cv-root') as HTMLElement;
}

describe('paginateResumeRoot', () => {
  it('清除旧垫片后再分页', () => {
    const root = makeResume(`
      <section class="sec">
        <h2 class="sec-title">经验</h2>
        <div class="item"><strong>A</strong></div>
      </section>
    `);
    const stale = document.createElement('div');
    stale.setAttribute('data-cv-page-spacer', '1');
    root.prepend(stale);
    clearPageSpacers(root);
    expect(root.querySelectorAll('[data-cv-page-spacer]').length).toBe(0);
  });

  it('标题与首条在页末放不下时，整节推到下一页', () => {
    // 用很大的前置块占满第一页内容区，逼近页底
    const filler = Array.from({ length: 40 }, (_, i) =>
      `<div class="item" style="height:28px;margin:0 0 8px;">filler ${i}</div>`
    ).join('');

    const root = makeResume(`
      ${filler}
      <section class="sec">
        <h2 class="sec-title">项目经验</h2>
        <div class="item" style="height:120px;"><strong>证券系统</strong><p>详情</p></div>
      </section>
    `);

    const pages = paginateResumeRoot(root, {
      margin: { top: 20, bottom: 20 },
      pageHeightMm: 297,
    });

    expect(pages).toBeGreaterThanOrEqual(2);
    const spacers = root.querySelectorAll('[data-cv-page-spacer]');
    expect(spacers.length).toBeGreaterThan(0);

    const title = root.querySelector('.sec-title') as HTMLElement;
    const section = title.closest('.sec') as HTMLElement;
    const rootTop = root.getBoundingClientRect().top;
    const titleTop = title.getBoundingClientRect().top - rootTop;
    const pxPerMm = 96 / 25.4;
    const contentH = (297 - 40) * pxPerMm;
    const topPx = 20 * pxPerMm;
    // 标题应落在某一页内容区起点附近，而不是卡在页缝
    const offsetInPage = (titleTop - topPx) % contentH;
    expect(offsetInPage).toBeLessThan(8);
    // 垫片应插在 section 前，而不是 title 前（兼容 flex 标题）
    expect(section.previousElementSibling?.getAttribute('data-cv-page-spacer')).toBe('1');
  });

  it('单条过高时允许跨页，不把整块硬推', () => {
    const root = makeResume(`
      <section class="sec">
        <h2 class="sec-title">超长</h2>
        <div class="item" style="height:2000px;">huge</div>
      </section>
    `);

    paginateResumeRoot(root, {
      margin: { top: 20, bottom: 20 },
      pageHeightMm: 297,
    });

    // 超高条目本身不应被垫片推走（推了也放不下）；标题可能被推
    const huge = root.querySelector('.item') as HTMLElement;
    expect(huge.previousElementSibling?.getAttribute('data-cv-page-spacer')).not.toBe('1');
  });
});
