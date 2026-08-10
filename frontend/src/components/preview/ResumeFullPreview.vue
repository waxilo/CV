<script setup lang="ts">
/**
 * 专业 PDF / A4 简历阅读器。
 * - overlay：全屏沉浸预览（首页 / 模板中心）
 * - page：独立页面（公开分享）
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PaperThumb from '/@/components/preview/PaperThumb.vue';
import type { IResumeData } from '/@/types/resume';
import type { ITemplateConfig } from '/@/types/template';

/** CSS 1mm = 96/25.4px；A4 宽约 793.7px = 100% */
const A4_WIDTH_PX = (210 * 96) / 25.4;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

const props = withDefaults(
  defineProps<{
    data: IResumeData;
    config: ITemplateConfig;
    title?: string;
    /** overlay 全屏阅读器；page 嵌入页面 */
    variant?: 'overlay' | 'page';
    /** 是否显示内置工具栏（缩放等）；page 默认 false，可用 header slot */
    showToolbar?: boolean;
    /** 是否显示刷新按钮（外部负责重新获取数据） */
    canRefresh?: boolean;
    isRefreshing?: boolean;
  }>(),
  {
    title: '',
    variant: 'page',
    showToolbar: undefined,
    canRefresh: false,
    isRefreshing: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'refresh'): void;
}>();

const stageRef = ref<HTMLElement | null>(null);
const pageCount = ref(1);
const zoom = ref(1);
const isFitMode = ref(false);
const isClosing = ref(false);
const isEntered = ref(false);

const hasToolbar = computed(() =>
  props.showToolbar === undefined ? props.variant === 'overlay' : props.showToolbar
);

const zoomPercent = computed(() => Math.round(zoom.value * 100));

const paperWidthPx = computed(() => Math.max(120, A4_WIDTH_PX * zoom.value));

const paperWrapStyle = computed(() => ({
  width: `${paperWidthPx.value}px`,
}));

const pageLabel = computed(() => `${pageCount.value} 页`);

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
}

function getFitZoom(): number {
  const stage = stageRef.value;
  if (!stage) return 1;
  const available = Math.max(160, stage.clientWidth - 48);
  return clampZoom(available / A4_WIDTH_PX);
}

/** 默认：大屏 100%；窄屏自动适应宽度 */
function applyDefaultZoom() {
  const fit = getFitZoom();
  if (fit < 0.98) {
    isFitMode.value = true;
    zoom.value = fit;
  } else {
    isFitMode.value = false;
    zoom.value = 1;
  }
}

function setZoomKeepingCenter(nextZoom: number, anchor?: { x: number; y: number }) {
  const stage = stageRef.value;
  const prev = zoom.value;
  const clamped = clampZoom(nextZoom);
  if (!stage || Math.abs(clamped - prev) < 0.001) {
    zoom.value = clamped;
    return;
  }

  const rect = stage.getBoundingClientRect();
  const ax = anchor?.x ?? rect.width / 2;
  const ay = anchor?.y ?? rect.height / 2;
  const contentX = (stage.scrollLeft + ax) / prev;
  const contentY = (stage.scrollTop + ay) / prev;

  isFitMode.value = false;
  zoom.value = clamped;

  void nextTick(() => {
    stage.scrollLeft = contentX * clamped - ax;
    stage.scrollTop = contentY * clamped - ay;
  });
}

function zoomIn() {
  setZoomKeepingCenter(zoom.value + ZOOM_STEP);
}

function zoomOut() {
  setZoomKeepingCenter(zoom.value - ZOOM_STEP);
}

function zoomTo100() {
  setZoomKeepingCenter(1);
}

function fitToWindow() {
  const stage = stageRef.value;
  const next = getFitZoom();
  if (!stage) {
    zoom.value = next;
    isFitMode.value = true;
    return;
  }
  const rect = stage.getBoundingClientRect();
  const prev = zoom.value;
  const ax = rect.width / 2;
  const ay = rect.height / 2;
  const contentX = (stage.scrollLeft + ax) / prev;
  const contentY = (stage.scrollTop + ay) / prev;
  zoom.value = next;
  isFitMode.value = true;
  void nextTick(() => {
    stage.scrollLeft = contentX * next - ax;
    stage.scrollTop = contentY * next - ay;
  });
}

function handlePageCount(count: number) {
  pageCount.value = Math.max(1, count);
}

