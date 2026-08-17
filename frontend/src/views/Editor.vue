<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useResumeStore } from '/@/stores/resume';
import { exportResumePdf } from '/@/features/export/exportPdf';
import { exportResumeHtml } from '/@/features/export/exportHtml';
import { importResumeFromHtmlFile, ImportHtmlError } from '/@/features/export/importHtml';
import { copyText } from '/@/utils/clipboard';
import EditorNav from '/@/components/editor/EditorNav.vue';
import BasicsForm from '/@/components/editor/BasicsForm.vue';
import SectionEditor from '/@/components/editor/SectionEditor.vue';
import TemplatePicker from '/@/components/editor/TemplatePicker.vue';
import ResumeTemplateEditor from '/@/components/editor/ResumeTemplateEditor.vue';
import ThemePanel from '/@/components/editor/ThemePanel.vue';
import ResumePreview from '/@/components/preview/ResumePreview.vue';

const route = useRoute();
const router = useRouter();
const resumeStore = useResumeStore();
const isExportingPdf = ref(false);
const isExportingHtml = ref(false);
const isImportingHtml = ref(false);
const htmlFileInputRef = ref<HTMLInputElement | null>(null);
const shareVisible = ref(false);
const isTogglingShare = ref(false);
/** 收起左侧导航+表单，只留简历预览 */
const isPreviewImmersive = ref(false);

const SECTION_PREFIX = 'section:';

/**
 * 三段式的中间栏展示哪一块，由左侧导航的选中项决定。
 * 取值：basics / template / theme / `section:<id>`
 */
const activeKey = ref<string>('basics');

const activeSectionId = computed(() =>
  activeKey.value.startsWith(SECTION_PREFIX) ? activeKey.value.slice(SECTION_PREFIX.length) : ''
);

const activePaneTitle = computed(() => {
  if (activeKey.value === 'basics') return '基本信息';
  if (activeKey.value === 'template') return '模板';
  if (activeKey.value === 'theme') return '主题';
  const section = resumeStore.sortedSections.find((s) => s.id === activeSectionId.value);
  return section?.name || '模块';
});

const shareUrl = computed(() => {
  if (!resumeStore.shareToken || typeof window === 'undefined') return '';
  return `${window.location.origin}/s/${resumeStore.shareToken}`;
});

let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

async function handleSave() {
  if (resumeStore.isSaving || resumeStore.isLoading) return;
  await resumeStore.saveResume();
  ElMessage.success('已保存');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isPreviewImmersive.value) {
    event.preventDefault();
    isPreviewImmersive.value = false;
    return;
  }
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
  event.preventDefault();
  void handleSave();
}

onMounted(async () => {
  const id = route.params.id as string;
  await resumeStore.loadResume(id);

  if (resumeStore.isLocked) {
    ElMessage.warning('该简历已锁定，无法进入编辑。请先在首页预览中解锁。');
    router.replace('/');
    return;
  }

  window.addEventListener('keydown', onKeydown);

  autoSaveTimer = setInterval(async () => {
    if (resumeStore.isDirty && !resumeStore.isSaving) {
      await resumeStore.saveResume();
    }
  }, 30000);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  if (autoSaveTimer) clearInterval(autoSaveTimer);
});

/** 当前打开的模块被删除后，中间栏回落到基本信息，避免空白面板 */
watch(
  () => resumeStore.sortedSections.map((s) => s.id).join(','),
  () => {
    if (!activeSectionId.value) return;
    const stillExists = resumeStore.sortedSections.some((s) => s.id === activeSectionId.value);
    if (!stillExists) activeKey.value = 'basics';
  }
);

async function handleExportPdf() {
  if (!resumeStore.data || isExportingPdf.value) return;
  isExportingPdf.value = true;
  try {
    await exportResumePdf({
      data: resumeStore.data,
      filename: resumeStore.title || resumeStore.data.basics.name || '简历',
    });
    ElMessage.success('PDF 已开始下载');
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出失败，请稍后重试';
    ElMessage.error(message);
  } finally {
    isExportingPdf.value = false;
  }
}

