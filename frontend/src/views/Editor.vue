<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useResumeStore } from '/@/stores/resume';
import SectionList from '/@/components/editor/SectionList.vue';
import BasicsForm from '/@/components/editor/BasicsForm.vue';
import SectionEditor from '/@/components/editor/SectionEditor.vue';
import TemplatePicker from '/@/components/editor/TemplatePicker.vue';
import ThemePanel from '/@/components/editor/ThemePanel.vue';
import ResumePreview from '/@/components/preview/ResumePreview.vue';

const route = useRoute();
const router = useRouter();
const resumeStore = useResumeStore();

const activeTab = ref<'content' | 'template' | 'theme'>('content');
const activeSectionId = ref<string>('');
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  const id = route.params.id as string;
  await resumeStore.loadResume(id);
  if (resumeStore.sortedSections.length) {
    activeSectionId.value = resumeStore.sortedSections[0].id;
  }

  autoSaveTimer = setInterval(async () => {
    if (resumeStore.isDirty && !resumeStore.isSaving) {
      await resumeStore.saveResume();
    }
  }, 30000);
});

onBeforeUnmount(() => {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
});

watch(
  () => resumeStore.sortedSections.map((s) => s.id).join(','),
  () => {
    if (!activeSectionId.value && resumeStore.sortedSections.length) {
      activeSectionId.value = resumeStore.sortedSections[0].id;
    }
  }
);

async function handleSave() {
  await resumeStore.saveResume();
  ElMessage.success('已保存');
}

function handlePrint() {
  window.print();
}

function goBack() {
  router.push('/');
}

function onSelectSection(id: string) {
  activeSectionId.value = id;
  activeTab.value = 'content';
}
</script>

<template>
  <div v-loading="resumeStore.isLoading" class="editor">
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
      </div>
      <div class="right">
        <el-button :loading="resumeStore.isSaving" type="primary" @click="handleSave">保存</el-button>
        <el-button @click="handlePrint">导出 PDF</el-button>
      </div>
    </header>

    <div class="workspace">
      <aside class="sidebar no-print">
        <el-tabs v-model="activeTab" stretch>
          <el-tab-pane label="内容" name="content" />
          <el-tab-pane label="模板" name="template" />
          <el-tab-pane label="主题" name="theme" />
        </el-tabs>

        <div v-show="activeTab === 'content'" class="pane">
          <BasicsForm />
          <SectionList
            :active-id="activeSectionId"
            @select="onSelectSection"
          />
          <SectionEditor
            v-if="activeSectionId"
            :section-id="activeSectionId"
          />
        </div>

        <div v-show="activeTab === 'template'" class="pane">
          <TemplatePicker />
        </div>

        <div v-show="activeTab === 'theme'" class="pane">
          <ThemePanel />
        </div>
      </aside>

      <section class="preview-area">
        <div class="preview-stage">
          <ResumePreview v-if="resumeStore.data" :data="resumeStore.data" />
        </div>
      </section>
    </div>
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

.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 380px 1fr;
}

.sidebar {
  border-right: 1px solid var(--cv-border);
  background: var(--cv-surface);
  overflow: auto;
  padding: 0 12px 24px;
}

.pane {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-area {
  overflow: auto;
  padding: 24px;
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.12), transparent 120px),
    #e2e8f0;
}

.preview-stage {
  display: flex;
  justify-content: center;
}

@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .sidebar {
    max-height: 45vh;
    border-right: none;
    border-bottom: 1px solid var(--cv-border);
  }
}

@media print {
  .editor,
  .workspace,
  .preview-area,
  .preview-stage {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
    background: white !important;
    padding: 0 !important;
  }
}
</style>