function handleStageWheel(event: WheelEvent) {
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  const stage = stageRef.value;
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
  setZoomKeepingCenter(zoom.value + delta, {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });
}

function handleKeydown(event: KeyboardEvent) {
  if (props.variant !== 'overlay') return;
  if (event.key === 'Escape') {
    event.preventDefault();
    requestClose();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && (event.key === '=' || event.key === '+')) {
    event.preventDefault();
    zoomIn();
  } else if ((event.metaKey || event.ctrlKey) && event.key === '-') {
    event.preventDefault();
    zoomOut();
  } else if ((event.metaKey || event.ctrlKey) && event.key === '0') {
    event.preventDefault();
    zoomTo100();
  }
}

function requestClose() {
  if (props.variant !== 'overlay') {
    emit('close');
    return;
  }
  if (isClosing.value) return;
  isClosing.value = true;
  window.setTimeout(() => {
    emit('close');
  }, 180);
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) requestClose();
}

let resizeObserver: ResizeObserver | null = null;
let previousBodyOverflow = '';

onMounted(() => {
  requestAnimationFrame(() => {
    applyDefaultZoom();
    isEntered.value = true;
  });

  window.addEventListener('keydown', handleKeydown);

  if (props.variant === 'overlay') {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  if (stageRef.value) {
    stageRef.value.addEventListener('wheel', handleStageWheel, { passive: false });
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (isFitMode.value) {
          zoom.value = getFitZoom();
        }
      });
      resizeObserver.observe(stageRef.value);
    }
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  stageRef.value?.removeEventListener('wheel', handleStageWheel);
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (props.variant === 'overlay') {
    document.body.style.overflow = previousBodyOverflow;
  }
});

watch(
  () => [props.data, props.config] as const,
  () => {
    pageCount.value = 1;
  }
);
</script>

