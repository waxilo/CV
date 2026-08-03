<script setup lang="ts">
import { computed } from 'vue';
import { DEFAULT_HEADING_FONT_FAMILY, TEMPLATE_FONT_OPTIONS } from '@cv/template-schema';
import { useResumeStore } from '/@/stores/resume';

const resumeStore = useResumeStore();

const fontOptions = TEMPLATE_FONT_OPTIONS;

/** 未覆写时与模板默认页边距一致（16mm） */
const DEFAULT_PAGE_MARGIN_MM = 16;

const headingFontFamily = computed(() => {
  const value = resumeStore.data?.metadata.templateVars?.headingFontFamily;
  return typeof value === 'string' && value.trim() ? value : DEFAULT_HEADING_FONT_FAMILY;
});

const pageMargin = computed(() => {
  const value = resumeStore.data?.metadata.page?.margin;
  return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_PAGE_MARGIN_MM;
});

function updateHeadingFont(value: string) {
  resumeStore.updateTemplateVar('headingFontFamily', value);
}

function updatePageMargin(value: number | number[]) {
  const next = Array.isArray(value) ? value[0] : value;
  resumeStore.updatePageMargin(next);
}
</script>

<template>
  <div v-if="resumeStore.data" class="theme-panel">
    <el-form label-position="top" size="small">
      <el-form-item label="主色">
        <el-color-picker
          :model-value="resumeStore.data.metadata.theme.primaryColor"
          @update:model-value="(v: string | null) => v && resumeStore.updateTheme({ primaryColor: v })"
        />
      </el-form-item>
      <el-form-item label="文字色">
        <el-color-picker
          :model-value="resumeStore.data.metadata.theme.textColor"
          @update:model-value="(v: string | null) => v && resumeStore.updateTheme({ textColor: v })"
        />
      </el-form-item>
      <el-form-item label="正文字体">
        <el-select
          :model-value="resumeStore.data.metadata.theme.fontFamily"
          @update:model-value="(v: string) => resumeStore.updateTheme({ fontFamily: v })"
        >
          <el-option v-for="opt in fontOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="标题字体">
        <el-select :model-value="headingFontFamily" @update:model-value="updateHeadingFont">
          <el-option v-for="opt in fontOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="字号">
        <el-slider
          :model-value="resumeStore.data.metadata.theme.fontSize"
          :min="11"
          :max="16"
          :step="1"
          show-stops
          @update:model-value="(v: number | number[]) => resumeStore.updateTheme({ fontSize: Array.isArray(v) ? v[0] : v })"
        />
      </el-form-item>
      <el-form-item label="行距">
        <el-slider
          :model-value="resumeStore.data.metadata.theme.spacing"
          :min="1"
          :max="1.8"
          :step="0.05"
          @update:model-value="(v: number | number[]) => resumeStore.updateTheme({ spacing: Array.isArray(v) ? v[0] : v })"
        />
      </el-form-item>
      <el-form-item :label="`页边距（${pageMargin} mm）`">
        <el-slider
          :model-value="pageMargin"
          :min="0"
          :max="40"
          :step="1"
          show-stops
          @update:model-value="updatePageMargin"
        />
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.theme-panel {
  :deep(.el-form-item__label) {
    color: var(--cv-muted);
  }
}
</style>
