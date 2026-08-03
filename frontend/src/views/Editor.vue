<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useResumeStore } from '/@/stores/resume';
import EditorNav from '/@/components/editor/EditorNav.vue';
import BasicsForm from '/@/components/editor/BasicsForm.vue';
import SectionEditor from '/@/components/editor/SectionEditor.vue';
import TemplatePicker from '/@/components/editor/TemplatePicker.vue';
import ThemePanel from '/@/components/editor/ThemePanel.vue';
import ResumePreview from '/@/components/preview/ResumePreview.vue';

const route = useRoute();
const router = useRouter();
const resumeStore = useResumeStore();

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

let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  const id = route.params.id as string;
  await resumeStore.loadResume(id);

  autoSaveTimer = setInterval(async () => {
    if (resumeStore.isDirty && !resumeStore.isSaving) {
      await resumeStore.saveResume();
    }
  }, 30000);
});

onBeforeUnmount(() => {
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

async function handleSave() {
  await resumeStore.saveResume();
  ElMessage.success('已保存');
}

function handlePrint() {
  if (!resumeStore.currentId) return;
  const url = router.resolve({ name: 'PrintResume', params: { resumeId: resumeStore.currentId } }).href;
  window.open(url, '_blank');
}

function goBack() {
  router.push('/');
}

function onSelect(key: string) {
  activeKey.value = key;
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
            <TemplatePicker v-else-if="activeKey === 'template'" />
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

/* 三段式：左两段合拢 + 预览 */
.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(552px, 632px) 1fr;
}

.composer {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 232px minmax(320px, 400px);
  overflow: hidden;
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

.preview-col {
  position: relative;
  min-height: 0;
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

@media (max-width: 1280px) {
  .workspace {
    grid-template-columns: minmax(480px, 540px) 1fr;
  }

  .composer {
    grid-template-columns: 200px minmax(280px, 340px);
  }
}

/* 窄屏放弃三列，改成纵向堆叠 */
@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .composer {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    max-height: 75vh;
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
</style>
