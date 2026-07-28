<script setup lang="ts">
import { BLOCK_PALETTE, createBlockFromPalette, type IBlockPaletteItem } from './helpers';
import type { ITemplateBlock } from '/@/types/template';

const emit = defineEmits<{
  (e: 'add-block', block: ITemplateBlock): void;
  (e: 'add-row', spans: number[]): void;
}>();

function onAdd(item: IBlockPaletteItem) {
  emit('add-block', createBlockFromPalette(item));
}
</script>

<template>
  <div class="palette">
    <h3>区块库</h3>
    <p class="hint">点击添加到当前选中列；未选中时加入最后一列</p>
    <div class="list">
      <button
        v-for="item in BLOCK_PALETTE"
        :key="`${item.type}-${item.sectionType || item.label}`"
        type="button"
        class="item"
        @click="onAdd(item)"
      >
        {{ item.label }}
      </button>
    </div>

    <h3 class="mt">添加行</h3>
    <div class="list">
      <button type="button" class="item" @click="emit('add-row', [12])">单列 12</button>
      <button type="button" class="item" @click="emit('add-row', [6, 6])">双列 6/6</button>
      <button type="button" class="item" @click="emit('add-row', [4, 8])">左栏 4/8</button>
      <button type="button" class="item" @click="emit('add-row', [8, 4])">右栏 8/4</button>
      <button type="button" class="item" @click="emit('add-row', [3, 6, 3])">三列</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.palette {
  h3 {
    font-size: 13px;
    color: var(--cv-muted);
    margin-bottom: 8px;
  }
  .hint {
    font-size: 12px;
    color: var(--cv-muted);
    margin-bottom: 10px;
  }
  .mt {
    margin-top: 20px;
  }
}
.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.item {
  text-align: left;
  padding: 8px 10px;
  border: 1px solid var(--cv-border);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  &:hover {
    border-color: #93c5fd;
    background: #f8fbff;
  }
}
</style>