<template>
  <Teleport to="body" :disabled="variant !== 'overlay'">
    <div
      class="resume-reader"
      :class="[
        `is-${variant}`,
        {
          'is-entered': isEntered,
          'is-closing': isClosing,
        },
      ]"
      role="dialog"
      :aria-modal="variant === 'overlay'"
      :aria-label="title || '简历预览'"
      @click="variant === 'overlay' ? handleBackdropClick($event) : undefined"
    >
      <div class="reader-shell" @click.stop>
        <header v-if="hasToolbar" class="reader-toolbar no-print">
          <div class="toolbar-left">
            <strong class="doc-title">{{ title || '简历预览' }}</strong>
            <span class="page-meta">{{ pageLabel }}</span>
          </div>

          <div class="toolbar-center" aria-label="缩放">
            <button type="button" class="tool-btn" title="缩小" @click="zoomOut">
              <el-icon><ZoomOut /></el-icon>
            </button>
            <button type="button" class="zoom-label" title="恢复 100%" @click="zoomTo100">
              {{ zoomPercent }}%
            </button>
            <button type="button" class="tool-btn" title="放大" @click="zoomIn">
              <el-icon><ZoomIn /></el-icon>
            </button>
            <span class="tool-divider" aria-hidden="true" />
            <button type="button" class="tool-btn text" title="适应窗口" @click="fitToWindow">
              适应
            </button>
          </div>

          <div class="toolbar-right">
            <button
              v-if="canRefresh"
              type="button"
              class="tool-btn"
              title="获取 MCP 最新修改"
              aria-label="刷新简历"
              :disabled="isRefreshing"
              @click="emit('refresh')"
            >
              <el-icon :class="{ spinning: isRefreshing }"><RefreshRight /></el-icon>
            </button>
            <button
              v-if="variant === 'overlay'"
              type="button"
              class="tool-btn close"
              title="关闭"
              aria-label="关闭预览"
              @click="requestClose"
            >
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </header>

        <header v-else-if="$slots.header" class="reader-custom-header no-print">
          <slot name="header" />
        </header>

        <div
          ref="stageRef"
          class="reader-stage"
        >
          <div class="paper-stack" :style="paperWrapStyle">
            <PaperThumb
              :data="data"
              :config="config"
              :fallback-scale="zoom"
              :show-all-pages="true"
              page-layout="vertical"
              :page-gap="28"
              @page-count="handlePageCount"
            />
          </div>
        </div>

        <p v-if="hasToolbar" class="reader-hint no-print">
          滚轮浏览 · ⌘/Ctrl + 滚轮缩放
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.resume-reader {
  --reader-bg: #eceff3;
  --reader-bg-accent: #f7f8fa;
  --reader-ink: #0f172a;
  --reader-muted: #64748b;
  --reader-line: rgba(15, 23, 42, 0.08);
  --reader-toolbar: rgba(255, 255, 255, 0.92);

  &.is-page {
    /* 占满视口，由 .reader-stage 内部滚动；仅 min-height 会导致内容撑开且 body 无法滚动 */
    height: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: linear-gradient(180deg, #e8ebf0 0%, var(--reader-bg) 40%, var(--reader-bg-accent) 100%);

    .reader-shell {
      height: 100%;
      min-height: 0;
    }

    .reader-hint {
      display: none;
    }
  }

  &.is-overlay {
    position: fixed;
    inset: 0;
    z-index: 4000;
    display: flex;
    flex-direction: column;
    background: rgba(15, 23, 42, 0.42);
    opacity: 0;
    transition: opacity 180ms ease;

    .reader-shell {
      position: relative;
      margin: 0;
      width: 100%;
      height: 100%;
      transform: translateY(10px) scale(0.985);
      opacity: 0;
      transition:
        transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 220ms ease;
    }

    &.is-entered {
      opacity: 1;

      &:not(.is-closing) .reader-shell {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }

    &.is-closing {
      opacity: 0;
      /* 淡出期间禁止点击，避免穿透到底下「查看大图」又打开一次 */
      pointer-events: none;

      .reader-shell {
        transform: translateY(8px) scale(0.99);
        opacity: 0;
      }
    }
  }
}

.reader-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  background: linear-gradient(180deg, #e9edf2 0%, #f3f5f7 45%, #f7f8fa 100%);
}

.reader-toolbar {
  flex-shrink: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 14px;
  border-bottom: 1px solid var(--reader-line);
  background: var(--reader-toolbar);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.toolbar-right {
  justify-content: flex-end;
}

.toolbar-center {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--reader-line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
}

.doc-title {
  overflow: hidden;
  max-width: min(42vw, 360px);
  color: var(--reader-ink);
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-meta {
  flex-shrink: 0;
  color: var(--reader-muted);
  font-size: 12px;
  font-weight: 600;
}

.tool-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  &:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  &.text {
    width: auto;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 650;
  }

  &.close:hover {
    background: #fee2e2;
    color: #b91c1c;
  }
}

.spinning {
  animation: reader-spin 0.8s linear infinite;
}

@keyframes reader-spin {
  to {
    transform: rotate(360deg);
  }
}

.zoom-label {
  min-width: 52px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;

  &:hover {
    background: #f1f5f9;
  }
}

.tool-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--reader-line);
}

.reader-custom-header {
  flex-shrink: 0;
  z-index: 2;
  padding: 14px 20px;
  border-bottom: 1px solid var(--reader-line);
  background: var(--reader-toolbar);
  backdrop-filter: blur(12px);
}

.reader-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 28px 16px 48px;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.35) transparent;

  &::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 8px;
    background: rgba(100, 116, 139, 0.35);
  }
}

.paper-stack {
  margin: 0 auto;
  max-width: 100%;
  animation: paper-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both;

  :deep(.cv-paper.stacked) {
    background: transparent;
    box-shadow: none;
  }

  :deep(.cv-paper:not(.stacked)) {
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 10px 28px rgba(15, 23, 42, 0.1);
  }
}

.reader-hint {
  position: absolute;
  left: 50%;
  bottom: 14px;
  z-index: 2;
  margin: 0;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  transform: translateX(-50%);
  pointer-events: none;
  opacity: 0.9;
}

@keyframes paper-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 720px) {
  .reader-toolbar {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'left right'
      'center center';
    padding: 8px 10px;
    gap: 8px;
  }

  .toolbar-left {
    grid-area: left;
  }

  .toolbar-right {
    grid-area: right;
  }

  .toolbar-center {
    grid-area: center;
    justify-self: center;
  }

  .doc-title {
    max-width: 48vw;
  }

  .reader-stage {
    padding: 16px 10px 36px;
  }

  .reader-hint {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .resume-reader,
  .reader-shell,
  .paper-stack {
    transition: none !important;
    animation: none !important;
  }
}

@media print {
  .reader-toolbar,
  .reader-custom-header,
  .reader-hint {
    display: none !important;
  }

  .resume-reader,
  .reader-shell,
  .reader-stage {
    background: #fff !important;
    overflow: visible !important;
  }

  .paper-stack {
    width: 100% !important;
  }
}
</style>
