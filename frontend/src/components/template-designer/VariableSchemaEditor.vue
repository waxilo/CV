<script setup lang="ts">
/**
 * 模板变量声明编辑器
 *
 * 模板作者在这里声明对外暴露的可调参数。声明的默认值存在模板里，
 * 用户的实际取值存在简历侧（resume.metadata.templateVars），互不干扰。
 */
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import type { ITemplateConfig, ITemplateVariable, TVariableType } from '/@/types/template';
import { cssVarName as buildCssVarName } from '/@/features/template-renderer';

const props = defineProps<{
  config: ITemplateConfig;
}>();

const emit = defineEmits<{
  (e: 'update:config', value: ITemplateConfig): void;
}>();

const TYPE_OPTIONS: { label: string; value: TVariableType }[] = [
  { label: '颜色', value: 'color' },
  { label: '数字', value: 'number' },
  { label: '长度（带单位）', value: 'length' },
  { label: '文本', value: 'text' },
  { label: '下拉选择', value: 'select' },
  { label: '开关', value: 'boolean' },
];

const variables = computed(() => props.config.variables || []);

function patch(mutator: (list: ITemplateVariable[]) => void) {
  const next = JSON.parse(JSON.stringify(props.config)) as ITemplateConfig;
  next.variables = next.variables || [];
  mutator(next.variables);
  emit('update:config', next);
}

function updateVariable(index: number, key: keyof ITemplateVariable, value: unknown) {
  patch((list) => {
    const target = list[index];
    if (!target) return;
    (target as unknown as Record<string, unknown>)[key] = value;

    // 类型切换时把默认值调整为该类型的合法值
    if (key === 'type') {
      target.default = defaultForType(value as TVariableType);
      if (value === 'select' && !target.options?.length) {
        target.options = [{ label: '选项一', value: 'a' }];
        target.default = 'a';
      }
    }
  });
}

function defaultForType(type: TVariableType): string | number | boolean {
  switch (type) {
    case 'number':
      return 14;
    case 'boolean':
      return false;
    case 'color':
      return '#2563eb';
    case 'length':
      return '16px';
    default:
      return '';
  }
}

function addVariable() {
  const existing = new Set(variables.value.map((v) => v.key));
  let index = variables.value.length + 1;
  let key = `custom${index}`;
  while (existing.has(key)) {
    index += 1;
    key = `custom${index}`;
  }

  patch((list) => {
    list.push({
      key,
      label: '新变量',
      type: 'text',
      default: '',
      group: '自定义',
    });
  });
}

function removeVariable(index: number) {
  patch((list) => {
    list.splice(index, 1);
  });
}

/** options 用「label=value」逐行编辑，比嵌套表单好用 */
function optionsToText(variable: ITemplateVariable): string {
  return (variable.options || []).map((o) => `${o.label}=${o.value}`).join('\n');
}

function updateOptions(index: number, text: string) {
  const options = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const eq = line.indexOf('=');
      if (eq === -1) return { label: line, value: line };
      return { label: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() };
    })
    .filter((o) => o.value !== '');

  patch((list) => {
    const target = list[index];
    if (!target) return;
    target.options = options;
    if (options.length && !options.some((o) => o.value === target.default)) {
      target.default = options[0].value;
    }
  });
}

function onKeyInput(index: number, raw: string) {
  const key = raw.trim();
  if (key && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    ElMessage.warning('变量名需以字母或下划线开头，只能包含字母、数字、下划线');
    return;
  }
  updateVariable(index, 'key', key);
}

function varNameOf(variable: ITemplateVariable): string {
  return buildCssVarName(variable);
}
</script>

