/**
 * 从渲染上下文自动生成变量树
 *
 * 现状痛点是「可用变量只能翻源码」，这里直接用示例数据构建一次真实的
 * IRenderContext，再反射出树结构与实际取值，保证文档与实现不会漂移。
 */

import type { IRenderContext } from '/@/features/template-renderer';

export type TVarKind = 'object' | 'array' | 'value';

export interface IVarNode {
  /** el-tree 的唯一 key */
  id: string;
  label: string;
  /** 模板中的取值路径 */
  path: string;
  kind: TVarKind;
  /** 实际取值的简短预览 */
  preview: string;
  /** 点击后插入编辑器的片段 */
  snippet: string;
  children?: IVarNode[];
}

/** 不暴露给模板作者的键 */
const HIDDEN_KEYS = new Set(['helpers', 'contextVersion']);

const MAX_DEPTH = 4;

function previewOf(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') {
    if (value === '') return '（空）';
    return value.length > 28 ? `"${value.slice(0, 28)}…"` : `"${value}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} 项`;
  if (typeof value === 'object') return '对象';
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 以 Safe 结尾的字段需要用 {{& }} 输出 */
function snippetForValue(path: string): string {
  const last = path.split('.').pop() || '';
  return last.endsWith('Safe') ? `{{& ${path}}}` : `{{${path}}}`;
}

function snippetForArray(path: string): string {
  return `{{#each ${path}}}\n  \n{{/each}}`;
}

function buildNode(
  key: string,
  value: unknown,
  path: string,
  idPrefix: string,
  depth: number
): IVarNode {
  const id = `${idPrefix}/${key}`;

  if (Array.isArray(value)) {
    const sample = value[0];
    const children: IVarNode[] = [];

    if (depth < MAX_DEPTH && isPlainObject(sample)) {
      for (const [childKey, childValue] of Object.entries(sample)) {
        if (HIDDEN_KEYS.has(childKey)) continue;
        // 在 each 内部，字段要通过 this. 访问
        children.push(buildNode(childKey, childValue, `this.${childKey}`, id, depth + 1));
      }
    }

    return {
      id,
      label: `${key}[]`,
      path,
      kind: 'array',
      preview: previewOf(value),
      snippet: snippetForArray(path),
      children: children.length ? children : undefined,
    };
  }

  if (isPlainObject(value)) {
    const children: IVarNode[] = [];

    if (depth < MAX_DEPTH) {
      for (const [childKey, childValue] of Object.entries(value)) {
        if (HIDDEN_KEYS.has(childKey)) continue;
        children.push(buildNode(childKey, childValue, `${path}.${childKey}`, id, depth + 1));
      }
    }

    return {
      id,
      label: key,
      path,
      kind: 'object',
      preview: previewOf(value),
      snippet: `{{#with ${path}}}\n  \n{{/with}}`,
      children: children.length ? children : undefined,
    };
  }

  return {
    id,
    label: key,
    path,
    kind: 'value',
    preview: previewOf(value),
    snippet: snippetForValue(path),
  };
}

/**
 * 生成变量树
 */
export function buildVariableTree(context: IRenderContext): IVarNode[] {
  const nodes: IVarNode[] = [];

  for (const [key, value] of Object.entries(context)) {
    if (HIDDEN_KEYS.has(key)) continue;
    nodes.push(buildNode(key, value, key, 'root', 1));
  }

  return nodes;
}

/** 循环内可用的特殊变量 */
export const LOOP_VARIABLES: { path: string; label: string; snippet: string }[] = [
  { path: 'this', label: '当前条目', snippet: '{{this.title}}' },
  { path: '@index', label: '序号（从 0 开始）', snippet: '{{@index}}' },
  { path: '@number', label: '序号（从 1 开始）', snippet: '{{@number}}' },
  { path: '@first', label: '是否首项', snippet: '{{#if @first}}{{/if}}' },
  { path: '@last', label: '是否末项', snippet: '{{#if @last}}{{/if}}' },
  { path: '@length', label: '总数', snippet: '{{@length}}' },
];

/** 常用语法片段 */
export const SYNTAX_SNIPPETS: { label: string; snippet: string }[] = [
  { label: '条件', snippet: '{{#if cond}}\n  \n{{/if}}' },
  { label: '条件 + 否则', snippet: '{{#if cond}}\n  \n{{else}}\n  \n{{/if}}' },
  { label: '反向条件', snippet: '{{#unless cond}}\n  \n{{/unless}}' },
  { label: '循环', snippet: '{{#each list}}\n  \n{{/each}}' },
  { label: '作用域', snippet: '{{#with obj}}\n  \n{{/with}}' },
  { label: '注释', snippet: '{{! 说明 }}' },
  {
    label: '只取某些模块',
    snippet: "{{#each sections | only('experience', 'education')}}\n  \n{{/each}}",
  },
  {
    label: '排除某些模块',
    snippet: "{{#each sections | exclude('skills')}}\n  \n{{/each}}",
  },
  { label: '日期格式化', snippet: "{{this.raw.startDate | date('YYYY.MM')}}" },
  { label: '空值兜底', snippet: "{{basics.name | default('你的姓名')}}" },
];
