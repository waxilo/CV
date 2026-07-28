<script setup lang="ts">
import draggable from 'vuedraggable';
import type { ITemplateBlock, ITemplateConfig, ITemplateRow } from '/@/types/template';

const props = defineProps<{
  config: ITemplateConfig;
  selected: {
    rowId?: string;
    columnId?: string;
    blockId?: string;
  };
}>();

const emit = defineEmits<{
  (e: 'update:config', value: ITemplateConfig): void;
  (e: 'select', value: { rowId?: string; columnId?: string; blockId?: string }): void;
}>();

function patch(mutator: (cfg: ITemplateConfig) => void) {
  const next = JSON.parse(JSON.stringify(props.config)) as ITemplateConfig;
  mutator(next);
  emit('update:config', next);
}

function onBlocksChange(rowId: string, columnId: string, blocks: ITemplateBlock[]) {
  patch((cfg) => {
    const row = cfg.document.rows.find((r) => r.id === rowId);
    const col = row?.columns.find((c) => c.id === columnId);
    if (col) col.blocks = blocks;
  });
}

function onRowsChange(rows: ITemplateRow[]) {
  patch((cfg) => {
    cfg.document.rows = rows;
  });
}

function selectRow(rowId: string) {
  emit('select', { rowId });
}

function selectColumn(rowId: string, columnId: string) {
  emit('select', { rowId, columnId });
}

function selectBlock(rowId: string, columnId: string, blockId: string) {
  emit('select', { rowId, columnId, blockId });
}

function removeRow(rowId: string) {
  patch((cfg) => {
    cfg.document.rows = cfg.document.rows.filter((r) => r.id !== rowId);
  });
}

function removeBlock(rowId: string, columnId: string, blockId: string) {
  patch((cfg) => {
    const row = cfg.document.rows.find((r) => r.id === rowId);
    const col = row?.columns.find((c) => c.id === columnId);
    if (col) col.blocks = col.blocks.filter((b) => b.id !== blockId);
  });
}

function blockLabel(block: ITemplateBlock) {
  if (block.type === 'section') return `模块:${block.sectionType}`;
  if (block.type === 'html') return '自定义HTML';
  if (block.type === 'text') return '文本';
  if (block.type === 'basics') return '个人信息';
  if (block.type === 'avatar') return '头像';
  if (block.type === 'divider') return '分隔线';
  return block.type;
}
</script>

<template>
  <div class="canvas">
    <draggable
      :model-value="config.document.rows"
      item-key="id"
      handle=".row-handle"
      :animation="180"
      @update:model-value="onRowsChange"
    >
      <template #item="{ element: row }">
        <div
          class="row"
          :class="{ active: selected.rowId === row.id && !selected.columnId }"
          @click.stop="selectRow(row.id)"
        >
          <div class="row-toolbar">
            <span class="row-handle">⋮⋮ 行</span>
            <el-button size="small" text type="danger" @click.stop="removeRow(row.id)">删除行</el-button>
          </div>
          <div class="cols">
            <div
              v-for="col in row.columns"
              :key="col.id"
              class="col"
              :class="{ active: selected.columnId === col.id }"
              :style="{ flex: col.span }"
              @click.stop="selectColumn(row.id, col.id)"
            >
              <div class="col-head">列 {{ col.span }}/12</div>
              <draggable
                :model-value="col.blocks"
                item-key="id"
                group="blocks"
                :animation="180"
                class="blocks"
                @update:model-value="(blocks: ITemplateBlock[]) => onBlocksChange(row.id, col.id, blocks)"
              >
                <template #item="{ element: block }">
                  <div
                    class="block"
                    :class="{
                      active: selected.blockId === block.id,
                      hidden: !block.visible,
                    }"
                    @click.stop="selectBlock(row.id, col.id, block.id)"
                  >
                    <span>{{ blockLabel(block) }}</span>
                    <el-button
                      size="small"
                      text
                      type="danger"
                      @click.stop="removeBlock(row.id, col.id, block.id)"
                    >
                      删
                    </el-button>
                  </div>
                </template>
              </draggable>
            </div>
          </div>
        </div>
      </template>
    </draggable>
    <el-empty v-if="!config.document.rows.length" description="从左侧添加行与区块开始设计" />
  </div>
</template>

<style scoped lang="scss">
.canvas {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  padding: 8px;
  background: #f8fafc;
  &.active {
    border-color: #2563eb;
  }
}
.row-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.row-handle {
  cursor: grab;
  font-size: 12px;
  color: #64748b;
}
.cols {
  display: flex;
  gap: 8px;
}
.col {
  min-height: 80px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  &.active {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
  }
}
.col-head {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 6px;
}
.blocks {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 40px;
}
.block {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  cursor: pointer;
  font-size: 12px;
  &.active {
    border-color: #2563eb;
    background: #dbeafe;
  }
  &.hidden {
    opacity: 0.45;
  }
}
</style>
