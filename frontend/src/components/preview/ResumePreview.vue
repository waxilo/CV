<script setup lang="ts">
import { computed } from 'vue';
import type { IResumeData } from '/@/types/resume';
import ModernTemplate from '/@/templates/ModernTemplate.vue';
import ClassicTemplate from '/@/templates/ClassicTemplate.vue';
import MinimalTemplate from '/@/templates/MinimalTemplate.vue';

const props = defineProps<{
  data: IResumeData;
}>();

const templateId = computed(() => props.data.metadata.templateId);

const componentMap: Record<string, unknown> = {
  modern: ModernTemplate,
  classic: ClassicTemplate,
  minimal: MinimalTemplate,
};

const activeComponent = computed(() => {
  return componentMap[templateId.value] || ModernTemplate;
});
</script>

<template>
  <component :is="activeComponent" :data="data" class="resume-sheet" />
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
