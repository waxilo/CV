<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import SecureResumeFrame from '/@/components/preview/SecureResumeFrame.vue';
import type { IResumeData } from '/@/types/resume';

const props = withDefaults(
  defineProps<{
    data: IResumeData;
    config: unknown;
    /** 测量完成前的兜底缩放比，避免首帧闪出原始尺寸的整页 */
    fallbackScale?: number;
    /** 是否展示超长内容产生的全部 A4 页面 */
    showAllPages?: boolean;
    /**
     * 多页预览方式：
     * - vertical：纵向按页堆叠，每页保留模板上下边距
     * - flip：每次只展示一页，由外部控制翻页
     */
    pageLayout?: 'vertical' | 'flip';
    /** flip 模式下当前页（从 0 开始） */
    pageIndex?: number;
    /**
     * 首次量到有效宽度后锁定缩放。
     * 分享页等场景避免手机捏合缩放触发 ResizeObserver 反复改 scale，造成「布局跟着变」。
     */
    freezeScale?: boolean;
  }>(),
  {
    fallbackScale: 0.26,
    showAllPages: false,
    pageLayout: 'vertical',
    pageIndex: 0,
    freezeScale: false,
  }
);

const emit = defineEmits<{
  (e: 'page-count', value: number): void;
}>();

/** CSS 里 1mm 恒等于 96/25.4px，A4 宽 210mm 换算成整页的像素宽度 */
const A4_WIDTH_PX = (210 * 96) / 25.4;

const rootRef = ref<HTMLElement | null>(null);
const measuredWidth = ref(0);
const pageCount = ref(1);
const isScaleFrozen = ref(false);
let observer: ResizeObserver | null = null;

const isFlip = computed(() => props.showAllPages && props.pageLayout === 'flip');
const isStacked = computed(() => props.showAllPages && props.pageLayout === 'vertical');
const activePageIndex = computed(() =>
  Math.min(Math.max(0, props.pageIndex), Math.max(0, pageCount.value - 1))
);
const pageIndexes = computed(() =>
  Array.from({ length: Math.max(1, pageCount.value) }, (_, index) => index)
);

/** 缩略图跟随纸张实际宽度等比缩放，不依赖固定像素尺寸裁切 */
const scale = computed(() =>
  measuredWidth.value > 0 ? measuredWidth.value / A4_WIDTH_PX : props.fallbackScale
);
const paperStyle = computed(() => {
  if (isStacked.value) return undefined;
  return {
    aspectRatio: isFlip.value ? '210 / 297' : '210 / 297',
  };
});

/** 浏览器捏合缩放时不应改写布局缩放，否则会与视觉缩放叠加并像在改排版 */
function isBrowserZooming(): boolean {
  const viewport = window.visualViewport;
  if (!viewport) return false;
  return Math.abs(viewport.scale - 1) > 0.02;
}

function measure(width: number) {
  if (width <= 0) return;
  if (props.freezeScale && isScaleFrozen.value) return;
  if (isBrowserZooming()) return;
  if (Math.abs(width - measuredWidth.value) > 0.5) {
    measuredWidth.value = width;
    if (props.freezeScale) isScaleFrozen.value = true;
  }
}

function handlePageCount(value: number): void {
  pageCount.value = Math.max(1, value);
  emit('page-count', pageCount.value);
}

function handleOrientationChange(): void {
  // 横竖屏切换后允许重新量一次
  if (!props.freezeScale) return;
  isScaleFrozen.value = false;
  requestAnimationFrame(() => {
    if (rootRef.value) measure(rootRef.value.clientWidth);
  });
}

onMounted(() => {
  if (!rootRef.value) return;
  measure(rootRef.value.clientWidth);
  if (typeof ResizeObserver === 'undefined') return;
  observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) measure(entry.contentRect.width);
  });
  observer.observe(rootRef.value);
  window.addEventListener('orientationchange', handleOrientationChange);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  window.removeEventListener('orientationchange', handleOrientationChange);
});
</script>

<template>
  <div
    ref="rootRef"
    class="cv-paper"
    :class="{ stacked: isStacked }"
    :style="paperStyle"
  >
    <template v-if="isStacked">
      <div v-for="index in pageIndexes" :key="index" class="cv-page-slice">
        <div class="cv-paper-inner">
          <SecureResumeFrame
            :data="data"
            :config="config"
            :scale="scale"
            :page-index="index"
            clip-to-page
            @page-count="handlePageCount"
          />
        </div>
      </div>
    </template>
    <div v-else class="cv-paper-inner">
      <SecureResumeFrame
        :data="data"
        :config="config"
        :scale="scale"
        :page-index="isFlip ? activePageIndex : 0"
        :clip-to-page="isFlip"
        @page-count="handlePageCount"
      />
    </div>
    <slot />
  </div>
</template>

<style scoped lang="scss">
/* 真实 A4 比例的白色纸张，卡片本体就是这张纸 */
.cv-paper {
  position: relative;
  width: 100%;
  aspect-ratio: 210 / 297;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transform: translateY(0);
  transition:
    transform 250ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 250ms cubic-bezier(0.22, 1, 0.36, 1);

  &.stacked {
    aspect-ratio: auto;
    height: auto;
    overflow: visible;
    background: transparent;
    box-shadow: none;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
}

.cv-page-slice {
  width: 100%;
  aspect-ratio: 210 / 297;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.cv-paper-inner {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;

  /* iframe 按整页宽度排版，先居中再靠 scale 收进纸张 */
  :deep(.secure-preview) {
    flex: none;
  }

  /* 投影交给外层纸张，避免缩略图内部再出现一层边 */
  :deep(.frame) {
    box-shadow: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cv-paper {
    transition: none;
  }
}
</style>
