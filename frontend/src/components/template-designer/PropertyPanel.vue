<script setup lang="ts">
import { computed } from 'vue';
import type { ITemplateBlock, ITemplateColumn, ITemplateConfig } from '/@/types/template';

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
}>();

const selectedBlock = computed(() => {
  if (!props.selected.blockId) return null;
  for (const row of props.config.document.rows) {
    for (const col of row.columns) {
      const block = col.blocks.find((b) => b.id === props.selected.blockId);
      if (block) return { row, col, block };
    }
  }
  return null;
});

const selectedColumn = computed(() => {
  if (!props.selected.columnId) return null;
  for (const row of props.config.document.rows) {
    const col = row.columns.find((c) => c.id === props.selected.columnId);
    if (col) return { row, col };
  }
  return null;
});

function patchConfig(mutator: (cfg: ITemplateConfig) => void) {
  const next = JSON.parse(JSON.stringify(props.config)) as ITemplateConfig;
  mutator(next);
  emit('update:config', next);
}

function updateBlock(patch: Partial<ITemplateBlock>) {
  if (!selectedBlock.value) return;
  const { block } = selectedBlock.value;
  patchConfig((cfg) => {
    for (const row of cfg.document.rows) {
      for (const col of row.columns) {
        const target = col.blocks.find((b) => b.id === block.id);
        if (target) Object.assign(target, patch);
      }
    }
  });
}

function updateBlockStyle(key: string, value: string) {
  if (!selectedBlock.value) return;
  const { block } = selectedBlock.value;
  patchConfig((cfg) => {
    for (const row of cfg.document.rows) {
      for (const col of row.columns) {
        const target = col.blocks.find((b) => b.id === block.id);
        if (target) {
          target.style = { ...(target.style || {}), [key]: value || undefined };
        }
      }
    }
  });
}

function updateColumn(patch: Partial<ITemplateColumn>) {
  if (!selectedColumn.value) return;
  const { col } = selectedColumn.value;
  patchConfig((cfg) => {
    for (const row of cfg.document.rows) {
      const target = row.columns.find((c) => c.id === col.id);
      if (target) Object.assign(target, patch);
    }
  });
}

function updateColumnStyle(key: string, value: string) {
  if (!selectedColumn.value) return;
  const { col } = selectedColumn.value;
  patchConfig((cfg) => {
    for (const row of cfg.document.rows) {
      const target = row.columns.find((c) => c.id === col.id);
      if (target) {
        target.style = { ...(target.style || {}), [key]: value || undefined };
      }
    }
  });
}

function updateMeta(key: 'primaryColor' | 'fontFamily' | 'fontSize' | 'spacing' | 'customCss', value: string | number) {
  patchConfig((cfg) => {
    if (key === 'fontSize' || key === 'spacing') {
      cfg[key] = Number(value);
    } else {
      cfg[key] = String(value);
    }
  });
}

function asNumber(value: number | number[]): number {
  return Array.isArray(value) ? Number(value[0]) : Number(value);
}
</script>

