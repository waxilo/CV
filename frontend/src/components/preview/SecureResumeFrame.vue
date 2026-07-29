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
  }>(),
  { scale: 1 }
);

const emit = defineEmits<{
  (e: 'errors', value: string[]): void;
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);

const result = computed(() => renderTemplate(props.config, props.data));
const srcdoc = computed(() => resultToDocument(result.value));

/** 页面实际尺寸由模板的 page 配置决定，不再硬编码 A4 */
const pageSize = computed(() => ({
  width: `${result.value.context.page.widthMm}mm`,
  minHeight: `${result.value.context.page.heightMm}mm`,
}));

watch(
  srcdoc,
  () => {
    // 部分浏览器在仅样式变化时不会重新解析 srcdoc，这里强制赋值
    if (iframeRef.value) iframeRef.value.srcdoc = srcdoc.value;
  },
  { flush: 'post' }
);

watch(
  () => result.value.errors,
  (errors) => emit('errors', errors),
  { immediate: true, deep: true }
);
</script>

<template>
  <div
    class="secure-preview"
    :style="{ width: pageSize.width, transform: `scale(${scale})`, transformOrigin: 'top center' }"
  >
    <iframe
      ref="iframeRef"
      class="frame"
      title="resume-preview"
      sandbox=""
      :style="{ width: pageSize.width, minHeight: pageSize.minHeight }"
      :srcdoc="srcdoc"
    />
  </div>
</template>

<style scoped lang="scss">
.frame {
  border: none;
  background: #fff;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.12);
  display: block;
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
