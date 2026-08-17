<script setup lang="ts">
/**
 * 简历内嵌模板编辑器
 *
 * 编辑这份简历自己持有的模板副本（metadata.templateConfig，完全固化快照）：
 * HTML / CSS / 变量声明 / 页面设置，与模板设计器同一套组件与校验。
 *
 * - 有快照：直接编辑快照；保存后写回简历，模板中心不再影响本简历
 * - 无快照（旧数据）：以模板中心当前配置为起点，保存后即固化为本简历副本
 * - 保存走 resumeStore.updateTemplateConfig → markDirty → 现有自动保存/手动保存
 */
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { getBuiltinTemplate, type ITemplateConfig } from '/@/types/template';
import { useResumeStore } from '/@/stores/resume';
import { useTemplateStore } from '/@/stores/template';
import {
  cloneConfig,
  normalizeTemplateConfig,
  renderTemplate,
  validateTemplateConfig,
} from '/@/features/template-renderer';
import CodeEditor from '/@/components/template-designer/CodeEditor.vue';
import VariableSchemaEditor from '/@/components/template-designer/VariableSchemaEditor.vue';
import PaperThumb from '/@/components/preview/PaperThumb.vue';

const resumeStore = useResumeStore();
const templateStore = useTemplateStore();

const draft = ref<ITemplateConfig | null>(null);
/** 当前是否已持有固化快照（false = 旧数据，仍跟随模板中心） */
const hasSnapshot = ref(false);
const isResolving = ref(false);
const activeTab = ref<'html' | 'css' | 'vars' | 'page'>('html');

const undoStack = ref<ITemplateConfig[]>([]);
const redoStack = ref<ITemplateConfig[]>([]);
const MAX_HISTORY = 30;

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

/* ============================================================
 * 派生状态
 * ============================================================ */

const validation = computed(() => (draft.value ? validateTemplateConfig(draft.value) : null));
const renderErrors = computed(() =>
  draft.value && resumeStore.data ? renderTemplate(draft.value, resumeStore.data).errors : []
);
const firstError = computed(
  () => validation.value?.errors[0] || renderErrors.value[0] || ''
);
/** HTML 语法错误行，传给编辑器标注 */
const errorLine = computed(() => validation.value?.errorLine ?? null);

const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);

const isDraftValid = computed(() => Boolean(draft.value && validation.value?.valid));

/** 当前快照来源的模板名（模板中心） */
const sourceTemplateName = computed(() => {
  const id = resumeStore.data?.metadata.templateId;
  if (!id) return '';
  return templateStore.getById(id)?.name || id;
});

/* ============================================================
 * 草稿初始化
 * ============================================================ */

async function resolveFallbackConfig(): Promise<ITemplateConfig | null> {
  const templateId = resumeStore.data?.metadata.templateId || 'modern';
  if (!templateStore.list.length) {
    await templateStore.fetchList();
  }
  const found = templateStore.getById(templateId);
  if (found) return normalizeTemplateConfig(found.config);
  try {
    const detail = await templateStore.loadDetail(templateId);
    if (detail) return normalizeTemplateConfig(detail.config);
  } catch {
    // 继续走内置兜底
  }
  const builtin = getBuiltinTemplate(templateId) || getBuiltinTemplate('minimal');
  return normalizeTemplateConfig(builtin?.config);
}

async function initDraft() {
  const snapshot = resumeStore.data?.metadata?.templateConfig;
  if (snapshot) {
    draft.value = normalizeTemplateConfig(cloneConfig(snapshot));
    hasSnapshot.value = true;
    return;
  }
  hasSnapshot.value = false;
  isResolving.value = true;
  try {
    const fallback = await resolveFallbackConfig();
    // 期间快照可能已被固化/切换（TemplatePicker 换模板），以最新快照为准
    const currentSnapshot = resumeStore.data?.metadata?.templateConfig;
    if (currentSnapshot) {
      draft.value = normalizeTemplateConfig(cloneConfig(currentSnapshot));
      hasSnapshot.value = true;
    } else if (fallback) {
      draft.value = fallback;
    }
  } finally {
    isResolving.value = false;
  }
}

onMounted(initDraft);

/** 模板快照被外部替换（切换模板 / 重新加载）时，跟随重新初始化草稿 */
watch(
  () => resumeStore.data?.metadata?.templateConfig,
  () => {
    if (!resumeStore.data?.metadata?.templateConfig) return;
    const next = normalizeTemplateConfig(cloneConfig(resumeStore.data.metadata.templateConfig));
    draft.value = next;
    hasSnapshot.value = true;
    undoStack.value = [];
    redoStack.value = [];
  }
);

/* ============================================================
 * 编辑操作
 * ============================================================ */

function pushHistory() {
  if (!draft.value) return;
  undoStack.value.push(cloneConfig(draft.value));
  if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift();
  redoStack.value = [];
}

function applyConfig(next: ITemplateConfig, recordHistory = true) {
  if (recordHistory) pushHistory();
  draft.value = next;
}

function updateSource(kind: 'html' | 'css', value: string) {
  if (!draft.value) return;
  pushHistory();
  draft.value = { ...draft.value, source: { ...draft.value.source, [kind]: value } };
}

function onConfigUpdate(next: ITemplateConfig) {
  applyConfig(next);
}

function updateAllMargins(value: number) {
  if (!draft.value) return;
  pushHistory();
  draft.value = {
    ...draft.value,
    page: { ...draft.value.page, margin: { ...draft.value.page.margin, top: value, right: value, bottom: value, left: value } },
  };
}

