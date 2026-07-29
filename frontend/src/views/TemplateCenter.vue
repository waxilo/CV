<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useTemplateStore } from '/@/stores/template';
import { useResumeStore } from '/@/stores/resume';
import { createSampleResumeData } from '/@/features/template-renderer/sampleData';
import { migrateTemplateConfig } from '/@/features/template-renderer';
import SecureResumeFrame from '/@/components/preview/SecureResumeFrame.vue';
import type { ITemplate } from '/@/types/template';

const router = useRouter();
const templateStore = useTemplateStore();
const resumeStore = useResumeStore();
const sampleData = createSampleResumeData();
const creating = ref(false);

const allTemplates = computed(() => templateStore.list);

onMounted(() => {
  templateStore.fetchList();
});

function goCreate() {
  router.push({ name: 'TemplateCreate' });
}

function goEdit(tpl: ITemplate) {
  router.push(`/templates/${tpl.template_id}/edit`);
}

async function handleClone(tpl: ITemplate) {
  const id = await templateStore.cloneTemplate(tpl.template_id);
  if (id) {
    ElMessage.success('已复制为个人模板');
    router.push(`/templates/${id}/edit`);
  }
}

async function handleDelete(tpl: ITemplate) {
  await ElMessageBox.confirm(`确定删除模板「${tpl.name}」？`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  });
  await templateStore.removeTemplate(tpl.template_id);
  ElMessage.success('已删除');
}

async function useTemplate(tpl: ITemplate) {
  creating.value = true;
  try {
    const id = await resumeStore.createResume(`基于「${tpl.name}」的简历`, tpl.template_id);
    if (id) {
      ElMessage.success('已创建简历，开始填充内容');
      router.push(`/editor/${id}`);
    }
  } finally {
    creating.value = false;
  }
}

function goDashboard() {
  router.push('/');
}
</script>

<template>
  <div class="center">
    <header class="topbar">
      <div class="brand" @click="goDashboard">
        <span class="mark">CV</span>
        <strong>模板中心</strong>
      </div>
      <div class="actions">
        <el-button @click="goDashboard">我的简历</el-button>
        <el-button type="primary" @click="goCreate">
          <el-icon><Plus /></el-icon>
          创建模板
        </el-button>
      </div>
    </header>

    <main class="content">
      <div class="section-head">
        <div>
          <h1>模板中心</h1>
          <p>浏览内置与自定义模板，用 HTML/CSS 代码定制布局</p>
        </div>
      </div>

      <div v-loading="templateStore.isLoading" class="grid">
        <article v-for="tpl in allTemplates" :key="tpl.template_id" class="card">
          <div class="thumb">
            <SecureResumeFrame
              :data="sampleData"
              :config="migrateTemplateConfig(tpl.config)"
              :scale="0.28"
            />
          </div>
          <div class="body">
            <div class="title-row">
              <h3>{{ tpl.name }}</h3>
              <el-tag size="small" :type="tpl.is_builtin ? 'info' : 'success'" effect="plain">
                {{ tpl.is_builtin ? '内置' : '自定义' }}
              </el-tag>
            </div>
            <p class="desc">{{ tpl.description || tpl.config.layout }}</p>
            <div class="ops">
              <el-button type="primary" size="small" :loading="creating" @click="useTemplate(tpl)">
                使用此模板
              </el-button>
              <el-button size="small" @click="goEdit(tpl)">
                {{ tpl.is_builtin ? '定制' : '编辑' }}
              </el-button>
              <el-button size="small" @click="handleClone(tpl)">复制</el-button>
              <el-button
                v-if="!tpl.is_builtin"
                size="small"
                type="danger"
                plain
                @click="handleDelete(tpl)"
              >
                删除
              </el-button>
            </div>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.center {
  min-height: 100%;
}
.topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid var(--cv-border);
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  .mark {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: grid;
    place-items: center;
  }
}
.actions {
  display: flex;
  gap: 8px;
}
.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 28px 64px;
}
.section-head {
  margin-bottom: 24px;
  h1 {
    font-size: 28px;
    margin-bottom: 6px;
  }
  p {
    color: var(--cv-muted);
    font-size: 14px;
  }
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}
.card {
  background: #fff;
  border: 1px solid var(--cv-border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--cv-shadow);
}
.thumb {
  height: 220px;
  overflow: hidden;
  background: #e2e8f0;
  display: flex;
  justify-content: center;
  padding-top: 12px;
  pointer-events: none;
}
.body {
  padding: 14px 16px 16px;
}
.title-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
  h3 {
    font-size: 16px;
  }
}
.desc {
  color: var(--cv-muted);
  font-size: 12px;
  margin: 8px 0 14px;
  min-height: 32px;
}
.ops {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
