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
import { copyText } from '/@/utils/clipboard';
import PaperThumb from '/@/components/preview/PaperThumb.vue';
import ResumeFullPreview from '/@/components/preview/ResumeFullPreview.vue';
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

const isPreviewVisible = ref(false);
const isLargePreviewVisible = ref(false);
const isShareVisible = ref(false);
const previewResume = ref<IResumeSummary | null>(null);
const previewPageIndex = ref(0);
const previewPageCount = ref(1);
const isTogglingLock = ref(false);
const isTogglingShare = ref(false);
const isRefreshingPreview = ref(false);
let previewWheelLockedUntil = 0;

const previewConfig = computed(() =>
  previewResume.value ? resumeThumbConfig(previewResume.value) : null
);

const previewShareUrl = computed(() => {
  const token = previewResume.value?.share_token;
  if (!token || typeof window === 'undefined') return '';
  return `${window.location.origin}/s/${token}`;
});

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

function syncPreviewFromList(resumeId: string) {
  const fresh = resumeStore.list.find((r) => r.resume_id === resumeId);
  if (fresh && previewResume.value?.resume_id === resumeId) {
    previewResume.value = { ...fresh };
  }
}

function openPreview(item: IResumeSummary) {
  previewResume.value = item;
  previewPageIndex.value = 0;
  previewPageCount.value = 1;
  isLargePreviewVisible.value = false;
  isShareVisible.value = false;
  isPreviewVisible.value = true;
}

/** 弹窗关闭后 Element Plus 会把焦点还给触发卡片，去掉残留描边 */
function blurActiveElement() {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
}

async function refreshPreviewResume(showMessage = true) {
  if (!previewResume.value) return;
  const resumeId = previewResume.value.resume_id;
  if (isRefreshingPreview.value) return;
  isRefreshingPreview.value = true;
  try {
    await resumeStore.fetchList();
    syncPreviewFromList(resumeId);
    if (showMessage) ElMessage.success('已获取最新简历');
  } catch {
    if (showMessage) ElMessage.error('刷新失败，请稍后重试');
  } finally {
    isRefreshingPreview.value = false;
  }
}

function openLargePreview() {
  if (!previewResume.value || isLargePreviewVisible.value) return;
  // 先打开再后台刷新，避免 await 接口时第一下无反馈、连点叠出多次
  isLargePreviewVisible.value = true;
  void refreshPreviewResume(false);
}

function openEditor(id: string) {
  const item = resumeStore.list.find((r) => r.resume_id === id);
  if (item?.is_locked) {
    ElMessage.warning('简历已锁定，请先解锁再编辑');
    return;
  }
  isPreviewVisible.value = false;
  isLargePreviewVisible.value = false;
  isShareVisible.value = false;
  router.push(`/editor/${id}`);
}

async function handleDelete(item: IResumeSummary) {
  if (item.is_locked) {
    ElMessage.warning('简历已锁定，无法删除');
    return;
  }
  try {
    await ElMessageBox.confirm(`删除后将无法恢复「${item.title}」，确定继续吗？`, '删除这份简历？', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '保留简历',
      customClass: 'dashboard-confirm-dialog',
      closeOnClickModal: false,
    });
  } catch {
    return;
  }
  try {
    await resumeStore.removeResume(item.resume_id);
    if (previewResume.value?.resume_id === item.resume_id) {
      isPreviewVisible.value = false;
      isLargePreviewVisible.value = false;
      isShareVisible.value = false;
      previewResume.value = null;
    }
    ElMessage.success('已删除');
  } catch {
    // 拦截器已提示
  }
}

async function handleCopy(item: IResumeSummary) {
  const id = await resumeStore.duplicateResume(item.resume_id);
  if (id) {
    ElMessage.success('已复制（副本未锁定）');
    await resumeStore.fetchList();
  } else {
    ElMessage.error('复制失败');
  }
}

async function handleToggleLock(item: IResumeSummary) {
  if (isTogglingLock.value) return;
  isTogglingLock.value = true;
  try {
    const next = !item.is_locked;
    await resumeStore.setResumeLocked(item.resume_id, next);
    syncPreviewFromList(item.resume_id);
    ElMessage.success(next ? '已锁定：不可编辑、删除或被 MCP 修改' : '已解锁');
  } catch {
    // 拦截器已提示
  } finally {
    isTogglingLock.value = false;
  }
}

