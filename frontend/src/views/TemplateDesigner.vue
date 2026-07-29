<script setup lang="ts">
/**
 * 模板设计器（代码模式）
 *
 * 直接写 HTML + CSS，配合变量树与变量声明编辑器。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  BUILTIN_TEMPLATES,
  getBuiltinTemplate,
  type ITemplateConfig,
  type TPageFormat,
  type TTemplateLayout,
} from '/@/types/template';
import { useTemplateStore } from '/@/stores/template';
import {
  cloneConfig,
  normalizeTemplateConfig,
  renderTemplate,
  validateTemplateConfig,
} from '/@/features/template-renderer';
import { createSampleResumeData } from '/@/features/template-renderer/sampleData';
import CodeEditor from '/@/components/template-designer/CodeEditor.vue';
import VariableTree from '/@/components/template-designer/VariableTree.vue';
import VariableSchemaEditor from '/@/components/template-designer/VariableSchemaEditor.vue';
import SecureResumeFrame from '/@/components/preview/SecureResumeFrame.vue';

const route = useRoute();
const router = useRouter();
const templateStore = useTemplateStore();

const name = ref('我的模板');
const description = ref('');
const config = ref<ITemplateConfig>(defaultHtmlConfig());
const isDirty = ref(false);
const templateId = ref<string | null>(null);
const isBuiltinSource = ref(false);
const sampleData = createSampleResumeData();

const activeTab = ref<'html' | 'css' | 'vars' | 'page'>('html');
const previewScale = ref(0.62);

/**
 * 语法示例文本。
 *
 * 必须放在 script 里当常量：直接写在 template 中的话，Vue 编译器会把
 * 示例里的 }} 当成插值结束符，导致 SFC 解析失败。
 */
const SYNTAX_SAMPLE = {
  interp: '{{path}}',
  each: '{{#each}}',
  raw: '{{& fieldSafe}}',
} as const;

const htmlEditorRef = ref<InstanceType<typeof CodeEditor> | null>(null);
const cssEditorRef = ref<InstanceType<typeof CodeEditor> | null>(null);

const undoStack = ref<ITemplateConfig[]>([]);
const redoStack = ref<ITemplateConfig[]>([]);
const MAX_HISTORY = 50;

/* ============================================================
 * 派生状态
 * ============================================================ */

const validation = computed(() => validateTemplateConfig(config.value));
const preview = computed(() => renderTemplate(config.value, sampleData));
const previewContext = computed(() => preview.value.context);
const renderErrors = computed(() => preview.value.errors);

const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);

/** 首个错误信息，工具栏下方展示 */
const firstError = computed(() => validation.value.errors[0] || renderErrors.value[0] || '');

/** HTML 语法错误行，传给编辑器标注 */
const errorLine = computed(() => validation.value.errorLine ?? null);

/* ============================================================
 * 配置读写
 * ============================================================ */

function defaultHtmlConfig(): ITemplateConfig {
  const starter = getBuiltinTemplate('minimal');
  const cfg = normalizeTemplateConfig(cloneConfig(starter?.config));
  cfg.meta = { ...cfg.meta, title: '我的模板', description: '' };
  return cfg;
}

/** 区块布局 → 结构最接近的内置模板（旧 blocks 模板升级用） */
function builtinForLayout(layout: TTemplateLayout): (typeof BUILTIN_TEMPLATES)[number] {
  if (layout === 'sidebar-left' || layout === 'sidebar-right') {
    return BUILTIN_TEMPLATES[0]; // modern，双栏
  }
  return BUILTIN_TEMPLATES[1]; // classic，单栏
}

/**
 * 将旧 blocks 引擎配置升级为 html 代码模板。
 * 区块画布内容无法自动转 HTML，用结构最接近的内置模板作为起点。
 */
function upgradeBlocksToHtml(cfg: ITemplateConfig): ITemplateConfig {
  const starter = builtinForLayout(cfg.layout);
  const next = cloneConfig(cfg);
  next.engine = 'html';
  next.source = cloneConfig(starter.config.source);
  next.variables = cloneConfig(starter.config.variables);
  return next;
}

function pushHistory() {
  undoStack.value.push(cloneConfig(config.value));
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
  redoStack.value.push(cloneConfig(config.value));
  config.value = prev;
  isDirty.value = true;
}

function redo() {
  const next = redoStack.value.pop();
  if (!next) return;
  undoStack.value.push(cloneConfig(config.value));
  config.value = next;
  isDirty.value = true;
}

function onConfigUpdate(next: ITemplateConfig) {
  applyConfig(next);
}

/* ============================================================
 * 代码编辑
 * ============================================================ */

