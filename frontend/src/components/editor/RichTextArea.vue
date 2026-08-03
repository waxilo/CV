<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { InputInstance } from 'element-plus';
import {
  richTextToHtml,
  toggleListMarkers,
  toggleMarkdownMarkers,
  wrapLinkMarkers,
  type TMarkdownMarker,
} from '/@/features/template-renderer/helpers';
import { sanitizeHtml } from '/@/features/template-renderer/sanitize';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    rows?: number;
    placeholder?: string;
  }>(),
  {
    modelValue: '',
    rows: 3,
    placeholder: '支持 Markdown：**加粗** *斜体* - 列表 [文字](https://…)',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

interface IHistorySnapshot {
  value: string;
  start: number;
  end: number;
}

const inputRef = ref<InputInstance>();
const mode = ref<'edit' | 'preview'>('edit');
const undoStack = ref<IHistorySnapshot[]>([]);
const redoStack = ref<IHistorySnapshot[]>([]);
/** 与父组件同步过的值，用来区分「自己 emit」和「外部换条目」 */
const lastEmitted = ref(props.modelValue || '');

const MAX_HISTORY = 100;
const TYPING_COMMIT_MS = 400;

let typingAnchor: IHistorySnapshot | null = null;
let typingTimer: ReturnType<typeof setTimeout> | null = null;

const previewHtml = computed(() => sanitizeHtml(richTextToHtml(props.modelValue || '')));
const canUndo = computed(() => undoStack.value.length > 0 || Boolean(typingAnchor));
const canRedo = computed(() => redoStack.value.length > 0);

function getNativeTextarea(): HTMLTextAreaElement | null {
  const root = inputRef.value?.$el as HTMLElement | undefined;
  return (root?.querySelector('textarea') as HTMLTextAreaElement | null) ?? null;
}

function currentSnapshot(): IHistorySnapshot {
  const el = getNativeTextarea();
  const value = props.modelValue || '';
  return {
    value,
    start: el?.selectionStart ?? value.length,
    end: el?.selectionEnd ?? value.length,
  };
}

function pushHistory(snapshot: IHistorySnapshot) {
  const top = undoStack.value[undoStack.value.length - 1];
  if (top && top.value === snapshot.value) return;
  undoStack.value.push(snapshot);
  if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift();
  redoStack.value = [];
}

function emitValue(value: string) {
  lastEmitted.value = value;
  emit('update:modelValue', value);
}

function restoreSnapshot(snapshot: IHistorySnapshot) {
  emitValue(snapshot.value);
  nextTick(() => {
    const target = getNativeTextarea();
    if (!target) return;
    target.focus();
    const max = snapshot.value.length;
    target.setSelectionRange(Math.min(snapshot.start, max), Math.min(snapshot.end, max));
  });
}

function clearTypingTimer() {
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
}

/** 把当前输入会话收成一条历史：锚点是输入开始前的内容 */
function commitTypingSession() {
  clearTypingTimer();
  if (!typingAnchor) return;
  if (typingAnchor.value !== (props.modelValue || '')) {
    pushHistory(typingAnchor);
  }
  typingAnchor = null;
}

function onInput(value: string) {
  if (!typingAnchor) {
    typingAnchor = {
      value: props.modelValue || '',
      start: getNativeTextarea()?.selectionStart ?? 0,
      end: getNativeTextarea()?.selectionEnd ?? 0,
    };
  }
  emitValue(value);
  clearTypingTimer();
  typingTimer = setTimeout(() => {
    commitTypingSession();
  }, TYPING_COMMIT_MS);
}

function applyPatch(next: { value: string; start: number; end: number }) {
  commitTypingSession();
  pushHistory(currentSnapshot());
  emitValue(next.value);
  nextTick(() => {
    const target = getNativeTextarea();
    if (!target) return;
    target.focus();
    target.setSelectionRange(next.start, next.end);
  });
}

function withSelection(
  mapper: (value: string, start: number, end: number) => { value: string; start: number; end: number }
) {
  mode.value = 'edit';
  const el = getNativeTextarea();
  const value = props.modelValue || '';
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  applyPatch(mapper(value, start, end));
}

function applyMarker(marker: TMarkdownMarker) {
  withSelection((value, start, end) => toggleMarkdownMarkers(value, start, end, marker));
}

function applyList() {
  withSelection((value, start, end) => toggleListMarkers(value, start, end));
}

function applyLink() {
  withSelection((value, start, end) => wrapLinkMarkers(value, start, end));
}

function undo() {
  mode.value = 'edit';
  commitTypingSession();
  if (!undoStack.value.length) return;
  const current = currentSnapshot();
  const previous = undoStack.value.pop();
  if (!previous) return;
  redoStack.value.push(current);
  restoreSnapshot(previous);
}

function redo() {
  mode.value = 'edit';
  commitTypingSession();
  if (!redoStack.value.length) return;
  const current = currentSnapshot();
  const next = redoStack.value.pop();
  if (!next) return;
  undoStack.value.push(current);
  restoreSnapshot(next);
}

function onKeydown(event: Event | KeyboardEvent) {
  const e = event as KeyboardEvent;
  if (!(e.metaKey || e.ctrlKey)) return;
  const key = e.key.toLowerCase();

  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    undo();
    return;
  }
  if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault();
    e.stopPropagation();
    redo();
    return;
  }
  if (key === 'b') {
    e.preventDefault();
    applyMarker('**');
    return;
  }
  if (key === 'i') {
    e.preventDefault();
    applyMarker('*');
  }
}

