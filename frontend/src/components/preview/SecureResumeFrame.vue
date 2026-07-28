<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { IResumeData } from '/@/types/resume';
import type { ITemplateConfig } from '/@/types/template';
import { compileTemplateDocument } from '/@/features/template-renderer';

const props = withDefaults(
  defineProps<{
    data: IResumeData;
    config: ITemplateConfig | unknown;
    scale?: number;
  }>(),
  { scale: 1 }
);

const iframeRef = ref<HTMLIFrameElement | null>(null);
const srcdoc = computed(() => compileTemplateDocument(props.config, props.data));

watch(srcdoc, () => {
  // force reload for some browsers when only style changes
  if (iframeRef.value) {
    iframeRef.value.srcdoc = srcdoc.value;
  }
});
</script>

<template>
  <div class="secure-preview" :style="{ transform: `scale(${scale})`, transformOrigin: 'top center' }">
    <iframe
      ref="iframeRef"
      class="frame"
      title="resume-preview"
      sandbox=""
      :srcdoc="srcdoc"
    />
  </div>
</template>

<style scoped lang="scss">
.secure-preview {
  width: 210mm;
}

.frame {
  width: 210mm;
  min-height: 297mm;
  border: none;
  background: #fff;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.12);
  display: block;
}

@media print {
  .secure-preview {
    transform: none !important;
  }
  .frame {
    box-shadow: none;
    width: 100%;
    min-height: auto;
  }
}
</style>