function updateSource(key: 'html' | 'css', value: string) {
  const next = cloneConfig(config.value);
  next.source = { ...next.source, [key]: value };
  applyConfig(next);
}

function updatePage(patch: Partial<ITemplateConfig['page']>) {
  const next = cloneConfig(config.value);
  next.page = { ...next.page, ...patch };
  applyConfig(next);
}

function updatePageMargin(side: 'top' | 'right' | 'bottom' | 'left', value: number) {
  const next = cloneConfig(config.value);
  next.page = { ...next.page, margin: { ...next.page.margin, [side]: value } };
  applyConfig(next);
}

function updateAllMargins(value: number) {
  const next = cloneConfig(config.value);
  next.page = {
    ...next.page,
    margin: { top: value, right: value, bottom: value, left: value },
  };
  applyConfig(next);
}

function updateMeta(key: 'title' | 'description', value: string) {
  const next = cloneConfig(config.value);
  next.meta = { ...next.meta, [key]: value };
  applyConfig(next);
}

function insertSnippet(snippet: string) {
  if (activeTab.value === 'css') {
    cssEditorRef.value?.insertAtCursor(snippet);
    return;
  }
  if (activeTab.value !== 'html') {
    activeTab.value = 'html';
  }
  htmlEditorRef.value?.insertAtCursor(snippet);
}

/* ============================================================
 * 加载与保存
 * ============================================================ */