function openShareDialog() {
  if (!previewResume.value) return;
  isShareVisible.value = true;
}

async function handleShareToggle(enabled: boolean) {
  if (!previewResume.value || isTogglingShare.value) return;
  if (previewResume.value.is_locked) {
    ElMessage.warning('简历已锁定，无法修改分享状态');
    return;
  }
  isTogglingShare.value = true;
  try {
    await resumeStore.setResumePublicShare(previewResume.value.resume_id, enabled);
    syncPreviewFromList(previewResume.value.resume_id);
    ElMessage.success(enabled ? '已开启在线分享' : '已关闭在线分享');
  } catch (error) {
    const message = error instanceof Error ? error.message : '分享设置失败';
    ElMessage.error(message);
  } finally {
    isTogglingShare.value = false;
  }
}

async function handleCopyShareLink() {
  if (!previewShareUrl.value) return;
  const ok = await copyText(previewShareUrl.value);
  ElMessage[ok ? 'success' : 'error'](ok ? '链接已复制' : '复制失败，请手动选择链接');
}

function handlePreviewPageCount(count: number) {
  previewPageCount.value = Math.max(1, count);
  if (previewPageIndex.value > previewPageCount.value - 1) {
    previewPageIndex.value = previewPageCount.value - 1;
  }
}

function goPreviewPage(delta: number) {
  const next = previewPageIndex.value + delta;
  if (next < 0 || next >= previewPageCount.value) return;
  previewPageIndex.value = next;
}

