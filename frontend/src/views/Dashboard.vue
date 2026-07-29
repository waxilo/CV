<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getBuiltinTemplate, type ITemplate, type ITemplateConfig } from '/@/types/template';
import { useUserStore } from '/@/stores/user';
import { useResumeStore } from '/@/stores/resume';
import { useTemplateStore } from '/@/stores/template';
import { migrateTemplateConfig } from '/@/features/template-renderer';
import { createSampleResumeData } from '/@/features/template-renderer/sampleData';
import SecureResumeFrame from '/@/components/preview/SecureResumeFrame.vue';
import type { IResumeData, IResumeSummary } from '/@/types/resume';

const router = useRouter();
const userStore = useUserStore();
const resumeStore = useResumeStore();
const templateStore = useTemplateStore();
const isCreating = ref(false);
const showCreateDialog = ref(false);
const createTitle = ref('我的简历');
const selectedTemplateId = ref('modern');
const sampleResumeData = createSampleResumeData();
const userInitial = computed(() => userStore.displayName.trim().charAt(0).toUpperCase() || 'U');

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
  try {
    await ElMessageBox.confirm(`删除后将无法恢复「${title}」，确定继续吗？`, '删除这份简历？', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '保留简历',
      customClass: 'dashboard-confirm-dialog',
      closeOnClickModal: false,
    });
  } catch {
    return;
  }
  await resumeStore.removeResume(id);
  ElMessage.success('已删除');
}

function handleLogout() {
  userStore.logout();
  router.replace('/login');
}

