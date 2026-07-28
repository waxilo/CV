<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useTemplateStore } from '/@/stores/template';
import {
  createDefaultTemplateConfig,
  migrateTemplateConfig,
  validateTemplateConfig,
  validateCustomCss,
} from '/@/features/template-renderer';
import { createSampleResumeData } from '/@/features/template-renderer/sampleData';
import type { ITemplateBlock, ITemplateConfig } from '/@/types/template';
import BlockPalette from '/@/components/template-designer/BlockPalette.vue';
import DesignerCanvas from '/@/components/template-designer/DesignerCanvas.vue';
import PropertyPanel from '/@/components/template-designer/PropertyPanel.vue';
import SecureResumeFrame from '/@/components/preview/SecureResumeFrame.vue';
import { cloneDeepConfig, createEmptyRow } from '/@/components/template-designer/helpers';

const route = useRoute();
const router = useRouter();
const templateStore = useTemplateStore();

const name = ref('我的模板');
const description = ref('');
const config = ref<ITemplateConfig>(createDefaultTemplateConfig('single-column'));
const selected = ref<{ rowId?: string; columnId?: string; blockId?: string }>({});
const isDirty = ref(false);
const templateId = ref<string | null>(null);
const isBuiltinSource = ref(false);
const sampleData = createSampleResumeData();

const undoStack = ref<ITemplateConfig[]>([]);
const redoStack = ref<ITemplateConfig[]>([]);
const MAX_HISTORY = 50;

const validation = computed(() => validateTemplateConfig(config.value));
const cssErrors = computed(() => validateCustomCss(config.value.customCss || ''));
const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);

function pushHistory() {
  undoStack.value.push(cloneDeepConfig(config.value));
  if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift();
  redoStack.value = [];
}

function applyConfig(next: ITemplateConfig, recordHistory = true) {
  if (recordHistory) pushHistory();
  config.value = next;
  isDirty.value = true;
}

function undo() {
  const prev = undoStack.value.pop();
  if (!prev) return;
  redoStack.value.push(cloneDeepConfig(config.value));
  config.value = prev;
  isDirty.value = true;
}

function redo() {
  const next = redoStack.value.pop();
  if (!next) return;
  undoStack.value.push(cloneDeepConfig(config.value));
  config.value = next;
  isDirty.value = true;
}

function onConfigUpdate(next: ITemplateConfig) {
  applyConfig(next);
}

function addBlock(block: ITemplateBlock) {
  const next = cloneDeepConfig(config.value);
  let targetCol = null as null | (typeof next.document.rows)[0]['columns'][0];

  if (selected.value.columnId) {
    for (const row of next.document.rows) {
      const col = row.columns.find((c) => c.id === selected.value.columnId);
      if (col) {
        targetCol = col;
        break;
      }
    }
  }
  if (!targetCol) {
    if (!next.document.rows.length) {
      next.document.rows.push(createEmptyRow([12]));
    }
    const lastRow = next.document.rows[next.document.rows.length - 1];
    targetCol = lastRow.columns[lastRow.columns.length - 1];
    selected.value = { rowId: lastRow.id, columnId: targetCol.id };
  }
  targetCol.blocks.push(block);
  selected.value = { ...selected.value, blockId: block.id };
  applyConfig(next);
}

function addRow(spans: number[]) {
  const next = cloneDeepConfig(config.value);
  const row = createEmptyRow(spans);
  next.document.rows.push(row);
  selected.value = { rowId: row.id, columnId: row.columns[0]?.id };
  applyConfig(next);
}

async function load() {
  const id = route.params.id as string | undefined;
  const mode = route.name;

  if (mode === 'TemplateCreate' || !id) {
    const layout = (route.query.layout as string) || 'single-column';
    config.value = createDefaultTemplateConfig(
      layout === 'sidebar-left' || layout === 'sidebar-right' || layout === 'two-column'
        ? layout
        : 'single-column'
    );
    name.value = '我的模板';
    description.value = '';
    templateId.value = null;
    isBuiltinSource.value = false;
    isDirty.value = false;
    return;
  }

  const detail = await templateStore.loadDetail(id);
  if (!detail) {
    ElMessage.error('模板不存在');
    router.replace('/templates');
    return;
  }

  name.value = detail.name;
  description.value = detail.description || '';
  config.value = migrateTemplateConfig(detail.config);
  isDirty.value = false;

  if (detail.is_builtin) {
    // 编辑内置模板 → 自动复制为个人副本
    isBuiltinSource.value = true;
    templateId.value = null;
    name.value = `${detail.name} 副本`;
    ElMessage.info('内置模板将保存为你的个人副本');
  } else {
    isBuiltinSource.value = false;
    templateId.value = detail.template_id;
  }
}