function handlePreviewWheel(event: WheelEvent) {
  if (previewPageCount.value <= 1) return;
  const now = Date.now();
  if (now < previewWheelLockedUntil) return;
  if (Math.abs(event.deltaY) < 20) return;
  previewWheelLockedUntil = now + 280;
  goPreviewPage(event.deltaY > 0 ? 1 : -1);
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
  if (command === 'mcp') {
    router.push('/mcp');
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
          <button class="nav-link" type="button" @click="router.push('/mcp')">
            MCP 接入
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
                <el-dropdown-item command="mcp">
                  <el-icon><Connection /></el-icon>
                  MCP 接入
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
            :class="{ locked: item.is_locked }"
            :style="{ '--card-index': index }"
            tabindex="0"
            @click="openPreview(item)"
            @keydown.enter="openPreview(item)"
          >
            <PaperThumb :data="resumePreviewData(item)" :config="resumeThumbConfig(item)">
              <span v-if="item.is_locked" class="lock-badge" title="已锁定">
                <el-icon><Lock /></el-icon>
                已锁定
              </span>
              <div class="thumb-caption">
                <h3>{{ item.title }}</h3>
              </div>
            </PaperThumb>
          </article>
        </div>
      </section>
    </main>

    <el-dialog
      v-model="isPreviewVisible"
      class="preview-dialog"
      width="min(780px, calc(100vw - 32px), calc((100vh - 48px) * 210 / 297 / 0.55))"
      :show-close="false"
      align-center
      destroy-on-close
      @closed="blurActiveElement"
    >
      <template v-if="previewResume">
        <div class="modal-preview">
          <div class="modal-preview-stage" @wheel="handlePreviewWheel">
            <button
              class="modal-paper enlarge-trigger"
              type="button"
              aria-label="查看大图"
              @click.stop="openLargePreview"
            >
              <PaperThumb
                v-if="previewConfig"
                :data="resumePreviewData(previewResume)"
                :config="previewConfig"
                :fallback-scale="0.54"
                show-all-pages
                page-layout="flip"
                :page-index="previewPageIndex"
                @page-count="handlePreviewPageCount"
              />
              <span class="enlarge-hint">
                <el-icon><ZoomIn /></el-icon>
                查看大图
              </span>
            </button>

            <button
              v-if="previewPageIndex > 0"
              class="page-nav prev"
              type="button"
              aria-label="上一页"
              @click="goPreviewPage(-1)"
            >
              <el-icon><ArrowLeft /></el-icon>
            </button>
            <button
              v-if="previewPageIndex < previewPageCount - 1"
              class="page-nav next"
              type="button"
              aria-label="下一页"
              @click="goPreviewPage(1)"
            >
              <el-icon><ArrowRight /></el-icon>
            </button>
            <div v-if="previewPageCount > 1" class="page-indicator">
              {{ previewPageIndex + 1 }} / {{ previewPageCount }}
            </div>
          </div>

          <aside class="modal-details">
            <button
              class="modal-close"
              type="button"
              aria-label="关闭预览"
              @click="isPreviewVisible = false"
            >
              <el-icon><Close /></el-icon>
            </button>
            <span class="detail-eyebrow">
              {{ previewResume.is_locked ? '已锁定' : '我的简历' }}
            </span>
            <h2>{{ previewResume.title }}</h2>
            <p class="detail-description">
              {{
                previewResume.is_locked
                  ? '锁定中：不可编辑、删除或被 MCP 修改，仅可复制。'
                  : '可编辑内容，或锁定后防止 MCP / 误删改动。'
              }}
            </p>

            <div class="detail-block">
              <span>模板</span>
              <strong>{{ templateName(previewResume.template_id) }}</strong>
            </div>
            <div class="detail-block">
              <span>更新于</span>
              <strong>{{ formatDate(previewResume.updated_at) }}</strong>
            </div>

            <div class="modal-actions">
              <el-button
                v-if="!previewResume.is_locked"
                class="modal-primary"
                type="primary"
                @click="openEditor(previewResume.resume_id)"
              >
                编辑简历
                <el-icon><ArrowRight /></el-icon>
              </el-button>
              <el-button @click="openShareDialog">
                <el-icon><Share /></el-icon>
                分享
              </el-button>
              <el-button @click="handleCopy(previewResume)">复制</el-button>
              <el-button
                :loading="isTogglingLock"
                :type="previewResume.is_locked ? 'warning' : 'default'"
                @click="handleToggleLock(previewResume)"
              >
                <el-icon>
                  <Unlock v-if="previewResume.is_locked" />
                  <Lock v-else />
                </el-icon>
                {{ previewResume.is_locked ? '解锁' : '锁定' }}
              </el-button>
              <el-button
                type="danger"
                plain
                :disabled="Boolean(previewResume.is_locked)"
                @click="handleDelete(previewResume)"
              >
                删除
              </el-button>
            </div>
          </aside>
        </div>
      </template>
    </el-dialog>

    <ResumeFullPreview
      v-if="isLargePreviewVisible && previewResume && previewConfig"
      :data="resumePreviewData(previewResume)"
      :title="previewResume.title"
      :config="previewConfig"
      variant="overlay"
      can-refresh
      :is-refreshing="isRefreshingPreview"
      @close="isLargePreviewVisible = false"
      @refresh="refreshPreviewResume"
    />

    <el-dialog
      v-model="isShareVisible"
      title="在线分享"
      width="480px"
      class="share-dialog"
      append-to-body
      destroy-on-close
    >
      <template v-if="previewResume">
        <div class="share-body">
          <div class="share-row">
            <div>
              <p class="share-title">公开预览链接</p>
              <p class="share-desc">
                开启后生成预览链接；关闭后再开启会生成新链接，旧链接立即失效。内容保存后当前链接会自动更新。
              </p>
            </div>
            <el-switch
              :model-value="Boolean(previewResume.is_public)"
              :loading="isTogglingShare"
              :disabled="isTogglingShare || Boolean(previewResume.is_locked)"
              @change="(val: string | number | boolean) => handleShareToggle(Boolean(val))"
            />
          </div>
          <p v-if="previewResume.is_locked" class="share-tip warn">锁定中无法开关分享，可先解锁。</p>
          <div v-if="previewResume.is_public && previewShareUrl" class="share-link-box">
            <el-input :model-value="previewShareUrl" readonly>
              <template #append>
                <el-button @click="handleCopyShareLink">复制</el-button>
              </template>
            </el-input>
            <p class="share-tip">关闭分享后原链接立即失效；再次开启会生成全新链接。</p>
          </div>
        </div>
      </template>
    </el-dialog>

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
  outline: none;
  cursor: pointer;
  perspective: 1400px;
  animation: card-enter 0.5s both;
  animation-delay: calc(var(--card-index, 0) * 60ms);
}

/* 抬起纸张：位移 + 极轻微的 X 轴翻转；仅键盘 focus-visible，避免关弹窗后残留描边态 */
.resume-card:hover .cv-paper,
.resume-card:focus-visible .cv-paper {
  transform: translateY(-8px) rotateX(2deg);
  box-shadow:
    0 26px 50px rgba(15, 23, 42, 0.16),
    0 8px 16px rgba(15, 23, 42, 0.06);
}

.lock-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 11px;
  font-weight: 650;
  pointer-events: none;
}

