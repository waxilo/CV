<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getBuiltinTemplate, type ITemplate, type ITemplateConfig } from '/@/types/template';
import { useUserStore } from '/@/stores/user';
import { useResumeStore } from '/@/stores/resume';
import { useTemplateStore } from '/@/stores/template';
import { migrateTemplateConfig } from '/@/features/template-renderer';
import SecureResumeFrame from '/@/components/preview/SecureResumeFrame.vue';
import type { IResumeSummary } from '/@/types/resume';

const router = useRouter();
const userStore = useUserStore();
const resumeStore = useResumeStore();
const templateStore = useTemplateStore();
const isCreating = ref(false);
const showCreateDialog = ref(false);
const createTitle = ref('我的简历');
const selectedTemplateId = ref('modern');

onMounted(async () => {
  await Promise.all([resumeStore.fetchList(), templateStore.fetchList()]);
  if (templateStore.list.length) {
    selectedTemplateId.value = templateStore.list[0].template_id;
  }
});

function openCreateDialog() {
  createTitle.value = '我的简历';
  if (templateStore.list.length) {
    selectedTemplateId.value = templateStore.list[0].template_id;
  }
  showCreateDialog.value = true;
}

async function handleCreate() {
  if (!selectedTemplateId.value) {
    ElMessage.warning('请选择模板');
    return;
  }
  isCreating.value = true;
  try {
    const id = await resumeStore.createResume(createTitle.value.trim() || '我的简历', selectedTemplateId.value);
    if (id) {
      ElMessage.success('创建成功');
      showCreateDialog.value = false;
      router.push(`/editor/${id}`);
    }
  } finally {
    isCreating.value = false;
  }
}

function openEditor(id: string) {
  router.push(`/editor/${id}`);
}

async function handleDelete(id: string, title: string) {
  await ElMessageBox.confirm(`确定删除「${title}」？此操作不可恢复。`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  });
  await resumeStore.removeResume(id);
  ElMessage.success('已删除');
}

function handleLogout() {
  userStore.logout();
  router.replace('/login');
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('zh-CN');
  } catch {
    return value;
  }
}

function templateName(id: string) {
  return templateStore.getById(id)?.name || id;
}

function selectTpl(tpl: ITemplate) {
  selectedTemplateId.value = tpl.template_id;
}

/** 解析简历卡片缩略图用的模板配置 */
function resumeThumbConfig(item: IResumeSummary): ITemplateConfig {
  const templateId = item.template_id || item.data?.metadata?.templateId || 'minimal';
  const found = templateStore.getById(templateId);
  if (found) return found.config;

  const builtin = getBuiltinTemplate(templateId) || getBuiltinTemplate('minimal');
  return migrateTemplateConfig(builtin?.config);
}
</script>

<template>
  <div class="dashboard">
    <header class="topbar no-print">
      <div class="brand">
        <span class="mark">CV</span>
        <strong>CV Builder</strong>
      </div>
      <div class="actions">
        <el-button text @click="router.push('/templates')">模板中心</el-button>
        <span class="user">{{ userStore.displayName }}</span>
        <el-button text @click="handleLogout">退出</el-button>
      </div>
    </header>

    <main class="content">
      <div class="section-head">
        <div>
          <h1>我的简历</h1>
          <p>创建、编辑、切换模板，支持模块拖拽排序与可视化模板设计</p>
        </div>
        <div class="head-actions">
          <el-button @click="router.push('/templates')">浏览模板</el-button>
          <el-button type="primary" :loading="isCreating" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新建简历
          </el-button>
        </div>
      </div>

      <div v-loading="resumeStore.isLoading" class="grid">
        <button class="card create" type="button" @click="openCreateDialog">
          <el-icon :size="28"><Plus /></el-icon>
          <span>新建简历</span>
        </button>

        <article
          v-for="item in resumeStore.list"
          :key="item.resume_id"
          class="card resume"
          @click="openEditor(item.resume_id)"
        >
          <div class="thumb">
            <SecureResumeFrame
              v-if="item.data"
              :data="item.data"
              :config="resumeThumbConfig(item)"
              :scale="0.28"
            />
          </div>
          <div class="body">
            <div class="card-top">
              <h3>{{ item.title }}</h3>
              <el-tag size="small" effect="plain">{{ templateName(item.template_id) }}</el-tag>
            </div>
            <p class="meta">更新于 {{ formatDate(item.updated_at) }}</p>
            <div class="card-actions" @click.stop>
              <el-button size="small" type="primary" plain @click="openEditor(item.resume_id)">
                编辑
              </el-button>
              <el-button
                size="small"
                type="danger"
                plain
                @click="handleDelete(item.resume_id, item.title)"
              >
                删除
              </el-button>
            </div>
          </div>
        </article>
      </div>
    </main>

    <el-dialog v-model="showCreateDialog" title="新建简历" width="560px">
      <el-form label-position="top">
        <el-form-item label="简历标题">
          <el-input v-model="createTitle" placeholder="我的简历" />
        </el-form-item>
        <el-form-item label="选择模板">
          <div class="tpl-grid">
            <button
              v-for="tpl in templateStore.list"
              :key="tpl.template_id"
              type="button"
              class="tpl"
              :class="{ active: selectedTemplateId === tpl.template_id }"
              @click="selectTpl(tpl)"
            >
              <div class="swatch" :style="{ background: tpl.config.primaryColor }" />
              <div>
                <strong>{{ tpl.name }}</strong>
                <span>{{ tpl.is_builtin ? '内置' : '自定义' }}</span>
              </div>
            </button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="isCreating" @click="handleCreate">创建并编辑</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  min-height: 100%;
}

.topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--cv-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;

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
  align-items: center;
  gap: 8px;

  .user {
    color: var(--cv-muted);
    font-size: 14px;
  }
}

.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 36px 28px 64px;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;

  h1 {
    font-size: 28px;
    letter-spacing: -0.02em;
    margin-bottom: 6px;
  }

  p {
    color: var(--cv-muted);
    font-size: 14px;
  }
}

.head-actions {
  display: flex;
  gap: 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
  min-height: 160px;
}

.card {
  background: var(--cv-surface);
  border: 1px solid var(--cv-border);
  border-radius: 14px;
  box-shadow: var(--cv-shadow);
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #93c5fd;
    transform: translateY(-2px);
  }

  &.create {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 320px;
    padding: 20px;
    color: var(--cv-muted);
    border-style: dashed;
    background: rgba(255, 255, 255, 0.6);
  }
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

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;

  h3 {
    font-size: 16px;
  }
}

.meta {
  color: var(--cv-muted);
  font-size: 12px;
  margin: 8px 0 14px;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tpl-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-height: 280px;
  overflow: auto;
}

.tpl {
  display: flex;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--cv-border);
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;

  &.active {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .swatch {
    width: 28px;
    height: 40px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  strong {
    display: block;
    font-size: 13px;
  }

  span {
    font-size: 12px;
    color: var(--cv-muted);
  }
}
</style>
