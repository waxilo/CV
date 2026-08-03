<script setup lang="ts">
import { nextTick, ref } from 'vue';
import type { InputInstance } from 'element-plus';
import { toggleBoldMarkers } from '/@/features/template-renderer/helpers';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    rows?: number;
    placeholder?: string;
  }>(),
  {
    modelValue: '',
    rows: 3,
    placeholder: '',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const inputRef = ref<InputInstance>();

function getNativeTextarea(): HTMLTextAreaElement | null {
  const root = inputRef.value?.$el as HTMLElement | undefined;
  return (root?.querySelector('textarea') as HTMLTextAreaElement | null) ?? null;
}

function applyBold() {
  const el = getNativeTextarea();
  const value = props.modelValue || '';
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  const next = toggleBoldMarkers(value, start, end);
  emit('update:modelValue', next.value);

  nextTick(() => {
    const target = getNativeTextarea();
    if (!target) return;
    target.focus();
    target.setSelectionRange(next.start, next.end);
  });
}

function onKeydown(event: Event | KeyboardEvent) {
  const e = event as KeyboardEvent;
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'b') return;
  e.preventDefault();
  applyBold();
}
</script>

<template>
  <div class="rich-text-area" @keydown="onKeydown">
    <div class="toolbar">
      <el-button
        size="small"
        text
        class="bold-btn"
        title="加粗选中文字（Ctrl/⌘ + B）"
        @mousedown.prevent
        @click="applyBold"
      >
        <span class="bold-label">B</span>
      </el-button>
    </div>
    <el-input
      ref="inputRef"
      :model-value="modelValue"
      type="textarea"
      :rows="rows"
      :placeholder="placeholder"
      @update:model-value="(v: string) => emit('update:modelValue', v)"
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

  .bold-btn {
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
  }

  .bold-label {
    font-weight: 700;
    font-style: normal;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14px;
    line-height: 1;
  }
}
</style>