function updatePageMargin(side: 'top' | 'right' | 'bottom' | 'left', value: number) {
  if (!draft.value) return;
  pushHistory();
  draft.value = {
    ...draft.value,
    page: { ...draft.value.page, margin: { ...draft.value.page.margin, [side]: value } },
  };
}

function undo() {
  const prev = undoStack.value.pop();
  if (!prev || !draft.value) return;
  redoStack.value.push(cloneConfig(draft.value));
  draft.value = prev;
}

function redo() {
  const next = redoStack.value.pop();
  if (!next || !draft.value) return;
  undoStack.value.push(cloneConfig(draft.value));
  draft.value = next;
}

/** 保存到简历：校验通过才写回快照，之后走现有自动保存/手动保存 */
function saveToResume() {
  if (!draft.value || !resumeStore.data) return;
  if (!validation.value?.valid) {
    ElMessage.error(firstError.value || '模板配置无效');
    return;
  }
  resumeStore.updateTemplateConfig(draft.value);
  ElMessage.success(hasSnapshot.value ? '已保存到本简历（固化快照）' : '已保存并固化为本简历的模板副本');
}

/** 放弃本地修改：从当前快照恢复；无快照则重新从模板中心取 */
function revertDraft() {
  void initDraft();
  undoStack.value = [];
  redoStack.value = [];
}
</script>

<template>
  <div v-loading="isResolving" class="resume-template-editor">
    <div class="panel-head">
      <div class="panel-title">
        <strong>此简历的模板</strong>
        <el-tag v-if="hasSnapshot" size="small" type="info" effect="plain">
          独立副本（来自「{{ sourceTemplateName }}」）
        </el-tag>
        <el-tag v-else size="small" type="warning" effect="plain">未固化，跟随模板中心</el-tag>
      </div>
      <p class="panel-desc">
        {{
          hasSnapshot
            ? '修改只影响这份简历，模板中心与其他简历不受影响。'
            : '保存修改后即固化为本简历的独立副本，之后不再跟随模板中心。'
        }}
      </p>
      <div class="panel-actions">
        <el-button size="small" :disabled="!canUndo" @click="undo">撤销</el-button>
        <el-button size="small" :disabled="!canRedo" @click="redo">重做</el-button>
        <el-button size="small" @click="revertDraft">放弃修改</el-button>
        <el-button size="small" type="primary" :disabled="!isDraftValid" @click="saveToResume">
          保存修改
        </el-button>
      </div>
    </div>

    <p v-if="firstError" class="error-line">{{ firstError }}</p>

    <div v-if="draft && draft.engine === 'blocks'" class="blocks-hint">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="此模板为区块引擎（旧版），暂不支持在简历内编辑代码"
        description="可在模板中心编辑该模板，或在本页上方切换到其他模板；保存后不影响其他简历。"
      />
    </div>

    <div v-else-if="draft" class="editor-body">
      <el-tabs v-model="activeTab" class="editor-tabs">
        <el-tab-pane label="HTML" name="html">
          <p class="tab-hint">
            用 <code>{{ SYNTAX_SAMPLE.interp }}</code> 插值、
            <code>{{ SYNTAX_SAMPLE.each }}</code> 循环；富文本字段用
            <code>{{ SYNTAX_SAMPLE.raw }}</code> 输出。禁止 script 与事件属性。
          </p>
          <CodeEditor
            :model-value="draft.source.html || ''"
            :error-line="errorLine"
            :min-rows="14"
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
            :model-value="draft.source.css || ''"
            :min-rows="14"
            placeholder=".cv { padding: var(--page-margin-top); }"
            @update:model-value="(v: string) => updateSource('css', v)"
          />
        </el-tab-pane>

        <el-tab-pane label="变量" name="vars">
          <VariableSchemaEditor :config="draft" @update:config="onConfigUpdate" />
        </el-tab-pane>

        <el-tab-pane label="页面" name="page">
          <el-form label-position="top" size="small" class="page-form">
            <el-form-item label="页边距（毫米，统一设置）">
              <el-slider
                :model-value="draft.page.margin.top"
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
                  :model-value="draft.page.margin[side]"
                  :min="0"
                  :max="50"
                  @update:model-value="
                    (v: number | undefined) => updatePageMargin(side, Number(v ?? 0))
                  "
                />
              </el-form-item>
            </div>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="mini-preview">
        <PaperThumb v-if="resumeStore.data" :data="resumeStore.data" :config="draft" show-all-pages />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.resume-template-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
}

.panel-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;

  strong {
    color: #0f172a;
    font-size: 14px;
  }
}

.panel-desc {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  :deep(.el-button) {
    margin: 0;
  }
}

.error-line {
  margin: 0;
  padding: 6px 10px;
  border-radius: 6px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
}

.blocks-hint {
  :deep(.el-alert) {
    border-radius: 10px;
  }
}

.editor-body {
  display: flex;
  flex-direction: column;
  gap: 12px;

  :deep(.el-tabs__header) {
    margin-bottom: 8px;
  }
}

.tab-hint {
  margin: 0 0 8px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;

  code {
    padding: 1px 5px;
    border-radius: 4px;
    background: #f1f5f9;
    color: #475569;
    font-size: 11px;
  }
}

.margin-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mini-preview {
  max-height: 420px;
  overflow: auto;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  display: flex;
  justify-content: center;
}
</style>