function handleUserCommand(command: string) {
  if (command === 'templates') {
    router.push('/templates');
    return;
  }
  if (command === 'logout') handleLogout();
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function templateName(id: string): string {
  return templateStore.getById(id)?.name || id;
}

function selectTpl(tpl: ITemplate): void {
  selectedTemplateId.value = tpl.template_id;
}

function resumePreviewData(item: IResumeSummary): IResumeData {
  const data = item.data;
  const hasBasics = Boolean(data?.basics?.name || data?.basics?.headline);
  const hasSectionContent = data?.sections?.some(
    (section) => Boolean(section.content?.trim()) || section.items.length > 0
  );
  return hasBasics || hasSectionContent ? data : sampleResumeData;
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
      <div class="nav-inner">
        <button class="brand" type="button" aria-label="返回简历首页" @click="router.push('/')">
          <span class="mark">
            <el-icon :size="18"><Document /></el-icon>
          </span>
          <strong>CV Builder</strong>
        </button>

        <div class="nav-actions">
          <button class="nav-link" type="button" @click="router.push('/templates')">
            模板中心
          </button>
          <el-dropdown trigger="click" placement="bottom-end" @command="handleUserCommand">
            <button class="user-menu" type="button">
              <span class="avatar">
                <img
                  v-if="userStore.user?.avatar_url"
                  :src="userStore.user.avatar_url"
                  :alt="userStore.displayName"
                />
                <span v-else>{{ userInitial }}</span>
              </span>
              <span class="user-name">{{ userStore.displayName }}</span>
              <el-icon class="chevron"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="templates">
                  <el-icon><Collection /></el-icon>
                  模板中心
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </header>

    <main class="content">
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">你的职业形象，从这里开始</span>
          <h1>打造你的专业简历</h1>
          <p>创建、编辑和管理你的职业简历，使用精美模板快速生成属于你的简历</p>
        </div>
        <div class="hero-actions">
          <el-button class="primary-action" :loading="isCreating" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新建简历
          </el-button>
          <el-button class="secondary-action" @click="router.push('/templates')">
            <el-icon><Collection /></el-icon>
            浏览模板
          </el-button>
        </div>
      </section>

      <section class="resume-section">
        <div class="section-heading">
          <div>
            <h2>我的简历</h2>
            <span>{{ resumeStore.list.length }} 份简历</span>
          </div>
          <p>最近更新</p>
        </div>

        <div v-loading="resumeStore.isLoading" class="grid">
          <button class="card create-card" type="button" @click="openCreateDialog">
            <span class="create-icon"><el-icon :size="26"><Plus /></el-icon></span>
            <strong>{{ resumeStore.list.length ? '创建新简历' : '创建第一份简历' }}</strong>
            <span>选择模板开始制作</span>
          </button>

          <article
            v-for="(item, index) in resumeStore.list"
            :key="item.resume_id"
            class="card resume-card"
            :style="{ '--card-index': index }"
            @click="openEditor(item.resume_id)"
          >
            <div class="preview-stage">
              <div class="paper-preview">
                <SecureResumeFrame
                  :data="resumePreviewData(item)"
                  :config="resumeThumbConfig(item)"
                  :scale="0.27"
                />
              </div>
            </div>
            <div class="card-body">
              <div class="resume-info">
                <h3>{{ item.title }}</h3>
                <p>{{ templateName(item.template_id) }}</p>
              </div>
              <div class="card-footer" @click.stop>
                <span class="updated-at">更新于 {{ formatDate(item.updated_at) }}</span>
                <div class="card-operations">
                  <el-button class="edit-button" size="small" @click="openEditor(item.resume_id)">
                    编辑
                  </el-button>
                  <el-dropdown trigger="click" placement="bottom-end">
                    <button class="more-button" type="button" aria-label="更多操作">
                      <el-icon><MoreFilled /></el-icon>
                    </button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="handleDelete(item.resume_id, item.title)">
                          <el-icon><Delete /></el-icon>
                          删除简历
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <el-dialog
      v-model="showCreateDialog"
      class="create-dialog"
      title="新建简历"
      width="min(560px, calc(100vw - 32px))"
    >
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
  background:
    radial-gradient(circle at 8% 8%, rgba(99, 102, 241, 0.08), transparent 28rem),
    radial-gradient(circle at 92% 20%, rgba(37, 99, 235, 0.06), transparent 26rem),
    #f8fafc;
}

.topbar {
  height: 64px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  position: sticky;
  top: 0;
  z-index: 20;
}

.nav-inner {
  max-width: 1320px;
  height: 100%;
  margin: 0 auto;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #0f172a;
  cursor: pointer;

  .mark {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: linear-gradient(135deg, #2563eb 0%, #6366f1 100%);
    color: #fff;
    display: grid;
    place-items: center;
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.24);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  strong {
    font-size: 15px;
    font-weight: 750;
    letter-spacing: -0.02em;
  }

  &:hover .mark {
    transform: translateY(-1px) rotate(-2deg);
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
  }
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-link {
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;

  &:hover {
    color: #0f172a;
    background: rgba(241, 245, 249, 0.9);
  }
}

.user-menu {
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  padding: 4px 6px 4px 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;

  &:hover {
    border-color: #e2e8f0;
    background: #fff;
  }

  .chevron {
    color: #94a3b8;
    font-size: 12px;
  }
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: linear-gradient(135deg, #dbeafe, #e0e7ff);
  color: #4338ca;
  font-size: 13px;
  font-weight: 700;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}

.content {
  max-width: 1320px;
  margin: 0 auto;
  padding: 40px 28px 72px;
}

.hero {
  min-height: 232px;
  padding: 40px 44px;
  border: 1px solid rgba(226, 232, 240, 0.85);
  border-radius: 16px;
  background:
    linear-gradient(118deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.94)),
    linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(99, 102, 241, 0.08));
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 36px;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    width: 260px;
    height: 260px;
    border-radius: 50%;
    position: absolute;
    right: -80px;
    top: -110px;
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(99, 102, 241, 0.04));
    filter: blur(2px);
    pointer-events: none;
  }
}

.hero-copy {
  max-width: 690px;
  position: relative;
  z-index: 1;

  .eyebrow {
    display: inline-flex;
    margin-bottom: 14px;
    color: #4f46e5;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  h1 {
    margin: 0 0 12px;
    color: #0f172a;
    font-size: clamp(30px, 3vw, 42px);
    line-height: 1.14;
    letter-spacing: -0.045em;
  }

  p {
    max-width: 620px;
    color: #64748b;
    font-size: 15px;
    line-height: 1.8;
  }
}

.hero-actions {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
  position: relative;
  z-index: 1;

  :deep(.el-button) {
    height: 42px;
    margin: 0;
    padding: 0 18px;
    border-radius: 10px;
    font-weight: 650;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

    &:hover {
      transform: translateY(-2px);
    }
  }

  .primary-action {
    border: 0;
    color: #fff;
    background: linear-gradient(135deg, #2563eb 0%, #6366f1 100%);
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);

    &:hover {
      color: #fff;
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.32);
    }
  }

  .secondary-action {
    border-color: #e2e8f0;
    color: #334155;
    background: rgba(255, 255, 255, 0.86);

    &:hover {
      border-color: #cbd5e1;
      color: #0f172a;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.07);
    }
  }
}

.resume-section {
  margin-top: 36px;
}

