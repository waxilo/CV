<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useTemplateStore } from '/@/stores/template';
import { useResumeStore } from '/@/stores/resume';
import type { ITemplate } from '/@/types/template';

const router = useRouter();
const templateStore = useTemplateStore();
const resumeStore = useResumeStore();

onMounted(() => {
  if (!templateStore.list.length) templateStore.fetchList();
});

function selectTemplate(tpl: ITemplate) {
  // setTemplate 会清空 templateVars，让新模板声明的变量默认值生效。
  // 这里不再同步写 metadata.theme 的字体字号，否则会把旧模板的调参带到新模板上。
  resumeStore.setTemplate(tpl.template_id, tpl.config.primaryColor);
  ElMessage.success(`已切换到「${tpl.name}」`);
}

function openCenter() {
  router.push('/templates');
}
</script>

<template>
  <div v-loading="templateStore.isLoading" class="template-picker">
    <div class="head">
      <el-button size="small" @click="openCenter">模板中心</el-button>
    </div>

    <div class="grid">
      <button
        v-for="tpl in templateStore.list"
        :key="tpl.template_id"
        type="button"
        class="tpl"
        :class="{ active: resumeStore.data?.metadata.templateId === tpl.template_id }"
        @click="selectTemplate(tpl)"
      >
        <div class="swatch" :style="{ background: tpl.config.primaryColor }" />
        <div class="info">
          <strong>{{ tpl.name }}</strong>
          <span>{{ tpl.description || tpl.config.layout }}</span>
          <el-tag v-if="!tpl.is_builtin" size="small" type="success">自定义</el-tag>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.head {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 12px;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tpl {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--cv-border);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;

  &.active {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .swatch {
    width: 40px;
    height: 56px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 4px;

    strong {
      font-size: 14px;
    }

    span {
      font-size: 12px;
      color: var(--cv-muted);
    }
  }
}
</style>