watch(
  () => props.modelValue,
  (value) => {
    const next = value || '';
    if (next === lastEmitted.value) return;
    // 外部换了条目/内容：历史作废
    lastEmitted.value = next;
    undoStack.value = [];
    redoStack.value = [];
    typingAnchor = null;
    clearTypingTimer();
  }
);

onBeforeUnmount(() => {
  clearTypingTimer();
});
</script>

<template>
  <div class="rich-text-area" @keydown="onKeydown">
    <div class="toolbar">
      <el-button
        size="small"
        text
        class="tool-btn"
        title="加粗（Ctrl/⌘ + B）"
        :disabled="mode === 'preview'"
        @mousedown.prevent
        @click="applyMarker('**')"
      >
        <span class="label-b">B</span>
      </el-button>
      <el-button
        size="small"
        text
        class="tool-btn"
        title="斜体（Ctrl/⌘ + I）"
        :disabled="mode === 'preview'"
        @mousedown.prevent
        @click="applyMarker('*')"
      >
        <span class="label-i">I</span>
      </el-button>
      <el-button
        size="small"
        text
        class="tool-btn"
        title="无序列表"
        :disabled="mode === 'preview'"
        @mousedown.prevent
        @click="applyList"
      >
        <el-icon><List /></el-icon>
      </el-button>
      <el-button
        size="small"
        text
        class="tool-btn"
        title="链接"
        :disabled="mode === 'preview'"
        @mousedown.prevent
        @click="applyLink"
      >
        <el-icon><Link /></el-icon>
      </el-button>
      <el-button
        size="small"
        text
        class="tool-btn"
        title="撤销（Ctrl/⌘ + Z）"
        :disabled="mode === 'preview' || !canUndo"
        @mousedown.prevent
        @click="undo"
      >
        <el-icon><RefreshLeft /></el-icon>
      </el-button>
      <el-button
        size="small"
        text
        class="tool-btn"
        title="重做（Ctrl/⌘ + Shift + Z）"
        :disabled="mode === 'preview' || !canRedo"
        @mousedown.prevent
        @click="redo"
      >
        <el-icon><RefreshRight /></el-icon>
      </el-button>
      <span class="spacer" />
      <el-button
        size="small"
        text
        class="mode-btn"
        :type="mode === 'edit' ? 'primary' : undefined"
        @click="mode = 'edit'"
      >
        编辑
      </el-button>
      <el-button
        size="small"
        text
        class="mode-btn"
        :type="mode === 'preview' ? 'primary' : undefined"
        @click="mode = 'preview'"
      >
        预览
      </el-button>
    </div>

    <el-input
      v-show="mode === 'edit'"
      ref="inputRef"
      :model-value="modelValue"
      type="textarea"
      :rows="rows"
      :placeholder="placeholder"
      @update:model-value="onInput"
    />

    <div
      v-show="mode === 'preview'"
      class="preview-pane"
      :style="{ minHeight: `${Math.max(rows, 3) * 22 + 20}px` }"
    >
      <div v-if="previewHtml" v-html="previewHtml" />
      <p v-else class="empty">暂无内容</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rich-text-area {
  width: 100%;

  .toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-bottom: 4px;
  }

  .spacer {
    flex: 1;
  }

  .tool-btn,
  .mode-btn {
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
  }

  .label-b {
    font-weight: 700;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1;
  }

  .label-i {
    font-style: italic;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1;
  }

  .preview-pane {
    box-sizing: border-box;
    padding: 8px 11px;
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
    background: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.6;
    overflow: auto;

    :deep(p) {
      margin: 0 0 0.5em;

      &:last-child {
        margin-bottom: 0;
      }
    }

    :deep(ul),
    :deep(ol) {
      margin: 0.35em 0;
      padding-left: 1.35em;
    }

    :deep(li) {
      margin: 0.15em 0;
    }

    :deep(a) {
      color: var(--el-color-primary);
      text-decoration: underline;
    }

    :deep(code) {
      padding: 0 4px;
      border-radius: 3px;
      background: #f1f5f9;
      font-size: 0.92em;
    }

    .empty {
      margin: 0;
      color: var(--el-text-color-placeholder);
    }
  }
}
</style>
