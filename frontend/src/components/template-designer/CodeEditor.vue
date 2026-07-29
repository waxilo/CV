<script setup lang="ts">
/**
 * 轻量代码编辑器
 *
 * 用 textarea + 行号栏实现，不引入编辑器库。提供的能力：
 *   - 行号，错误行标红
 *   - Tab / Shift+Tab 缩进（支持多行选区）
 *   - 在光标处插入片段（供变量树调用）
 */
import { computed, nextTick, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    /** 需要高亮的错误行，1-based */
    errorLine?: number | null;
    minRows?: number;
    readonly?: boolean;
  }>(),
  { placeholder: '', errorLine: null, minRows: 18, readonly: false }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const gutterRef = ref<HTMLDivElement | null>(null);

const lines = computed(() => {
  const count = props.modelValue.split('\n').length;
  return Array.from({ length: Math.max(count, props.minRows) }, (_, i) => i + 1);
});

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
}

/** textarea 与行号栏同步滚动 */
function onScroll() {
  if (gutterRef.value && textareaRef.value) {
    gutterRef.value.scrollTop = textareaRef.value.scrollTop;
  }
}

const INDENT = '  ';

function onKeydown(event: KeyboardEvent) {
  const el = textareaRef.value;
  if (!el) return;

  if (event.key !== 'Tab') return;
  event.preventDefault();

  const { selectionStart, selectionEnd, value } = el;
  const hasSelection = selectionStart !== selectionEnd;

  if (!hasSelection && !event.shiftKey) {
    const next = value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd);
    emit('update:modelValue', next);
    restoreCursor(selectionStart + INDENT.length);
    return;
  }

  // 多行缩进 / 反缩进
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const lineEndIndex = value.indexOf('\n', selectionEnd);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  const block = value.slice(lineStart, lineEnd);
  const shifted = block
    .split('\n')
    .map((line) => {
      if (event.shiftKey) {
        if (line.startsWith(INDENT)) return line.slice(INDENT.length);
        return line.replace(/^\s{1,2}/, '');
      }
      return INDENT + line;
    })
    .join('\n');

  const next = value.slice(0, lineStart) + shifted + value.slice(lineEnd);
  emit('update:modelValue', next);
  restoreSelection(lineStart, lineStart + shifted.length);
}

function restoreCursor(position: number) {
  nextTick(() => {
    const el = textareaRef.value;
    if (!el) return;
    el.selectionStart = position;
    el.selectionEnd = position;
    el.focus();
  });
}

function restoreSelection(start: number, end: number) {
  nextTick(() => {
    const el = textareaRef.value;
    if (!el) return;
    el.selectionStart = start;
    el.selectionEnd = end;
    el.focus();
  });
}

/** 在光标处插入文本，供外部（变量树）调用 */
function insertAtCursor(snippet: string) {
  const el = textareaRef.value;
  const value = props.modelValue;

  if (!el) {
    emit('update:modelValue', value + snippet);
    return;
  }

  const start = el.selectionStart;
  const end = el.selectionEnd;
  const next = value.slice(0, start) + snippet + value.slice(end);
  emit('update:modelValue', next);
  restoreCursor(start + snippet.length);
}

defineExpose({ insertAtCursor });

// 出现错误时把错误行滚动到可视区
watch(
  () => props.errorLine,
  (line) => {
    if (!line || !textareaRef.value) return;
    const lineHeight = 21;
    const target = Math.max(0, (line - 4) * lineHeight);
    textareaRef.value.scrollTop = target;
    if (gutterRef.value) gutterRef.value.scrollTop = target;
  }
);
</script>

<template>
  <div class="code-editor" :class="{ 'has-error': !!errorLine }">
    <div ref="gutterRef" class="gutter" aria-hidden="true">
      <span v-for="n in lines" :key="n" :class="{ 'line-error': n === errorLine }">{{ n }}</span>
    </div>
    <textarea
      ref="textareaRef"
      class="code"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      :readonly="readonly"
      :placeholder="placeholder"
      :value="modelValue"
      @input="onInput"
      @scroll="onScroll"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped lang="scss">
$line-height: 21px;
$font: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;

.code-editor {
  display: flex;
  border: 1px solid var(--cv-border);
  border-radius: 8px;
  background: #fbfcfe;
  overflow: hidden;

  &:focus-within {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
  }

  &.has-error {
    border-color: #f87171;
  }
}

.gutter {
  flex-shrink: 0;
  width: 44px;
  padding: 10px 8px 10px 0;
  overflow: hidden;
  text-align: right;
  background: #f1f5f9;
  border-right: 1px solid var(--cv-border);
  font-family: $font;
  font-size: 12.5px;
  line-height: $line-height;
  color: #94a3b8;
  user-select: none;

  span {
    display: block;
  }

  .line-error {
    color: #fff;
    background: #ef4444;
    border-radius: 3px;
    font-weight: 700;
  }
}

.code {
  flex: 1;
  min-width: 0;
  min-height: 320px;
  max-height: 60vh;
  padding: 10px 12px;
  border: none;
  outline: none;
  resize: vertical;
  background: transparent;
  font-family: $font;
  font-size: 12.5px;
  line-height: $line-height;
  color: #0f172a;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
}
</style>