async function load() {
  const id = route.params.id as string | undefined;
  const mode = route.name;

  if (mode === 'TemplateCreate' || !id) {
    const preset = (route.query.preset as string) || 'minimal';
    const builtin = getBuiltinTemplate(preset) || getBuiltinTemplate('minimal');
    const cfg = normalizeTemplateConfig(cloneConfig(builtin?.config));
    cfg.meta = { ...cfg.meta, title: '我的模板', description: '' };
    config.value = cfg;

    name.value = '我的模板';
    description.value = '';
    templateId.value = null;
    isBuiltinSource.value = false;
    isDirty.value = false;
    undoStack.value = [];
    redoStack.value = [];
    activeTab.value = 'html';
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

  let loaded = normalizeTemplateConfig(detail.config);
  let upgradedFromBlocks = false;
  if (loaded.engine === 'blocks') {
    loaded = upgradeBlocksToHtml(loaded);
    upgradedFromBlocks = true;
  }
  config.value = loaded;
  isDirty.value = upgradedFromBlocks;
  undoStack.value = [];
  redoStack.value = [];
  activeTab.value = 'html';

  if (upgradedFromBlocks) {
    ElMessage.info('旧区块模板已转为代码模式，请检查并保存');
  }

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
    if (result.errorLine) activeTab.value = 'html';
    return;
  }
  if (!name.value.trim()) {
    ElMessage.warning('请填写模板名称');
    return;
  }

  // 模板名同步到 meta.title，模板中心与模板自述保持一致
  const payloadConfig = cloneConfig(config.value);
  payloadConfig.meta = {
    ...payloadConfig.meta,
    title: name.value.trim(),
    description: description.value,
  };

  try {
    if (templateId.value) {
      await templateStore.updateTemplate({
        template_id: templateId.value,
        name: name.value.trim(),
        description: description.value,
        config: payloadConfig,
      });
      ElMessage.success('已保存');
    } else {
      const id = await templateStore.createTemplate({
        name: name.value.trim(),
        description: description.value,
        config: payloadConfig,
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

/* ============================================================
 * 生命周期
 * ============================================================ */

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
        <el-button type="primary" :loading="templateStore.isSaving" @click="handleSave">
          保存
        </el-button>
      </div>
    </header>

    <div v-if="firstError" class="errors no-print">
      <el-alert :title="firstError" type="error" :closable="false" show-icon />
    </div>

    <div class="workspace">
      <aside class="side no-print">
        <VariableTree
          :context="previewContext"
          :variables="config.variables"
          @insert="insertSnippet"
        />
      </aside>

      <section class="editor-pane no-print">
        <el-tabs v-model="activeTab" class="editor-tabs">
          <el-tab-pane label="HTML" name="html">
            <p class="tab-hint">
              模板结构。用 <code>{{ SYNTAX_SAMPLE.interp }}</code> 插值、
              <code>{{ SYNTAX_SAMPLE.each }}</code> 循环；富文本字段用
              <code>{{ SYNTAX_SAMPLE.raw }}</code> 输出。禁止 script 与事件属性。
            </p>
            <CodeEditor
              ref="htmlEditorRef"
              :model-value="config.source.html || ''"
              :error-line="errorLine"
              placeholder="<article class=&quot;cv&quot;>…</article>"
              @update:model-value="(v: string) => updateSource('html', v)"
            />
          </el-tab-pane>

          <el-tab-pane label="CSS" name="css">
            <p class="tab-hint">
              样式会自动限制在 <code>.cv-root</code> 作用域内，不必自己加前缀。
              可用 <code>var(--tpl-*)</code> 读取变量，<code>var(--page-margin-top)</code> 读取页边距。
            </p>
            <CodeEditor
              ref="cssEditorRef"
              :model-value="config.source.css || ''"
              placeholder=".cv { padding: var(--page-margin-top); }"
              @update:model-value="(v: string) => updateSource('css', v)"
            />
          </el-tab-pane>

          <el-tab-pane label="变量" name="vars">
            <VariableSchemaEditor :config="config" @update:config="onConfigUpdate" />
          </el-tab-pane>

          <el-tab-pane label="页面" name="page">
            <el-form label-position="top" size="small" class="page-form">
              <el-form-item label="纸张">
                <el-radio-group
                  :model-value="config.page.format"
                  @update:model-value="
                    (v: string | number | boolean | undefined) =>
                      updatePage({ format: v as TPageFormat })
                  "
                >
                  <el-radio-button value="a4">A4</el-radio-button>
                  <el-radio-button value="letter">Letter</el-radio-button>
                </el-radio-group>
              </el-form-item>

              <el-form-item label="页边距（毫米，统一设置）">
                <el-slider
                  :model-value="config.page.margin.top"
                  :min="0"
                  :max="40"
                  @update:model-value="
                    (v: number | number[]) => updateAllMargins(Array.isArray(v) ? v[0] : v)
                  "
                />
              </el-form-item>

              <div class="margin-grid">
                <el-form-item
                  v-for="side in (['top', 'right', 'bottom', 'left'] as const)"
                  :key="side"
                  :label="side"
                >
                  <el-input-number
                    :model-value="config.page.margin[side]"
                    :min="0"
                    :max="50"
                    @update:model-value="
                      (v: number | undefined) => updatePageMargin(side, Number(v ?? 0))
                    "
                  />
                </el-form-item>
              </div>

              <el-form-item label="分页辅助样式">
                <el-switch
                  :model-value="config.page.paged"
                  @update:model-value="
                    (v: boolean | string | number) => updatePage({ paged: Boolean(v) })
                  "
                />
                <span class="inline-hint">
                  开启后可用 <code>.page-break</code> / <code>.no-break</code> 工具类
                </span>
              </el-form-item>

              <el-form-item label="模板自述标题">
                <el-input
                  :model-value="config.meta.title"
                  @update:model-value="(v: string) => updateMeta('title', v)"
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </section>

      <section class="preview-pane">
        <div class="pane-title no-print">
          <span>实时预览（隔离渲染）</span>
          <el-slider
            v-model="previewScale"
            :min="0.3"
            :max="1"
            :step="0.02"
            class="scale-slider"
            size="small"
          />
        </div>
        <div class="preview-wrap">
          <SecureResumeFrame :data="sampleData" :config="config" :scale="previewScale" />
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
  overflow-x: auto;
}

.left,
.right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.name {
  width: 160px;
}

.desc {
  width: 180px;
}

.errors {
  padding: 8px 12px 0;
}

.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(400px, 1fr) minmax(400px, 1fr);
}

.side {
  overflow: auto;
  background: var(--cv-surface);
  padding: 12px;
  border-right: 1px solid var(--cv-border);
}

.editor-pane {
  overflow: auto;
  padding: 12px 16px 40px;
  background: var(--cv-surface);
  border-right: 1px solid var(--cv-border);
}

.editor-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 12px;
  }
}

.tab-hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--cv-muted);

  code {
    padding: 1px 4px;
    border-radius: 3px;
    background: #f1f5f9;
    font-family: ui-monospace, Menlo, Consolas, monospace;
  }
}

.inline-hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--cv-muted);

  code {
    font-family: ui-monospace, Menlo, Consolas, monospace;
  }
}

.page-form {
  max-width: 420px;
}

.margin-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 8px;
}

.preview-pane {
  overflow: auto;
  padding: 12px 16px 40px;
}

.pane-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
  color: var(--cv-muted);
  margin: 4px 0 10px;
}

.scale-slider {
  width: 120px;
  flex-shrink: 0;
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

@media (max-width: 1440px) {
  .workspace {
    grid-template-columns: 268px minmax(340px, 1fr) minmax(340px, 1fr);
  }
}

@media (max-width: 1024px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .side {
    max-height: 260px;
    border-right: none;
    border-bottom: 1px solid var(--cv-border);
  }

  .editor-pane {
    border-right: none;
    border-bottom: 1px solid var(--cv-border);
  }
}
</style>
