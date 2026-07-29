<script setup lang="ts">
/**
 * 变量面板：变量树 + 循环变量 + 语法片段
 * 点击任意条目把对应片段插入代码编辑器。
 */
import { computed, ref, watch } from 'vue';
import type { ElTree } from 'element-plus';
import type { IRenderContext } from '/@/features/template-renderer';
import { listHelperNames } from '/@/features/template-renderer';
import type { ITemplateVariable } from '/@/types/template';
import {
  buildVariableTree,
  LOOP_VARIABLES,
  SYNTAX_SNIPPETS,
  type IVarNode,
} from './variableTree';

const props = defineProps<{
  context: IRenderContext;
  /** 模板声明的变量，用于给 vars.* 显示模板作者写的中文名 */
  variables?: ITemplateVariable[];
}>();

const emit = defineEmits<{
  (e: 'insert', snippet: string): void;
}>();

const keyword = ref('');
const activeTab = ref('vars');

/**
 * 语法示例文本必须放在 script 里：写在 template 中会被 Vue 编译器
 * 当成插值语法解析（内层 }} 提前闭合插值），导致 SFC 编译失败。
 */
const SYNTAX_SAMPLE = {
  raw: '{{& fieldSafe}}',
  each: '{{#each}}',
} as const;

const tree = computed(() =>
  buildVariableTree(props.context, { variables: props.variables || [] })
);
const helperNames = computed(() => listHelperNames());

/** el-tree 的过滤回调拿到的是 TreeNodeData（Record<string, any>），这里收窄回自己的节点类型 */
function filterNode(value: string, data: Record<string, unknown>): boolean {
  if (!value) return true;
  const node = data as unknown as IVarNode;
  const q = value.toLowerCase();
  // 中文别名也参与搜索，这样输入「工作经历」就能定位到 experience
  return (
    node.alias.toLowerCase().includes(q) ||
    node.label.toLowerCase().includes(q) ||
    node.path.toLowerCase().includes(q)
  );
}

/**
 * el-tree 的过滤不会自动跟随输入框，必须显式调用实例的 filter()。
 */
const treeRef = ref<InstanceType<typeof ElTree> | null>(null);
watch(keyword, (value) => {
  treeRef.value?.filter(value);
});

function onNodeClick(data: IVarNode) {
  emit('insert', data.snippet);
}
</script>

<template>
  <div class="var-panel">
    <el-tabs v-model="activeTab" class="tabs">
      <el-tab-pane label="变量" name="vars">
        <el-input
          v-model="keyword"
          size="small"
          placeholder="搜索变量（支持中文，如「工作经历」）"
          clearable
          class="search"
        />
        <p class="hint">
          上行是字段含义，下行是模板里要写的字段名。点击即插入到光标处：
          数组插入 each 循环，Safe 字段插入 <code>{{ SYNTAX_SAMPLE.raw }}</code> 形式。
        </p>
        <el-tree
          ref="treeRef"
          :data="tree"
          node-key="id"
          :props="{ label: 'label', children: 'children' }"
          :filter-node-method="filterNode"
          :default-expanded-keys="['root/basics']"
          :expand-on-click-node="false"
          class="tree"
          @node-click="onNodeClick"
        >
          <template #default="{ data }">
            <span class="node" :title="`${data.alias || data.label}　${data.path}　${data.preview}`">
              <span class="node-main">
                <span v-if="data.alias" class="node-alias">{{ data.alias }}</span>
                <code class="node-key" :class="`kind-${data.kind}`">{{ data.label }}</code>
              </span>
              <span class="node-preview">{{ data.preview }}</span>
            </span>
          </template>
        </el-tree>
      </el-tab-pane>

      <el-tab-pane label="循环内" name="loop">
        <p class="hint">
          这些变量只在 <code>{{ SYNTAX_SAMPLE.each }}</code> 内部有效。
        </p>
        <button
          v-for="v in LOOP_VARIABLES"
          :key="v.path"
          type="button"
          class="row"
          @click="emit('insert', v.snippet)"
        >
          <code>{{ v.path }}</code>
          <span>{{ v.label }}</span>
        </button>
      </el-tab-pane>

      <el-tab-pane label="语法" name="syntax">
        <p class="hint">常用结构，插入后替换其中的占位表达式。</p>
        <button
          v-for="s in SYNTAX_SNIPPETS"
          :key="s.label"
          type="button"
          class="row"
          @click="emit('insert', s.snippet)"
        >
          <span>{{ s.label }}</span>
        </button>

        <p class="hint helpers-hint">可用过滤器（{{ helperNames.length }} 个）：</p>
        <div class="helpers">
          <code v-for="name in helperNames" :key="name">{{ name }}</code>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.var-panel {
  font-size: 13px;
}

.search {
  margin-bottom: 8px;
}

.hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cv-muted);
}

.helpers-hint {
  margin-top: 16px;
}

.tree {
  --el-tree-node-content-height: 34px;
  background: transparent;
  font-size: 12.5px;
}

.node {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;
  padding-right: 4px;
}

/* 中文别名在上、字段名在下，两行都不占太多宽度 */
.node-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.35;
}

.node-alias {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: #1e293b;
}

.node-key {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 11px;
  color: #64748b;

  &.kind-array {
    color: #7c3aed;
  }

  &.kind-object {
    color: #0f766e;
  }
}

/* 没有别名时字段名就是主标题，不该显示成灰色小字 */
.node-main > .node-key:only-child {
  font-size: 12.5px;
  color: #334155;
}

.node-preview {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 11px;
  color: #94a3b8;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 4px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #f8fafc;
  cursor: pointer;
  text-align: left;
  font-size: 12.5px;
  color: #334155;

  &:hover {
    border-color: #bfdbfe;
    background: #eff6ff;
  }

  code {
    flex-shrink: 0;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    color: #2563eb;
  }
}

.helpers {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;

  code {
    padding: 2px 6px;
    border-radius: 4px;
    background: #f1f5f9;
    font-size: 11.5px;
    color: #475569;
  }
}
</style>