/* 简历名叠在 A4 纸张底部，渐变遮罩保证浅色模板上可读 */
.thumb-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  padding: 28px 12px 12px;
  background: linear-gradient(to top, rgba(15, 23, 42, 0.72) 0%, rgba(15, 23, 42, 0.28) 55%, transparent 100%);
  pointer-events: none;

  h3 {
    overflow: hidden;
    margin: 0;
    color: #fff;
    font-size: 13px;
    font-weight: 650;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 2px rgba(15, 23, 42, 0.35);
  }
}

:deep(.preview-dialog) {
  padding: 0;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 0;
  }
}

.modal-preview {
  display: grid;
  grid-template-columns: 55% 45%;
}

.modal-preview-stage {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: stretch;

  &:hover,
  &:focus-within {
    .page-nav,
    .page-indicator {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.modal-paper {
  width: 100%;
  aspect-ratio: 210 / 297;
  overflow: hidden;
  position: relative;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
  display: block;
  text-align: left;

  &.enlarge-trigger {
    &:hover .enlarge-hint,
    &:focus-visible .enlarge-hint {
      opacity: 1;
    }
  }

  :deep(.cv-paper) {
    width: 100%;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
    pointer-events: none;
  }
}

.enlarge-hint {
  position: absolute;
  left: 50%;
  bottom: 16px;
  z-index: 4;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 12px;
  font-weight: 650;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.page-nav {
  width: 36px;
  height: 36px;
  position: absolute;
  top: 50%;
  z-index: 5;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: #334155;
  display: grid;
  place-items: center;
  transform: translateY(-50%);
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, color 0.18s ease, border-color 0.18s ease;

  &:hover {
    color: #2563eb;
    border-color: #bfdbfe;
  }

  &.prev {
    left: 10px;
  }

  &.next {
    right: 10px;
  }
}

.page-indicator {
  position: absolute;
  left: 50%;
  bottom: 12px;
  z-index: 5;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  transform: translateX(-50%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.modal-details {
  padding: 42px 28px 28px;
  position: relative;
  background: #fff;

  .detail-eyebrow {
    color: #2563eb;
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
  }

  h2 {
    margin: 8px 0 10px;
    color: #0f172a;
    font-size: 22px;
    line-height: 1.25;
    letter-spacing: -0.03em;
  }

  .detail-description {
    margin: 0 0 18px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.6;
  }
}

.modal-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f1f5f9;
  color: #64748b;
  display: grid;
  place-items: center;
  cursor: pointer;

  &:hover {
    color: #0f172a;
    background: #e2e8f0;
  }
}

.detail-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;

  span {
    color: #94a3b8;
    font-size: 12px;
  }

  strong {
    color: #0f172a;
    font-size: 14px;
    font-weight: 650;
  }
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;

  .modal-primary {
    width: 100%;
    height: 42px;
    margin-bottom: 4px;
  }
}

.share-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.share-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.share-title {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 650;
}

.share-desc {
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}

.share-link-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-tip {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.45;

  &.warn {
    color: #b45309;
  }
}

@media (max-width: 720px) {
  .modal-preview {
    grid-template-columns: 1fr;
  }

  .modal-paper {
    max-height: 42vh;
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
  .resume-card:focus-visible .cv-paper {
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
