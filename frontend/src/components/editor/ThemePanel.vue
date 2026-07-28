<script setup lang="ts">
import { useResumeStore } from '/@/stores/resume';

const resumeStore = useResumeStore();
</script>

<template>
  <div v-if="resumeStore.data" class="theme-panel">
    <h3>主题设置</h3>
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
      <el-form-item label="字体">
        <el-select
          :model-value="resumeStore.data.metadata.theme.fontFamily"
          @update:model-value="(v: string) => resumeStore.updateTheme({ fontFamily: v })"
        >
          <el-option label="Inter" value="Inter" />
          <el-option label="Georgia" value="Georgia" />
          <el-option label="Helvetica" value="Helvetica" />
          <el-option label="PingFang SC" value="PingFang SC" />
          <el-option label="Source Han Sans" value="Source Han Sans SC" />
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
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.theme-panel {
  h3 {
    font-size: 14px;
    color: var(--cv-muted);
    margin-bottom: 12px;
  }
}
</style>