<template>
  <div class="props">
    <h3>模板主题</h3>
    <el-form label-position="top" size="small">
      <el-form-item label="主色">
        <el-color-picker
          :model-value="config.primaryColor"
          @change="(v: string | null) => updateMeta('primaryColor', v || config.primaryColor)"
        />
      </el-form-item>
      <el-form-item label="字体">
        <el-select :model-value="config.fontFamily" @update:model-value="(v: string) => updateMeta('fontFamily', v)">
          <el-option label="Inter" value="Inter" />
          <el-option label="Helvetica" value="Helvetica" />
          <el-option label="Georgia" value="Georgia" />
          <el-option label="PingFang SC" value="PingFang SC" />
        </el-select>
      </el-form-item>
      <el-form-item label="字号">
        <el-slider
          :model-value="config.fontSize"
          :min="10"
          :max="20"
          @update:model-value="(v) => updateMeta('fontSize', asNumber(v))"
        />
      </el-form-item>
      <el-form-item label="行距">
        <el-slider
          :model-value="config.spacing"
          :min="0.8"
          :max="2"
          :step="0.05"
          @update:model-value="(v) => updateMeta('spacing', asNumber(v))"
        />
      </el-form-item>
      <el-form-item label="全局自定义 CSS（无 JS）">
        <el-input
          type="textarea"
          :rows="6"
          :model-value="config.customCss || ''"
          placeholder=".cv-name { letter-spacing: 0.02em; }"
          @update:model-value="(v: string) => updateMeta('customCss', v)"
        />
      </el-form-item>
    </el-form>

    <template v-if="selectedColumn">
      <h3>列属性</h3>
      <el-form label-position="top" size="small">
        <el-form-item label="栅格宽度 (1-12)">
          <el-slider
            :model-value="selectedColumn.col.span"
            :min="1"
            :max="12"
            @update:model-value="(v) => updateColumn({ span: asNumber(v) })"
          />
        </el-form-item>
        <el-form-item label="内边距">
          <el-input
            :model-value="selectedColumn.col.style?.padding || ''"
            placeholder="24px"
            @update:model-value="(v: string) => updateColumnStyle('padding', v)"
          />
        </el-form-item>
        <el-form-item label="背景色">
          <el-color-picker
            :model-value="selectedColumn.col.style?.backgroundColor || ''"
            @change="(v: string | null) => updateColumnStyle('backgroundColor', v || '')"
          />
        </el-form-item>
        <el-form-item label="文字色">
          <el-color-picker
            :model-value="selectedColumn.col.style?.color || ''"
            @change="(v: string | null) => updateColumnStyle('color', v || '')"
          />
        </el-form-item>
      </el-form>
    </template>

    <template v-if="selectedBlock">
      <h3>区块属性</h3>
      <el-form label-position="top" size="small">
        <el-form-item label="类型">
          <el-tag size="small">{{ selectedBlock.block.type }}</el-tag>
          <el-tag v-if="selectedBlock.block.sectionType" size="small" class="ml">
            {{ selectedBlock.block.sectionType }}
          </el-tag>
        </el-form-item>
        <el-form-item label="可见">
          <el-switch
            :model-value="selectedBlock.block.visible"
            @update:model-value="(v) => updateBlock({ visible: Boolean(v) })"
          />
        </el-form-item>
        <el-form-item v-if="selectedBlock.block.type === 'text'" label="文本内容">
          <el-input
            type="textarea"
            :rows="4"
            :model-value="selectedBlock.block.content || ''"
            @update:model-value="(v: string) => updateBlock({ content: v })"
          />
        </el-form-item>
        <el-form-item v-if="selectedBlock.block.type === 'html'" label="自定义 HTML（支持 {{basics.name}}）">
          <el-input
            type="textarea"
            :rows="8"
            :model-value="selectedBlock.block.content || ''"
            @update:model-value="(v: string) => updateBlock({ content: v })"
          />
          <p class="tip">禁止 script / 事件属性 / 三花括号；预览会自动清洗。</p>
        </el-form-item>
        <el-form-item label="对齐">
          <el-radio-group
            :model-value="selectedBlock.block.style?.textAlign || 'left'"
            @update:model-value="(v) => updateBlockStyle('textAlign', String(v || 'left'))"
          >
            <el-radio-button value="left">左</el-radio-button>
            <el-radio-button value="center">中</el-radio-button>
            <el-radio-button value="right">右</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="内边距">
          <el-input
            :model-value="selectedBlock.block.style?.padding || ''"
            @update:model-value="(v: string) => updateBlockStyle('padding', v)"
          />
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker
            :model-value="selectedBlock.block.style?.color || ''"
            @change="(v: string | null) => updateBlockStyle('color', v || '')"
          />
        </el-form-item>
      </el-form>
    </template>

    <el-empty v-if="!selectedBlock && !selectedColumn" description="选中画布中的列或区块以编辑属性" :image-size="64" />
  </div>
</template>

<style scoped lang="scss">
.props {
  h3 {
    font-size: 13px;
    color: var(--cv-muted);
    margin: 0 0 10px;
  }
  .tip {
    margin-top: 6px;
    font-size: 12px;
    color: var(--cv-muted);
  }
  .ml {
    margin-left: 6px;
  }
}
</style>
