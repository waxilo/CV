<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useResumeStore } from '/@/stores/resume';
import { useTemplateStore } from '/@/stores/template';
import {
  migrateTemplateConfig,
  createDefaultTemplateConfig,
  compileTemplateHtml,
} from '/@/features/template-renderer';

const route = useRoute();
const resumeStore = useResumeStore();
const templateStore = useTemplateStore();
const html = ref('');
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
  const config = found
    ? migrateTemplateConfig(found.config)
    : createDefaultTemplateConfig('single-column', {
        primaryColor: resumeStore.data.metadata.theme.primaryColor,
        fontFamily: resumeStore.data.metadata.theme.fontFamily,
        fontSize: resumeStore.data.metadata.theme.fontSize,
        spacing: resumeStore.data.metadata.theme.spacing,
      });

  html.value = compileTemplateHtml(config, resumeStore.data);
  ready.value = true;

  requestAnimationFrame(() => {
    setTimeout(() => window.print(), 350);
  });
});
</script>

<template>
  <div class="print-page">
    <!-- 打印页直接挂载静态 HTML，避免 iframe 打印兼容问题；内容已清洗且无脚本 -->
    <div v-if="ready" class="sheet" v-html="html" />
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
.sheet {
  width: 210mm;
}
@media print {
  .print-page {
    padding: 0;
  }
}
</style>
