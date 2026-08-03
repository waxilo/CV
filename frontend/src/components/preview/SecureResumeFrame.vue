<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { IResumeData } from '/@/types/resume';
import type { ITemplateConfig } from '/@/types/template';
import { renderTemplate, resultToDocument } from '/@/features/template-renderer';

const props = withDefaults(
  defineProps<{
    data: IResumeData;
    config: ITemplateConfig | unknown;
    scale?: number;
    /** 翻页预览时，指定当前展示的 A4 页索引（从 0 开始） */
    pageIndex?: number;
    /** 是否裁切为单页高度（翻页模式） */
    clipToPage?: boolean;
  }>(),
  { scale: 1, pageIndex: 0, clipToPage: false }
);

const emit = defineEmits<{
  (e: 'errors', value: string[]): void;
  (e: 'page-count', value: number): void;
}>();

const A4_HEIGHT_PX = (297 * 96) / 25.4;
const PX_PER_MM = 96 / 25.4;

const iframeRef = ref<HTMLIFrameElement | null>(null);
const pageCount = ref(1);
const isMeasuring = ref(false);

const result = computed(() => renderTemplate(props.config, props.data));
const srcdoc = computed(() => resultToDocument(result.value));
const margins = computed(() => result.value.context.page.margin);
const pageContentHeightMm = computed(() =>
  Math.max(1, 297 - margins.value.top - margins.value.bottom)
);
const pageMarginBackground = computed(() => {
  const primaryColorValue =
    result.value.context.vars.primaryColor || result.value.config.primaryColor || '#2563eb';
  const primaryColor =
    typeof primaryColorValue === 'string' ? primaryColorValue : String(primaryColorValue);
  if (result.value.config.layout === 'sidebar-left') {
    return `linear-gradient(to right, ${primaryColor} 0 33%, #fff 33% 100%)`;
  }
  if (result.value.config.layout === 'sidebar-right') {
    return `linear-gradient(to right, #fff 0 67%, ${primaryColor} 67% 100%)`;
  }
  return '#fff';
});

/** 测量时临时拉高 iframe，避免 flex 布局把内容高度锁死在一页 */
const pageSize = computed(() => ({
  width: '210mm',
  height: props.clipToPage && !isMeasuring.value ? '297mm' : `${pageCount.value * 297}mm`,
}));
const iframeHeight = computed(() =>
  isMeasuring.value ? '5000mm' : `${pageCount.value * 297}mm`
);

function setPageCount(next: number): void {
  const nextPageCount = Math.max(1, Math.floor(next || 1));
  if (nextPageCount === pageCount.value) return;
  pageCount.value = nextPageCount;
  emit('page-count', nextPageCount);
}

/** flex 模板里父级常被锁在一页高，scrollHeight 不可靠，改量内容真实底部 */
function measureContentHeightPx(root: HTMLElement): number {
  const rootRect = root.getBoundingClientRect();
  let maxBottom = rootRect.bottom;
  const nodes = root.querySelectorAll('*');
  for (let i = 0; i < nodes.length; i += 1) {
    const rect = nodes[i].getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    maxBottom = Math.max(maxBottom, rect.bottom);
  }
  return Math.max(
    root.scrollHeight,
    root.offsetHeight,
    maxBottom - rootRect.top,
    A4_HEIGHT_PX
  );
}

function measurePagesFromIframe(): void {
  const iframe = iframeRef.value;
  const doc = iframe?.contentDocument;
  const root = doc?.querySelector('.cv-root') as HTMLElement | null;
  if (!iframe || !doc || !root) return;

  isMeasuring.value = true;
  iframe.style.height = '5000mm';
  root.style.height = 'auto';
  root.style.minHeight = '297mm';
  root.style.overflow = 'visible';

  const contentHeightPx = measureContentHeightPx(root);
  const verticalMarginsPx = (margins.value.top + margins.value.bottom) * PX_PER_MM;
  const contentAreaPx = pageContentHeightMm.value * PX_PER_MM;
  const usedContentPx = Math.max(contentAreaPx, contentHeightPx - verticalMarginsPx);
  const nextPageCount = Math.max(1, Math.ceil((usedContentPx - 1) / contentAreaPx));
  setPageCount(nextPageCount);
  isMeasuring.value = false;
}

function scheduleMeasure(): void {
  requestAnimationFrame(() => {
    measurePagesFromIframe();
    setTimeout(measurePagesFromIframe, 80);
    setTimeout(measurePagesFromIframe, 250);
    setTimeout(measurePagesFromIframe, 600);
  });
}

watch(
  srcdoc,
  () => {
    pageCount.value = 1;
    emit('page-count', 1);
    if (iframeRef.value) iframeRef.value.srcdoc = srcdoc.value;
    scheduleMeasure();
  },
  { flush: 'post' }
);

watch(
  () => result.value.errors,
  (errors) => emit('errors', errors),
  { immediate: true, deep: true }
);

function lockPreviewSelection(): void {
  const doc = iframeRef.value?.contentDocument;
  if (!doc) return;
  const block = (event: Event) => event.preventDefault();
  doc.addEventListener('selectstart', block);
  doc.addEventListener('dragstart', block);
  doc.getSelection()?.removeAllRanges();
}

function handleIframeLoad(): void {
  lockPreviewSelection();
  scheduleMeasure();
}
</script>

<template>
  <div
    class="secure-preview"
    :class="{ clipped: clipToPage }"
    :style="{
      width: pageSize.width,
      height: pageSize.height,
      transform: `scale(${scale})`,
      transformOrigin: 'top center',
      '--preview-margin-top': `${margins.top}mm`,
      '--preview-margin-bottom': `${margins.bottom}mm`,
      '--preview-page-background': pageMarginBackground,
    }"
  >
    <iframe
      ref="iframeRef"
      class="frame"
      title="resume-preview"
      sandbox="allow-same-origin"
      :style="{
        width: pageSize.width,
        height: iframeHeight,
        transform: clipToPage
          ? `translateY(-${pageIndex * pageContentHeightMm}mm)`
          : undefined,
      }"
      :srcdoc="srcdoc"
      @load="handleIframeLoad"
    />
    <!-- 挡住 iframe 内的文本选中；点击仍会冒泡到外层卡片 -->
    <div class="interaction-shield" aria-hidden="true" />
  </div>
</template>

<style scoped lang="scss">
.secure-preview {
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}

.secure-preview.clipped {
  overflow: hidden;

  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    z-index: 2;
    background: var(--preview-page-background);
    pointer-events: none;
  }

  &::before {
    top: 0;
    height: var(--preview-margin-top);
  }

  &::after {
    bottom: 0;
    height: var(--preview-margin-bottom);
  }
}

.interaction-shield {
  position: absolute;
  inset: 0;
  z-index: 4;
}

.frame {
  border: none;
  background: #fff;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.12);
  display: block;
  pointer-events: none;
}

@media print {
  .secure-preview {
    transform: none !important;
    width: 100% !important;
  }
  .frame {
    box-shadow: none;
    width: 100% !important;
    min-height: auto !important;
  }
}
</style>
