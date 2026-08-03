<script setup lang="ts">
import { useResumeStore } from '/@/stores/resume';

const resumeStore = useResumeStore();
</script>

<template>
  <div v-if="resumeStore.data" class="basics-form">
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
          placeholder="3年 Java 后端开发经验 | 金融业务系统 | 高并发分布式系统"
          @update:model-value="(v: string) => resumeStore.updateBasics({ headline: v })"
        />
      </el-form-item>
      <div class="row row-3">
        <el-form-item label="性别">
          <el-select
            :model-value="resumeStore.data.basics.gender || ''"
            clearable
            placeholder="选填"
            @update:model-value="(v: string) => resumeStore.updateBasics({ gender: v || '' })"
          >
            <el-option label="男" value="男" />
            <el-option label="女" value="女" />
          </el-select>
        </el-form-item>
        <el-form-item label="年龄">
          <el-input
            :model-value="resumeStore.data.basics.age || ''"
            placeholder="24"
            @update:model-value="(v: string) => resumeStore.updateBasics({ age: v })"
          />
        </el-form-item>
        <el-form-item label="工作年限">
          <el-input
            :model-value="resumeStore.data.basics.workYears || ''"
            placeholder="3年"
            @update:model-value="(v: string) => resumeStore.updateBasics({ workYears: v })"
          />
        </el-form-item>
      </div>
      <div class="row">
        <el-form-item label="出生日期">
          <el-input
            :model-value="resumeStore.data.basics.birthDate || ''"
            placeholder="2000.01.15"
            @update:model-value="(v: string) => resumeStore.updateBasics({ birthDate: v })"
          />
        </el-form-item>
        <el-form-item label="毕业日期">
          <el-input
            :model-value="resumeStore.data.basics.graduationDate || ''"
            placeholder="2023.06"
            @update:model-value="(v: string) => resumeStore.updateBasics({ graduationDate: v })"
          />
        </el-form-item>
      </div>
      <div class="row">
        <el-form-item label="电话">
          <el-input
            :model-value="resumeStore.data.basics.phone"
            @update:model-value="(v: string) => resumeStore.updateBasics({ phone: v })"
          />
        </el-form-item>
        <el-form-item label="微信">
          <el-input
            :model-value="resumeStore.data.basics.wechat || ''"
            placeholder="微信号"
            @update:model-value="(v: string) => resumeStore.updateBasics({ wechat: v })"
          />
        </el-form-item>
      </div>
      <div class="row">
        <el-form-item label="邮箱">
          <el-input
            :model-value="resumeStore.data.basics.email"
            @update:model-value="(v: string) => resumeStore.updateBasics({ email: v })"
          />
        </el-form-item>
        <el-form-item label="所在地">
          <el-input
            :model-value="resumeStore.data.basics.location"
            @update:model-value="(v: string) => resumeStore.updateBasics({ location: v })"
          />
        </el-form-item>
      </div>
      <el-form-item label="个人网站">
        <el-input
          :model-value="resumeStore.data.basics.url"
          @update:model-value="(v: string) => resumeStore.updateBasics({ url: v })"
        />
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.row-3 {
  grid-template-columns: 1fr 1fr 1fr;
}
</style>
