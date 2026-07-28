<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { IResumeData } from '/@/types/resume';
import type { ITemplateConfig } from '/@/types/template';
import { migrateTemplateConfig, createDefaultTemplateConfig } from '/@/features/template-renderer';
import { useTemplateStore } from '/@/stores/template';
import SecureResumeFrame from './SecureResumeFrame.vue';
import ModernTemplate from '/@/templates/ModernTemplate.vue';
import ClassicTemplate from '/@/templates/ClassicTemplate.vue';
import MinimalTemplate from '/@/templates/MinimalTemplate.vue';

const props = defineProps<{
  data: IResumeData;
  /** 直接传入配置时优先使用（设计器预览） */
  config?: ITemplateConfig | unknown;
}>();

const templateStore = useTemplateStore();
const resolvedConfig = ref<ITemplateConfig | null>(null);
const useLegacy = ref(false);

const legacyMap: Record<string, unknown> = {
  modern: ModernTemplate,
  classic: ClassicTemplate,
  minimal: MinimalTemplate,
};

const templateId = computed(() => props.data.metadata.templateId);

async function resolveConfig() {
  if (props.config) {
    resolvedConfig.value = migrateTemplateConfig(props.config);
    useLegacy.value = false;
    return;
  }

  if (!templateStore.list.length) {
    await templateStore.fetchList();
  }

  const found = templateStore.getById(templateId.value);
  if (found) {
    resolvedConfig.value = migrateTemplateConfig(found.config);
    useLegacy.value = false;
    return;
  }

  // 未知模板：尝试详情；失败则回退内置 Vue 组件
  try {
    const detail = await templateStore.loadDetail(templateId.value);
    if (detail) {
      resolvedConfig.value = migrateTemplateConfig(detail.config);
      useLegacy.value = false;
      return;
    }
  } catch {
    // ignore
  }

  if (legacyMap[templateId.value]) {
    useLegacy.value = true;
    resolvedConfig.value = null;
  } else {
    useLegacy.value = false;
    resolvedConfig.value = createDefaultTemplateConfig('single-column', {
      primaryColor: props.data.metadata.theme.primaryColor,
      fontFamily: props.data.metadata.theme.fontFamily,
      fontSize: props.data.metadata.theme.fontSize,
      spacing: props.data.metadata.theme.spacing,
    });
  }
}

onMounted(resolveConfig);
watch([templateId, () => props.config], resolveConfig);
</script>

<template>
  <div class="resume-preview">
    <SecureResumeFrame
      v-if="resolvedConfig && !useLegacy"
      :data="data"
      :config="resolvedConfig"
    />
    <component
      v-else-if="useLegacy"
      :is="legacyMap[templateId] || ModernTemplate"
      :data="data"
      class="resume-sheet"
    />
  </div>
</template>

<style scoped lang="scss">
.resume-sheet {
  width: 210mm;
  min-height: 297mm;
  background: #fff;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.12);
  transform-origin: top center;
}

@media print {
  .resume-sheet {
    box-shadow: none;
    width: 100%;
    min-height: auto;
  }
}
</style>