<template>
  <div class="schema-editor">
    <div class="head">
      <p class="hint">
        声明模板对外暴露的参数。数字与文本类变量会自动注入为 CSS 变量，开关类只用于模板逻辑分支。
      </p>
      <el-button size="small" type="primary" plain @click="addVariable">添加变量</el-button>
    </div>

    <el-collapse v-if="variables.length" class="list">
      <el-collapse-item v-for="(variable, index) in variables" :key="index" :name="String(index)">
        <template #title>
          <div class="item-title">
            <code>{{ variable.key }}</code>
            <span class="label">{{ variable.label }}</span>
            <el-tag size="small" effect="plain">{{ variable.type }}</el-tag>
          </div>
        </template>

        <el-form label-position="top" size="small" class="form">
          <div class="grid">
            <el-form-item label="变量名（vars.xxx）">
              <el-input
                :model-value="variable.key"
                @update:model-value="(v: string) => onKeyInput(index, v)"
              />
            </el-form-item>
            <el-form-item label="显示名">
              <el-input
                :model-value="variable.label"
                @update:model-value="(v: string) => updateVariable(index, 'label', v)"
              />
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                :model-value="variable.type"
                @update:model-value="(v: TVariableType) => updateVariable(index, 'type', v)"
              >
                <el-option v-for="t in TYPE_OPTIONS" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="分组">
              <el-input
                :model-value="variable.group || ''"
                placeholder="排版 / 配色 / 显示"
                @update:model-value="(v: string) => updateVariable(index, 'group', v)"
              />
            </el-form-item>
          </div>

          <el-form-item label="默认值">
            <el-color-picker
              v-if="variable.type === 'color'"
              :model-value="String(variable.default)"
              @change="(v: string | null) => updateVariable(index, 'default', v || '#000000')"
            />
            <el-switch
              v-else-if="variable.type === 'boolean'"
              :model-value="Boolean(variable.default)"
              @update:model-value="
                (v: boolean | string | number) => updateVariable(index, 'default', Boolean(v))
              "
            />
            <el-input-number
              v-else-if="variable.type === 'number'"
              :model-value="Number(variable.default)"
              :min="variable.min"
              :max="variable.max"
              :step="variable.step || 1"
              @update:model-value="
                (v: number | undefined) => updateVariable(index, 'default', Number(v ?? 0))
              "
            />
            <el-select
              v-else-if="variable.type === 'select'"
              :model-value="String(variable.default)"
              @update:model-value="(v: string) => updateVariable(index, 'default', v)"
            >
              <el-option
                v-for="opt in variable.options || []"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-input
              v-else
              :model-value="String(variable.default)"
              :placeholder="variable.type === 'length' ? '16px / 1.2em' : ''"
              @update:model-value="(v: string) => updateVariable(index, 'default', v)"
            />
          </el-form-item>

          <div v-if="variable.type === 'number'" class="grid">
            <el-form-item label="最小值">
              <el-input-number
                :model-value="variable.min"
                @update:model-value="
                  (v: number | undefined) => updateVariable(index, 'min', v ?? undefined)
                "
              />
            </el-form-item>
            <el-form-item label="最大值">
              <el-input-number
                :model-value="variable.max"
                @update:model-value="
                  (v: number | undefined) => updateVariable(index, 'max', v ?? undefined)
                "
              />
            </el-form-item>
            <el-form-item label="步长">
              <el-input-number
                :model-value="variable.step"
                :step="0.05"
                @update:model-value="
                  (v: number | undefined) => updateVariable(index, 'step', v ?? undefined)
                "
              />
            </el-form-item>
            <el-form-item label="CSS 单位">
              <el-input
                :model-value="variable.unit ?? 'px'"
                placeholder="px，留空表示无单位"
                @update:model-value="(v: string) => updateVariable(index, 'unit', v)"
              />
            </el-form-item>
          </div>

          <el-form-item v-if="variable.type === 'select'" label="候选项（每行一个，格式：显示名=值）">
            <el-input
              type="textarea"
              :rows="4"
              :model-value="optionsToText(variable)"
              placeholder="2022.03=YYYY.MM"
              @update:model-value="(v: string) => updateOptions(index, v)"
            />
          </el-form-item>

          <div class="footer">
            <span class="css-var">
              CSS 变量：<code>var({{ varNameOf(variable) }})</code>
            </span>
            <el-button size="small" type="danger" plain @click="removeVariable(index)">删除</el-button>
          </div>
        </el-form>
      </el-collapse-item>
    </el-collapse>

    <el-empty v-else description="还没有声明任何变量" :image-size="56" />
  </div>
</template>

<style scoped lang="scss">
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cv-muted);
}

.item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  code {
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 12.5px;
    color: #2563eb;
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    color: var(--cv-muted);
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--cv-border);
}

.css-var {
  font-size: 12px;
  color: var(--cv-muted);

  code {
    font-family: ui-monospace, Menlo, Consolas, monospace;
    color: #0f766e;
  }
}
</style>