.section-heading {
  margin-bottom: 18px;
  display: flex;
  align-items: end;
  justify-content: space-between;

  > div {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  h2 {
    color: #0f172a;
    font-size: 20px;
    letter-spacing: -0.025em;
  }

  span,
  p {
    color: #94a3b8;
    font-size: 12px;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
  min-height: 240px;
}

.card {
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;

  &:hover {
    border-color: #bfdbfe;
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
  }
}

.create-card {
  min-height: 470px;
  padding: 32px;
  border: 1.5px dashed #cbd5e1;
  background:
    radial-gradient(circle at 50% 38%, rgba(219, 234, 254, 0.65), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92));
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;

  .create-icon {
    width: 58px;
    height: 58px;
    margin-bottom: 8px;
    border: 1px solid #dbeafe;
    border-radius: 16px;
    display: grid;
    place-items: center;
    color: #2563eb;
    background: #fff;
    box-shadow: 0 8px 24px rgba(37, 99, 235, 0.12);
    transition: transform 0.25s ease, color 0.25s ease;
  }

  strong {
    color: #0f172a;
    font-size: 16px;
  }

  > span:last-child {
    font-size: 13px;
  }

  &:hover {
    border-color: #60a5fa;
    background:
      radial-gradient(circle at 50% 38%, rgba(219, 234, 254, 0.9), transparent 36%),
      linear-gradient(145deg, #fff, #f8fafc);
  }

  &:hover .create-icon {
    color: #4f46e5;
    transform: scale(1.06) rotate(2deg);
  }
}

.resume-card {
  animation: card-enter 0.5s both;
  animation-delay: calc(var(--card-index, 0) * 60ms);
}

.preview-stage {
  height: 350px;
  overflow: hidden;
  background:
    linear-gradient(rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0.08)),
    #eef2f7;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 18px 16px 0;
  pointer-events: none;
}

.paper-preview {
  width: 222px;
  height: 314px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.resume-card:hover .paper-preview {
  transform: scale(1.03);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16);
}

.card-body {
  padding: 17px 18px 16px;
}

.resume-info {
  min-width: 0;

  h3 {
    overflow: hidden;
    color: #0f172a;
    font-size: 16px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    margin-top: 5px;
    color: #64748b;
    font-size: 12px;
  }
}

.card-footer {
  min-height: 32px;
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.updated-at {
  overflow: hidden;
  color: #94a3b8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-operations {
  display: flex;
  align-items: center;
  gap: 6px;

  :deep(.edit-button) {
    height: 30px;
    margin: 0;
    padding: 0 13px;
    border: 0;
    border-radius: 9px;
    color: #fff;
    background: #2563eb;
    font-weight: 600;
    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.18);

    &:hover {
      color: #fff;
      background: #1d4ed8;
      transform: translateY(-1px);
    }
  }
}

.more-button {
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: #64748b;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;

  &:hover {
    border-color: #e2e8f0;
    color: #0f172a;
    background: #f8fafc;
  }
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
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    border-color: #93c5fd;
    transform: translateY(-1px);
  }

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

:deep(.create-dialog) {
  border-radius: 16px;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);

  .el-dialog__header {
    padding: 22px 24px 14px;
  }

  .el-dialog__title {
    color: #0f172a;
    font-weight: 700;
  }

  .el-dialog__body {
    padding: 12px 24px;
  }

  .el-dialog__footer {
    padding: 14px 24px 22px;
  }

  .el-input__wrapper {
    border-radius: 10px;
  }

  .el-button {
    border-radius: 10px;
  }
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1024px) {
  .hero {
    align-items: flex-start;
    flex-direction: column;
    padding: 36px;
  }

  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .nav-inner {
    padding: 0 16px;
  }

  .nav-link,
  .user-name,
  .chevron {
    display: none;
  }

  .content {
    padding: 24px 16px 48px;
  }

  .hero {
    min-height: 0;
    padding: 28px 22px;
  }

  .hero-copy {
    h1 {
      font-size: 30px;
    }

    p {
      font-size: 14px;
      line-height: 1.7;
    }
  }

  .hero-actions {
    width: 100%;
    flex-direction: column;

    :deep(.el-button) {
      width: 100%;
    }
  }

  .resume-section {
    margin-top: 28px;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .create-card {
    min-height: 280px;
  }

  .preview-stage {
    height: 380px;
  }

  .paper-preview {
    transform: scale(1.08);
    transform-origin: top center;
  }

  .resume-card:hover .paper-preview {
    transform: scale(1.11);
  }
}

@media (prefers-reduced-motion: reduce) {
  .resume-card {
    animation: none;
  }

  .card,
  .paper-preview,
  .hero-actions :deep(.el-button) {
    transition: none;
  }
}
</style>