async function handleExportHtml() {
  if (!resumeStore.data || isExportingHtml.value) return;
  isExportingHtml.value = true;
  try {
    await exportResumeHtml({
      data: resumeStore.data,
      filename: resumeStore.title || resumeStore.data.basics.name || '简历',
      title: resumeStore.title || resumeStore.data.basics.name || '简历',
    });
    ElMessage.success('HTML 已开始下载');
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出失败，请稍后重试';
    ElMessage.error(message);
  } finally {
    isExportingHtml.value = false;
  }
}

function onExportCommand(command: string) {
  if (command === 'pdf') {
    void handleExportPdf();
    return;
  }
  if (command === 'html') {
    void handleExportHtml();
  }
}

function triggerImportHtml() {
  if (isImportingHtml.value || isExportingPdf.value || isExportingHtml.value) return;
  htmlFileInputRef.value?.click();
}

async function handleImportHtmlFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !resumeStore.data) return;

  isImportingHtml.value = true;
  try {
    const imported = await importResumeFromHtmlFile(file);

    if (resumeStore.isDirty) {
      await ElMessageBox.confirm(
        '当前有未保存修改。导入将用 HTML 中的简历数据覆盖编辑器内容（不会立刻上传，需手动保存）。是否继续？',
        '导入 HTML',
        { type: 'warning', confirmButtonText: '继续导入', cancelButtonText: '取消' }
      );
    } else {
      await ElMessageBox.confirm(
        '将用 HTML 中 #cv-data 的简历数据覆盖当前编辑内容。导入后需手动保存才会同步到服务器。是否继续？',
        '导入 HTML',
        { type: 'info', confirmButtonText: '导入', cancelButtonText: '取消' }
      );
    }

    resumeStore.replaceResumeData(imported);
    ElMessage.success('已导入，请检查预览后保存');
  } catch (error) {
    // Element Plus：用户取消 confirm 时 reject 'cancel'
    if (error === 'cancel') return;
    const message =
      error instanceof ImportHtmlError
        ? error.message
        : error instanceof Error
          ? error.message
          : '导入失败，请稍后重试';
    ElMessage.error(message);
  } finally {
    isImportingHtml.value = false;
  }
}

function openShare() {
  shareVisible.value = true;
}

async function handleShareToggle(enabled: boolean) {
  if (isTogglingShare.value) return;
  isTogglingShare.value = true;
  try {
    // 开启前先保存最新内容，避免分享页看到旧稿
    if (enabled && resumeStore.isDirty) {
      await resumeStore.saveResume();
    }
    await resumeStore.setPublicShare(enabled);
    ElMessage.success(enabled ? '已开启在线分享' : '已关闭在线分享');
  } catch {
    // 错误提示由 request 拦截器处理
  } finally {
    isTogglingShare.value = false;
  }
}

async function handleCopyShareLink() {
  if (!shareUrl.value) return;
  const ok = await copyText(shareUrl.value);
  ElMessage[ok ? 'success' : 'error'](ok ? '链接已复制' : '复制失败，请手动选择链接');
}

function goBack() {
  router.push('/');
}

function onSelect(key: string) {
  activeKey.value = key;
  // 从沉浸预览点选模块时自动展开编辑区
  if (isPreviewImmersive.value) isPreviewImmersive.value = false;
}

function togglePreviewImmersive() {
  isPreviewImmersive.value = !isPreviewImmersive.value;
}
</script>

