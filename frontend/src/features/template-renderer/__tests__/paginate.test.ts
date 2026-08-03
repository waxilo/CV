import { describe, expect, it } from 'vitest';
import { clearPageSpacers, paginateResumeRoot } from '../paginate';

function makeResume(html: string): HTMLElement {
  document.body.innerHTML = `
    <div class="cv-root" style="width:210mm;position:relative;">
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

  it('标题与首条在页末放不下时，整节推到下一页内容区', () => {
    const filler = Array.from(
      { length: 40 },
      (_, i) => `<div class="item" style="height:28px;margin:0 0 8px;">filler ${i}</div>`
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
    expect(root.querySelectorAll('[data-cv-page-spacer]').length).toBeGreaterThan(0);

    const title = root.querySelector('.sec-title') as HTMLElement;
    const section = title.closest('.sec') as HTMLElement;
    const rootTop = root.getBoundingClientRect().top;
    const titleTop = title.getBoundingClientRect().top - rootTop;
    const pxPerMm = 96 / 25.4;
    const pageH = 297 * pxPerMm;
    const topPx = 20 * pxPerMm;
    // 标题应落在某一整页的内容区起点（N*297 + top）附近
    const offsetInPage = titleTop % pageH;
    expect(Math.abs(offsetInPage - topPx)).toBeLessThan(8);
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

    const huge = root.querySelector('.item') as HTMLElement;
    expect(huge.previousElementSibling?.getAttribute('data-cv-page-spacer')).not.toBe('1');
  });
});
