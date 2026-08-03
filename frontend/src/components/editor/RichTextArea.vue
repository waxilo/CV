<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { htmlToMarkdown, richTextToHtml } from '/@/features/template-renderer/helpers';
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
    placeholder: '直接编辑，效果即时可见。可加粗、斜体、列表与链接',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const editorRef = ref<HTMLDivElement | null>(null);
/** 自己 emit 出去的值，避免回写时重置光标 */
const lastEmitted = ref(props.modelValue || '');
const showPlaceholder = ref(!(props.modelValue || '').trim());

const minHeight = computed(() => `${Math.max(props.rows, 3) * 22 + 20}px`);

function modelToHtml(value: string): string {
  const html = sanitizeHtml(richTextToHtml(value || ''));
  return html || '';
}

function refreshPlaceholder() {
  const text = (editorRef.value?.innerText || '').replace(/\u00a0/g, ' ').trim();
  showPlaceholder.value = !text;
}

function syncEditorFromModel() {
  const el = editorRef.value;
  if (!el) return;
  const html = modelToHtml(props.modelValue || '');
  if (el.innerHTML === html) {
    refreshPlaceholder();
    return;
  }
  // 空内容放一个可编辑段落，避免 contenteditable 焦点异常
  el.innerHTML = html || '<p><br></p>';
  refreshPlaceholder();
}

function emitFromEditor() {
  const el = editorRef.value;
  if (!el) return;
  const markdown = htmlToMarkdown(el.innerHTML);
  lastEmitted.value = markdown;
  emit('update:modelValue', markdown);
  refreshPlaceholder();
}

function runCommand(command: string, value?: string) {
  editorRef.value?.focus();
  document.execCommand(command, false, value);
  emitFromEditor();
}

function applyBold() {
  runCommand('bold');
}

function applyItalic() {
  runCommand('italic');
}

function applyList() {
  runCommand('insertUnorderedList');
}

function applyLink() {
  editorRef.value?.focus();
  const selection = window.getSelection();
  const selected = selection?.toString() || '';
  const url = window.prompt('链接地址', 'https://');
  if (!url || !/^https?:\/\//i.test(url.trim())) return;
  if (!selected) {
    document.execCommand('insertHTML', false, `<a href="${url.trim()}" rel="noopener noreferrer" target="_blank">链接文字</a>`);
  } else {
    document.execCommand('createLink', false, url.trim());
  }
  emitFromEditor();
}

function onInput() {
  emitFromEditor();
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') || '';
  document.execCommand('insertText', false, text);
  emitFromEditor();
}

function onKeydown(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey)) return;
  const key = event.key.toLowerCase();
  // 加粗/斜体交给浏览器 contenteditable 原生处理；这里只补工具栏没有的拦截
  if (key === 'b' || key === 'i') {
    // 让 execCommand 走浏览器默认路径后同步 markdown
    nextTick(() => emitFromEditor());
  }
}

watch(
  () => props.modelValue,
  (value) => {
    const next = value || '';
    if (next === lastEmitted.value) return;
    lastEmitted.value = next;
    nextTick(() => syncEditorFromModel());
  }
);

onMounted(() => {
  syncEditorFromModel();
});
</script>

<template>
  <div class="rich-text-area">
    <div class="toolbar">
      <el-button size="small" text class="tool-btn" title="加粗（Ctrl/⌘ + B）" @mousedown.prevent @click="applyBold">
        <span class="label-b">B</span>
      </el-button>
      <el-button size="small" text class="tool-btn" title="斜体（Ctrl/⌘ + I）" @mousedown.prevent @click="applyItalic">
        <span class="label-i">I</span>
      </el-button>
      <el-button size="small" text class="tool-btn" title="无序列表" @mousedown.prevent @click="applyList">
        <el-icon><List /></el-icon>
      </el-button>
      <el-button size="small" text class="tool-btn" title="链接" @mousedown.prevent @click="applyLink">
        <el-icon><Link /></el-icon>
      </el-button>
    </div>

    <div
      ref="editorRef"
      class="wysiwyg"
      :class="{ empty: showPlaceholder }"
      :data-placeholder="placeholder"
      :style="{ minHeight }"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      @input="onInput"
      @paste="onPaste"
      @keydown="onKeydown"
    />
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

  .tool-btn {
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

  .wysiwyg {
    box-sizing: border-box;
    padding: 8px 11px;
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
    background: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.6;
    overflow: auto;
    outline: none;
    transition: border-color 0.15s ease;

    &:focus {
      border-color: var(--el-color-primary);
    }

    &.empty:before {
      content: attr(data-placeholder);
      color: var(--el-text-color-placeholder);
      pointer-events: none;
      float: left;
      height: 0;
    }

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

    :deep(strong),
    :deep(b) {
      font-weight: 700;
    }

    :deep(em),
    :deep(i) {
      font-style: italic;
    }
  }
}
</style>