<template>
  <div
    v-loading="resumeStore.isLoading"
    class="editor"
    :class="{ 'is-immersive': isPreviewImmersive }"
  >
    <header class="toolbar no-print">
      <div class="left">
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <el-input
          :model-value="resumeStore.title"
          class="title-input"
          @update:model-value="resumeStore.setTitle"
        />
        <el-tag v-if="resumeStore.isDirty" type="warning" size="small" effect="plain">未保存</el-tag>
        <el-tag v-else type="success" size="small" effect="plain">已同步</el-tag>
        <el-tag v-if="resumeStore.isPublic" type="info" size="small" effect="plain">已分享</el-tag>
      </div>
      <div class="right">
        <el-button
          :type="isPreviewImmersive ? 'primary' : 'default'"
          :title="isPreviewImmersive ? '退出沉浸预览（Esc）' : '收起编辑区，沉浸预览'"
          @click="togglePreviewImmersive"
        >
          <el-icon>
            <FullScreen v-if="!isPreviewImmersive" />
            <CloseBold v-else />
          </el-icon>
          {{ isPreviewImmersive ? '退出沉浸' : '沉浸预览' }}
        </el-button>
        <el-button :loading="resumeStore.isSaving" type="primary" title="Ctrl/⌘ + S" @click="handleSave">
          保存
        </el-button>
        <el-button :type="resumeStore.isPublic ? 'success' : 'default'" @click="openShare">
          分享
        </el-button>
        <el-button
          :loading="isImportingHtml"
          :disabled="isExportingPdf || isExportingHtml"
          @click="triggerImportHtml"
        >
          导入 HTML
        </el-button>
        <el-dropdown trigger="click" @command="onExportCommand">
          <el-button :loading="isExportingPdf || isExportingHtml" :disabled="isImportingHtml">
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                command="pdf"
                :disabled="isExportingPdf || isExportingHtml || isImportingHtml"
              >
                导出 PDF
              </el-dropdown-item>
              <el-dropdown-item
                command="html"
                :disabled="isExportingPdf || isExportingHtml || isImportingHtml"
              >
                导出 HTML（含 AI 提示词）
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <input
          ref="htmlFileInputRef"
          class="hidden-file-input"
          type="file"
          accept=".html,text/html"
          @change="handleImportHtmlFile"
        />
      </div>
    </header>

    <div class="workspace" :class="{ immersive: isPreviewImmersive }">
      <!--
        左两段（导航 + 表单）包成 composer：条目编辑页 Teleport 到这里，
        从底部升起时正好盖住这两栏，右侧预览保持可见。
      -->
      <div class="composer" data-item-sheet-host>
        <aside class="nav-col no-print">
          <EditorNav :active-key="activeKey" @select="onSelect" />
        </aside>

        <section class="form-col no-print">
          <div class="form-head">
            <h2>{{ activePaneTitle }}</h2>
          </div>
          <div class="form-body">
            <BasicsForm v-if="activeKey === 'basics'" />
            <template v-else-if="activeKey === 'template'">
              <TemplatePicker />
              <el-divider class="template-divider" />
              <ResumeTemplateEditor />
            </template>
            <ThemePanel v-else-if="activeKey === 'theme'" />
            <SectionEditor v-else-if="activeSectionId" :key="activeSectionId" :section-id="activeSectionId" />
          </div>
        </section>
      </div>

      <!-- 第三段：简历预览；点这里也会收起条目编辑页 -->
      <section class="preview-col" data-preview-col>
        <div class="preview-stage">
          <ResumePreview v-if="resumeStore.data" :data="resumeStore.data" />
        </div>
      </section>
    </div>

    <el-dialog
      v-model="shareVisible"
      title="在线分享"
      width="480px"
      class="share-dialog"
      destroy-on-close
    >
      <div class="share-body">
        <div class="share-row">
          <div>
            <p class="share-title">公开预览链接</p>
            <p class="share-desc">开启后生成预览链接；关闭后再开启会生成新链接，旧链接立即失效。保存修改后，当前链接内容会自动更新。</p>
          </div>
          <el-switch
            :model-value="resumeStore.isPublic"
            :loading="isTogglingShare"
            :disabled="isTogglingShare"
            @change="(val: string | number | boolean) => handleShareToggle(Boolean(val))"
          />
        </div>

        <div v-if="resumeStore.isPublic" class="share-link-box">
          <el-input :model-value="shareUrl" readonly>
            <template #append>
              <el-button @click="handleCopyShareLink">复制</el-button>
            </template>
          </el-input>
          <p class="share-tip">关闭分享后原链接立即失效；再次开启会生成全新链接。</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid var(--cv-border);
  backdrop-filter: blur(8px);
}

