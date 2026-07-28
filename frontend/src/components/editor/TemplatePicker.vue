<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { listTemplatesApi, createTemplateApi } from '/@/api/template';
import { useResumeStore } from '/@/stores/resume';
import type { ITemplate } from '/@/types/resume';

const resumeStore = useResumeStore();
const templates = ref<ITemplate[]>([]);
const isLoading = ref(false);
const showCreate = ref(false);
const creating = ref(false);

const newTemplate = ref({
  name: '',
  description: '',
  layout: 'single-column' as const,
  primaryColor: '#0f766e',
  fontFamily: 'Inter',
  fontSize: 14,
  spacing: 1.2,
});

onMounted(loadTemplates);

async function loadTemplates() {
  isLoading.value = true;
  try {
    const res = await listTemplatesApi();
    templates.value = res.data || [];
  } finally {
    isLoading.value = false;
  }
}

function selectTemplate(tpl: ITemplate) {
  resumeStore.setTemplate(tpl.template_id, tpl.config.primaryColor);
  resumeStore.updateTheme({
    primaryColor: tpl.config.primaryColor,
    fontFamily: tpl.config.fontFamily,
    fontSize: tpl.config.fontSize,
    spacing: tpl.config.spacing,
  });
  ElMessage.success(`已切换到「${tpl.name}」`);
}

async function handleCreate() {
  if (!newTemplate.value.name.trim()) {
    ElMessage.warning('请填写模板名称');
    return;
  }
  creating.value = true;
  try {
    const res = await createTemplateApi({
      name: newTemplate.value.name,
      description: newTemplate.value.description,
      config: {
        layout: newTemplate.value.layout,
        primaryColor: newTemplate.value.primaryColor,
        fontFamily: newTemplate.value.fontFamily,
        fontSize: newTemplate.value.fontSize,
        spacing: newTemplate.value.spacing,
      },
    });
    if (res.data) {
      ElMessage.success('自定义模板已创建');
      showCreate.value = false;
      await loadTemplates();
      resumeStore.setTemplate(res.data.template_id, newTemplate.value.primaryColor);
    }
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div v-loading="isLoading" class="template-picker">
    <div class="head">
      <h3>选择模板</h3>
      <el-button size="small" @click="showCreate = !showCreate">
        {{ showCreate ? '取消' : '扩展模板' }}
      </el-button>
    </div>

    <div v-if="showCreate" class="create-box">
      <el-form label-position="top" size="small">
        <el-form-item label="名称">
          <el-input v-model="newTemplate.name" placeholder="我的模板" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newTemplate.description" />
        </el-form-item>
        <el-form-item label="主色">
          <el-color-picker v-model="newTemplate.primaryColor" />
        </el-form-item>
        <el-form-item label="布局">
          <el-select v-model="newTemplate.layout">
            <el-option label="单栏" value="single-column" />
            <el-option label="左栏" value="sidebar-left" />
            <el-option label="右栏" value="sidebar-right" />
            <el-option label="双栏" value="two-column" />
          </el-select>
        </el-form-item>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建并应用</el-button>
      </el-form>
    </div>

    <div class="grid">
      <button
        v-for="tpl in templates"
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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  h3 {
    font-size: 14px;
    color: var(--cv-muted);
  }
}

.create-box {
  border: 1px dashed var(--cv-border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background: #f8fafc;
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