async function handleSave() {
  const result = validateTemplateConfig(config.value);
  if (!result.valid) {
    ElMessage.error(result.errors[0] || '模板配置无效');
    return;
  }
  if (cssErrors.value.length) {
    ElMessage.error(cssErrors.value[0]);
    return;
  }
  if (!name.value.trim()) {
    ElMessage.warning('请填写模板名称');
    return;
  }

  try {
    if (templateId.value) {
      await templateStore.updateTemplate({
        template_id: templateId.value,
        name: name.value.trim(),
        description: description.value,
        config: config.value,
      });
      ElMessage.success('已保存');
    } else {
      const id = await templateStore.createTemplate({
        name: name.value.trim(),
        description: description.value,
        config: config.value,
      });
      if (id) {
        templateId.value = id;
        isBuiltinSource.value = false;
        ElMessage.success('模板已创建');
        router.replace(`/templates/${id}/edit`);
      }
    }
    isDirty.value = false;
  } catch (e: unknown) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败');
  }
}

function goBack() {
  router.push('/templates');
}

onBeforeRouteLeave(async () => {
  if (!isDirty.value) return true;
  try {
    await ElMessageBox.confirm('有未保存的更改，确定离开？', '提示', {
      type: 'warning',
      confirmButtonText: '离开',
      cancelButtonText: '继续编辑',
    });
    return true;
  } catch {
    return false;
  }
});

function onKeydown(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
  } else if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault();
    handleSave();
  }
}

onMounted(async () => {
  await load();
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});

watch(
  () => route.fullPath,
  () => load()
);

// 同步预览主题
watch(
  config,
  (cfg) => {
    sampleData.metadata.theme.primaryColor = cfg.primaryColor;
    sampleData.metadata.theme.fontFamily = cfg.fontFamily;
    sampleData.metadata.theme.fontSize = cfg.fontSize;
    sampleData.metadata.theme.spacing = cfg.spacing;
  },
  { deep: true }
);
</script>

<template>
  <div class="designer">
    <header class="toolbar no-print">
      <div class="left">
        <el-button text @click="goBack">返回</el-button>
        <el-input v-model="name" class="name" placeholder="模板名称" />
        <el-input v-model="description" class="desc" placeholder="描述（可选）" />
        <el-tag v-if="isDirty" type="warning" size="small" effect="plain">未保存</el-tag>
        <el-tag v-else type="success" size="small" effect="plain">已同步</el-tag>
        <el-tag v-if="isBuiltinSource" type="info" size="small">将另存为副本</el-tag>
      </div>
      <div class="right">
        <el-button :disabled="!canUndo" @click="undo">撤销</el-button>
        <el-button :disabled="!canRedo" @click="redo">重做</el-button>
        <el-button type="primary" :loading="templateStore.isSaving" @click="handleSave">保存</el-button>
      </div>
    </header>

    <div v-if="!validation.valid || cssErrors.length" class="errors no-print">
      <el-alert
        :title="(validation.errors[0] || cssErrors[0])"
        type="error"
        :closable="false"
        show-icon
      />
    </div>

    <div class="workspace">
      <aside class="side left-pane no-print">
        <BlockPalette @add-block="addBlock" @add-row="addRow" />
      </aside>

      <section class="editor-pane no-print">
        <div class="pane-title no-print">结构画布（拖拽排序）</div>
        <DesignerCanvas
          :config="config"
          :selected="selected"
          @update:config="onConfigUpdate"
          @select="(v) => (selected = v)"
        />
        <div class="pane-title property-title">属性设置</div>
        <PropertyPanel :config="config" :selected="selected" @update:config="onConfigUpdate" />
      </section>

      <section class="preview-pane">
        <div class="pane-title no-print">实时预览（隔离渲染）</div>
        <div class="preview-wrap">
          <SecureResumeFrame :data="sampleData" :config="config" :scale="0.72" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.designer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #eef2f7;
}
.toolbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid var(--cv-border);
  gap: 12px;
}
.left,
.right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name {
  width: 180px;
}
.desc {
  width: 220px;
}
.errors {
  padding: 8px 12px 0;
}
.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 220px minmax(360px, 440px) minmax(560px, 1fr);
}
.side {
  overflow: auto;
  background: var(--cv-surface);
  padding: 12px;
}
.left-pane {
  border-right: 1px solid var(--cv-border);
}
.editor-pane {
  overflow: auto;
  padding: 12px 16px 40px;
  background: var(--cv-surface);
  border-right: 1px solid var(--cv-border);
}
.preview-pane {
  overflow: auto;
  padding: 12px 16px 40px;
}
.pane-title {
  font-size: 13px;
  color: var(--cv-muted);
  margin: 4px 0 10px;
}
.property-title {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--cv-border);
}
.preview-wrap {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: calc(100% - 28px);
  padding: 12px;
  background: #dbe3ee;
  border-radius: 12px;
  overflow: auto;
}
@media (max-width: 1280px) {
  .workspace {
    grid-template-columns: 200px 360px minmax(480px, 1fr);
  }
}
@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }
  .side {
    max-height: 280px;
  }
  .editor-pane {
    border-right: none;
    border-bottom: 1px solid var(--cv-border);
  }
}
</style>
