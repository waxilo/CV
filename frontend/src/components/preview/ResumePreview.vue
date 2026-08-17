<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { IResumeData } from '/@/types/resume';
import type { ITemplateConfig } from '/@/types/template';
import { resolveResumeTemplateConfig } from '/@/features/template-renderer';
import { useTemplateStore } from '/@/stores/template';
import PaperThumb from './PaperThumb.vue';

const props = defineProps<{
  data: IResumeData;
  /** 直接传入配置时优先使用（设计器预览） */
  config?: ITemplateConfig | unknown;
}>();

const templateStore = useTemplateStore();
const resolvedConfig = ref<ITemplateConfig | null>(null);

const templateId = computed(() => props.data.metadata.templateId);

/**
 * 解析要用哪份模板配置。
 *
 * 顺序：显式传入 → 简历模板快照（metadata.templateConfig，完全固化）
 * → store 列表 → 详情接口 → 同名内置模板 → 默认模板。
 * 内置模板已经是 v2 HTML 模板，所以不再需要 v1 时代的 Vue 组件回退路径。
 */
async function resolveConfig() {
  resolvedConfig.value = await resolveResumeTemplateConfig(props.data, templateStore, props.config);
}

onMounted(resolveConfig);
watch([templateId, () => props.config, () => props.data.metadata?.templateConfig], resolveConfig);
</script>

<template>
  <div class="resume-preview">
    <PaperThumb
      v-if="resolvedConfig"
      :data="data"
      :config="resolvedConfig"
      :fallback-scale="0.72"
      show-all-pages
      page-layout="vertical"
    />
  </div>
</template>

<style scoped lang="scss">
.resume-preview {
  width: min(100%, 760px);
  margin: 0 auto;
}
</style>
