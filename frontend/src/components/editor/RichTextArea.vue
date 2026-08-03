<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
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

const inputRef = ref<InputInstance>();
const mode = ref<'edit' | 'preview'>('edit');

const previewHtml = computed(() => sanitizeHtml(richTextToHtml(props.modelValue || '')));

function getNativeTextarea(): HTMLTextAreaElement | null {
  const root = inputRef.value?.$el as HTMLElement | undefined;
  return (root?.querySelector('textarea') as HTMLTextAreaElement | null) ?? null;
}

function applyPatch(next: { value: string; start: number; end: number }) {
  emit('update:modelValue', next.value);
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

function onKeydown(event: Event | KeyboardEvent) {
  const e = event as KeyboardEvent;
  if (!(e.metaKey || e.ctrlKey)) return;
  const key = e.key.toLowerCase();
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
      @update:model-value="(v: string) => emit('update:modelValue', v)"
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
