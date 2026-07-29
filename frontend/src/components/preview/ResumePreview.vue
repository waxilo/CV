<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { IResumeData } from '/@/types/resume';
import type { ITemplateConfig } from '/@/types/template';
import { normalizeTemplateConfig } from '/@/features/template-renderer';
import { getBuiltinTemplate } from '@cv/template-schema';
import { useTemplateStore } from '/@/stores/template';
import SecureResumeFrame from './SecureResumeFrame.vue';

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
 * 顺序：显式传入 → store 列表 → 详情接口 → 同名内置模板 → 默认模板。
 * 内置模板已经是 v2 HTML 模板，所以不再需要 v1 时代的 Vue 组件回退路径。
 */
async function resolveConfig() {
  if (props.config) {
    resolvedConfig.value = normalizeTemplateConfig(props.config);
    return;
  }

  if (!templateStore.list.length) {
    await templateStore.fetchList();
  }

  const found = templateStore.getById(templateId.value);
  if (found) {
    resolvedConfig.value = normalizeTemplateConfig(found.config);
    return;
  }

  try {
    const detail = await templateStore.loadDetail(templateId.value);
    if (detail) {
      resolvedConfig.value = normalizeTemplateConfig(detail.config);
      return;
    }
  } catch {
    // 接口不可用时继续走本地兜底
  }

  const builtin = getBuiltinTemplate(templateId.value);
  resolvedConfig.value = normalizeTemplateConfig(
    builtin ? builtin.config : getBuiltinTemplate('minimal')?.config
  );
}

onMounted(resolveConfig);
watch([templateId, () => props.config], resolveConfig);
</script>

<template>
  <div class="resume-preview">
    <SecureResumeFrame v-if="resolvedConfig" :data="data" :config="resolvedConfig" />
  </div>
</template>

<style scoped lang="scss">
.resume-preview {
  display: flex;
  justify-content: center;
}
</style>
