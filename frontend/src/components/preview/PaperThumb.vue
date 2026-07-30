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
  }>(),
  { fallbackScale: 0.26, showAllPages: false, pageLayout: 'vertical', pageIndex: 0 }
);

const emit = defineEmits<{
  (e: 'page-count', value: number): void;
}>();

/** CSS 里 1mm 恒等于 96/25.4px，A4 宽 210mm 换算成整页的像素宽度 */
const A4_WIDTH_PX = (210 * 96) / 25.4;

const rootRef = ref<HTMLElement | null>(null);
const measuredWidth = ref(0);
const pageCount = ref(1);
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

function measure(width: number) {
  if (Math.abs(width - measuredWidth.value) > 0.5) measuredWidth.value = width;
}

function handlePageCount(value: number): void {
  pageCount.value = Math.max(1, value);
  emit('page-count', pageCount.value);
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
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
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
