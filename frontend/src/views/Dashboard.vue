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
import PaperThumb from '/@/components/preview/PaperThumb.vue';
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

async function handleCopy(item: IResumeSummary) {
  const id = await resumeStore.duplicateResume(item.resume_id);
  if (id) ElMessage.success('已复制');
  else ElMessage.error('复制失败');
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
          <button class="create-card" type="button" @click="openCreateDialog">
            <span class="create-icon"><el-icon :size="22"><Plus /></el-icon></span>
            <strong>创建新简历</strong>
            <span class="create-hint">从模板开始制作</span>
          </button>

          <article
            v-for="(item, index) in resumeStore.list"
            :key="item.resume_id"
            class="resume-card"
            :style="{ '--card-index': index }"
            @click="openEditor(item.resume_id)"
          >
            <PaperThumb :data="resumePreviewData(item)" :config="resumeThumbConfig(item)">
              <div class="paper-actions" @click.stop>
                <el-button class="action-button" size="small" @click="handleCopy(item)">
                  复制
                </el-button>
                <el-button
                  class="action-button danger"
                  size="small"
                  @click="handleDelete(item.resume_id, item.title)"
                >
                  删除
                </el-button>
              </div>
            </PaperThumb>

            <div class="card-meta">
              <h3>{{ item.title }}</h3>
              <p class="meta-line">
                <span>{{ templateName(item.template_id) }}</span>
                <span class="dot" aria-hidden="true">·</span>
                <span>更新于 {{ formatDate(item.updated_at) }}</span>
              </p>
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
/* 纸张抬起动画统一缓动 */
$paper-ease: cubic-bezier(0.22, 1, 0.36, 1);

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
  max-width: 1200px;
  margin: 0 auto;
  padding: 44px 24px 88px;
}

/* 页头不再是带边框的大卡片，避免和简历缩略图争夺视觉重心 */
.hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  padding-bottom: 4px;
}

.hero-copy {
  max-width: 640px;

  h1 {
    margin: 0 0 10px;
    color: #0f172a;
    font-size: clamp(26px, 2.4vw, 34px);
    line-height: 1.2;
    letter-spacing: -0.035em;
  }

  p {
    color: #64748b;
    font-size: 14px;
    line-height: 1.7;
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

/* 缩略图控制在 A4 缩到约 210px 宽，一屏能平铺更多简历 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  align-items: start;
  gap: 24px;
  min-height: 220px;
}

/* 新增入口与简历预览同尺寸，只靠留白和虚线降低视觉权重 */
.create-card {
  width: 100%;
  aspect-ratio: 210 / 297;
  padding: 20px;
  border: 1.5px dashed #dfe5ec;
  border-radius: 4px;
  background: rgba(248, 250, 252, 0.55);
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition:
    transform 250ms $paper-ease,
    border-color 250ms ease,
    background-color 250ms ease,
    box-shadow 250ms ease;

  .create-icon {
    width: 44px;
    height: 44px;
    margin-bottom: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #94a3b8;
    background: #fff;
    transition:
      transform 250ms $paper-ease,
      color 250ms ease,
      border-color 250ms ease,
      box-shadow 250ms ease;
  }

  strong {
    color: #475569;
    font-size: 14px;
    font-weight: 650;
    transition: color 250ms ease;
  }

  .create-hint {
    font-size: 12px;
  }

  &:hover,
  &:focus-visible {
    transform: translateY(-4px);
    border-color: #60a5fa;
    background: rgba(239, 246, 255, 0.7);
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.08);
  }

  &:hover .create-icon,
  &:focus-visible .create-icon {
    transform: rotate(90deg) scale(1.08);
    border-color: #bfdbfe;
    color: #2563eb;
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.16);
  }

  &:hover strong,
  &:focus-visible strong {
    color: #1d4ed8;
  }
}

/* 简历卡：没有外层容器，A4 纸张本身就是卡片 */
.resume-card {
  min-width: 0;
  cursor: pointer;
  perspective: 1400px;
  animation: card-enter 0.5s both;
  animation-delay: calc(var(--card-index, 0) * 60ms);
}

/* 抬起纸张：位移 + 极轻微的 X 轴翻转，底边向上离开桌面 */
.resume-card:hover .cv-paper,
.resume-card:focus-within .cv-paper {
  transform: translateY(-8px) rotateX(2deg);
  box-shadow:
    0 26px 50px rgba(15, 23, 42, 0.16),
    0 8px 16px rgba(15, 23, 42, 0.06);
}

/* 操作栏默认隐藏，hover / 键盘聚焦时从纸张底部淡入 */
.paper-actions {
  position: absolute;
  inset: auto 0 0;
  padding: 36px 10px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.94) 58%);
  opacity: 0;
  transform: translateY(12px);
  pointer-events: none;
  transition:
    opacity 250ms $paper-ease,
    transform 250ms $paper-ease;
}

.resume-card:hover .paper-actions,
.resume-card:focus-within .paper-actions {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

:deep(.action-button) {
  height: 30px;
  margin: 0;
  padding: 0 16px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #475569;
  background: #fff;
  font-weight: 600;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.1);
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    color: #0f172a;
    border-color: #cbd5e1;
    background: #f8fafc;
  }

  &.danger {
    color: #dc2626;
    border-color: #fecaca;

    &:hover {
      color: #b91c1c;
      border-color: #fca5a5;
      background: #fef2f2;
    }
  }
}

.card-meta {
  min-width: 0;
  padding: 14px 2px 0;

  h3 {
    overflow: hidden;
    color: #0f172a;
    font-size: 14px;
    font-weight: 650;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta-line {
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    color: #94a3b8;
    font-size: 12px;
    white-space: nowrap;

    > span:first-child {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .dot {
    color: #cbd5e1;
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
    gap: 20px;
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

  .hero-copy {
    h1 {
      font-size: 26px;
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

  /* 窄屏保持两列，避免单列时纸张被拉得过大 */
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .resume-card {
    animation: none;
  }

  .paper-actions,
  .create-card,
  .create-card .create-icon,
  .hero-actions :deep(.el-button) {
    transition: none;
  }

  .resume-card:hover .cv-paper,
  .resume-card:focus-within .cv-paper {
    transform: none;
  }

  .create-card:hover {
    transform: none;
  }

  .create-card:hover .create-icon {
    transform: none;
  }
}
</style>
