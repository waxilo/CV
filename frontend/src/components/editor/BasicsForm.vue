<script setup lang="ts">
import { useResumeStore } from '/@/stores/resume';

const resumeStore = useResumeStore();
</script>

<template>
  <div v-if="resumeStore.data" class="basics-form">
    <h3>基本信息</h3>
    <el-form label-position="top" size="small">
      <el-form-item label="姓名">
        <el-input
          :model-value="resumeStore.data.basics.name"
          placeholder="张三"
          @update:model-value="(v: string) => resumeStore.updateBasics({ name: v })"
        />
      </el-form-item>
      <el-form-item label="职位方向">
        <el-input
          :model-value="resumeStore.data.basics.headline"
          placeholder="前端工程师"
          @update:model-value="(v: string) => resumeStore.updateBasics({ headline: v })"
        />
      </el-form-item>
      <div class="row">
        <el-form-item label="邮箱">
          <el-input
            :model-value="resumeStore.data.basics.email"
            @update:model-value="(v: string) => resumeStore.updateBasics({ email: v })"
          />
        </el-form-item>
        <el-form-item label="电话">
          <el-input
            :model-value="resumeStore.data.basics.phone"
            @update:model-value="(v: string) => resumeStore.updateBasics({ phone: v })"
          />
        </el-form-item>
      </div>
      <div class="row">
        <el-form-item label="所在地">
          <el-input
            :model-value="resumeStore.data.basics.location"
            @update:model-value="(v: string) => resumeStore.updateBasics({ location: v })"
          />
        </el-form-item>
        <el-form-item label="个人网站">
          <el-input
            :model-value="resumeStore.data.basics.url"
            @update:model-value="(v: string) => resumeStore.updateBasics({ url: v })"
          />
        </el-form-item>
      </div>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.basics-form {
  h3 {
    font-size: 14px;
    margin-bottom: 10px;
    color: var(--cv-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
