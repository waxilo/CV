<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getBuiltinTemplate } from '@cv/template-schema';
import { useResumeStore } from '/@/stores/resume';
import { useTemplateStore } from '/@/stores/template';
import { renderTemplate } from '/@/features/template-renderer';

const route = useRoute();
const resumeStore = useResumeStore();
const templateStore = useTemplateStore();

const html = ref('');
const pageWidth = ref('210mm');
const ready = ref(false);

onMounted(async () => {
  const id = route.params.resumeId as string;
  await resumeStore.loadResume(id);
  if (!resumeStore.data) return;

  const templateId = resumeStore.data.metadata.templateId;
  if (!templateStore.list.length) await templateStore.fetchList();

  let found = templateStore.getById(templateId);
  if (!found) {
    found = (await templateStore.loadDetail(templateId)) || undefined;
  }

  const rawConfig =
    found?.config ||
    getBuiltinTemplate(templateId)?.config ||
    getBuiltinTemplate('minimal')?.config;

  // 打印走静态快照：产物是零脚本 HTML，两种引擎的输出形态一致
  const result = renderTemplate(rawConfig, resumeStore.data);
  html.value = `${result.body}<style>${result.css}</style>`;
  pageWidth.value = `${result.context.page.widthMm}mm`;
  ready.value = true;

  requestAnimationFrame(() => {
    setTimeout(() => window.print(), 350);
  });
});
</script>

<template>
  <div class="print-page">
    <!--
      打印页直接挂载静态 HTML，避免 iframe 打印的兼容问题。
      内容已经过白名单清洗且不含脚本，CSS 也已作用域化到 .cv-root。
    -->
    <div v-if="ready" class="sheet" :style="{ width: pageWidth }" v-html="html" />
  </div>
</template>

<style scoped lang="scss">
.print-page {
  min-height: 100%;
  display: flex;
  justify-content: center;
  background: #fff;
  padding: 0;
}
@media print {
  .print-page {
    padding: 0;
  }
  .sheet {
    width: 100% !important;
  }
}
</style>
