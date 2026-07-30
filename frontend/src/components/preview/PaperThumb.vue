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
  }>(),
  { fallbackScale: 0.26 }
);

/** CSS 里 1mm 恒等于 96/25.4px，A4 宽 210mm 换算成整页的像素宽度 */
const A4_WIDTH_PX = (210 * 96) / 25.4;

const rootRef = ref<HTMLElement | null>(null);
const measuredWidth = ref(0);
let observer: ResizeObserver | null = null;

/** 缩略图跟随纸张实际宽度等比缩放，不依赖固定像素尺寸裁切 */
const scale = computed(() =>
  measuredWidth.value > 0 ? measuredWidth.value / A4_WIDTH_PX : props.fallbackScale
);

function measure(width: number) {
  if (Math.abs(width - measuredWidth.value) > 0.5) measuredWidth.value = width;
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
  <div ref="rootRef" class="cv-paper">
    <div class="cv-paper-inner">
      <SecureResumeFrame :data="data" :config="config" :scale="scale" />
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
