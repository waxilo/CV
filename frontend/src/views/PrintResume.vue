<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getBuiltinTemplate } from '@cv/template-schema';
import { useResumeStore } from '/@/stores/resume';
import { useTemplateStore } from '/@/stores/template';
import { renderTemplate } from '/@/features/template-renderer';
import { paginateResumeRoot } from '/@/features/template-renderer/paginate';

const route = useRoute();
const resumeStore = useResumeStore();
const templateStore = useTemplateStore();

const html = ref('');
const pageWidth = ref('210mm');
const ready = ref(false);
const sheetRef = ref<HTMLElement | null>(null);

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

  // 与预览同一套 renderTemplate + 智能分页，保证导出 PDF 分页一致
  const result = renderTemplate(rawConfig, resumeStore.data);
  html.value = `${result.body}<style>${result.css}</style>`;
  pageWidth.value = `${result.context.page.widthMm}mm`;
  ready.value = true;

  await nextTick();
  requestAnimationFrame(() => {
    const root = sheetRef.value?.querySelector('.cv-root') as HTMLElement | null;
    if (root) {
      const pageCount = paginateResumeRoot(root, {
        margin: {
          top: result.context.page.margin.top,
          bottom: result.context.page.margin.bottom,
        },
      });
      root.style.minHeight = `${pageCount * 297}mm`;
    }
    setTimeout(() => window.print(), 350);
  });
});
</script>

<template>
  <div class="print-page">
    <!--
      打印页直接挂载静态 HTML，避免 iframe 打印的兼容问题。
      内容已经过白名单清洗且不含脚本，CSS 也已作用域化到 .cv-root。
      挂载后跑与预览相同的 paginateResumeRoot，保证分页一致。
    -->
    <div
      v-if="ready"
      ref="sheetRef"
      class="sheet"
      :style="{ width: pageWidth }"
      v-html="html"
    />
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