.left,
.right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-input {
  width: 220px;
}

.hidden-file-input {
  display: none;
}

/* 三段式：左两段合拢 + 预览（flex + max-width，比 grid 列宽过渡更顺） */
.workspace {
  --composer-width: 632px;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  overflow: hidden;
}

.composer {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: var(--composer-width);
  max-width: var(--composer-width);
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  overflow: hidden;
  opacity: 1;
  transform: translateX(0);
  will-change: max-width, opacity, transform;
  transition:
    max-width 480ms cubic-bezier(0.33, 1, 0.68, 1),
    width 480ms cubic-bezier(0.33, 1, 0.68, 1),
    opacity 360ms cubic-bezier(0.33, 1, 0.68, 1),
    transform 480ms cubic-bezier(0.33, 1, 0.68, 1);
}

.workspace.immersive .composer {
  width: 0;
  max-width: 0;
  opacity: 0;
  transform: translateX(-18px);
  pointer-events: none;
  border: none;
}

.nav-col {
  min-height: 0;
  border-right: 1px solid var(--cv-border);
  background: #f8fafc;
}

.form-col {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--cv-border);
  background: var(--cv-surface);
}

.form-head {
  flex: none;
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--cv-border);

  h2 {
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.form-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 16px 32px;
}

.template-divider {
  margin: 14px 0 10px;
}

.preview-col {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 24px;
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.12), transparent 120px),
    #e2e8f0;
  transition: padding 480ms cubic-bezier(0.33, 1, 0.68, 1);
}

.workspace.immersive .preview-col {
  padding: 28px 40px 48px;
}

.preview-stage {
  display: flex;
  justify-content: center;
  transition: transform 480ms cubic-bezier(0.33, 1, 0.68, 1);
}

.workspace.immersive .preview-stage {
  :deep(.resume-preview) {
    width: min(100%, 860px);
    transition: width 480ms cubic-bezier(0.33, 1, 0.68, 1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .composer,
  .preview-col,
  .preview-stage,
  .workspace.immersive .preview-stage :deep(.resume-preview) {
    transition: none !important;
  }
}

@media (max-width: 1280px) {
  .workspace {
    --composer-width: 540px;
  }

  .composer {
    grid-template-columns: 200px minmax(0, 1fr);
  }
}

/* 窄屏放弃三列，改成纵向堆叠 */
@media (max-width: 960px) {
  .workspace {
    --composer-width: 100%;
    flex-direction: column;
  }

  .composer {
    width: 100%;
    max-width: 100%;
    max-height: 75vh;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    transition:
      max-height 480ms cubic-bezier(0.33, 1, 0.68, 1),
      opacity 360ms cubic-bezier(0.33, 1, 0.68, 1),
      transform 480ms cubic-bezier(0.33, 1, 0.68, 1);
  }

  .workspace.immersive .composer {
    width: 100%;
    max-width: 100%;
    max-height: 0;
    transform: translateY(-12px);
  }

  .nav-col,
  .form-col {
    border-right: none;
    border-bottom: 1px solid var(--cv-border);
  }

  .nav-col {
    max-height: 30vh;
  }

  .form-col {
    min-height: 0;
  }
}

@media print {
  .editor,
  .workspace,
  .preview-col,
  .preview-stage {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
    background: white !important;
    padding: 0 !important;
  }
}

.share-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.share-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.share-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.share-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #64748b;
}

.share-link-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-tip {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}
</style>
