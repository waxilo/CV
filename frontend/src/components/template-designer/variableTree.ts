/**
 * 从渲染上下文自动生成变量树
 *
 * 现状痛点是「可用变量只能翻源码」，这里直接用示例数据构建一次真实的
 * IRenderContext，再反射出树结构与实际取值，保证文档与实现不会漂移。
 *
 * 每个节点同时给出中文别名：模板作者看到的是「姓名 / name」而不是光秃秃的 name，
 * 否则面对 subtitle、meta、contentSafe 这类归一化字段根本猜不出装的是什么。
 */

import type { ITemplateVariable } from '/@/types/template';
import type { IRenderContext } from '/@/features/template-renderer';

export type TVarKind = 'object' | 'array' | 'value';

export interface IVarNode {
  /** el-tree 的唯一 key */
  id: string;
  /** 字段名（英文），插入模板时用的那个 */
  label: string;
  /** 中文别名，说明这个字段装的是什么 */
  alias: string;
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

/* ============================================================
 * 别名字典
 * ============================================================ */

/**
 * 语义路径 → 中文别名。
 *
 * 「语义路径」是节点在契约中的位置（如 sections.items.title），
 * 与插入用的路径（在 each 内部是 this.title）不同，因此单独维护。
 */
const LABELS: Record<string, string> = {
  /* 基本信息 */
  basics: '基本信息',
  'basics.name': '姓名',
  'basics.headline': '求职方向',
  'basics.email': '邮箱',
  'basics.phone': '电话',
  'basics.location': '所在地',
  'basics.url': '个人主页',
  'basics.avatarUrl': '头像地址',
  'basics.birthDate': '出生日期',
  'basics.graduationDate': '毕业日期',
  'basics.gender': '性别',
  'basics.age': '年龄',
  'basics.workYears': '工作年限',
  'basics.wechat': '微信',
  'basics.demographics': '性别/年龄/工作年限组合行',
  'basics.initial': '姓名首字（头像占位用）',
  'basics.contacts': '联系方式列表（已过滤空值）',
  'basics.contacts.key': '字段标识',
  'basics.contacts.label': '标签文字',
  'basics.contacts.value': '显示内容',
  'basics.contacts.href': '可点击链接',

  /* 模块列表 */
  sections: '简历模块列表（已排序、已去掉隐藏项）',
  'sections.id': '模块 ID',
  'sections.type': '模块类型',
  'sections.name': '模块标题',
  'sections.isText': '是否自由文本模块',
  'sections.content': '正文（纯文本）',
  'sections.contentSafe': '正文（可安全输出的 HTML）',
  'sections.isEmpty': '该模块是否为空',
  'sections.items': '条目列表',
  'sections.items.id': '条目 ID',
  'sections.items.index': '序号（从 0 开始）',
  'sections.items.title': '主标题',
  'sections.items.subtitle': '副标题',
  'sections.items.meta': '补充信息',
  'sections.items.dateRange': '时间区间',
  'sections.items.description': '描述（纯文本）',
  'sections.items.descriptionSafe': '描述（可安全输出的 HTML）',
  'sections.items.keywords': '关键词标签',
  'sections.items.raw': '原始字段（该模块类型专属）',

  /* 索引与变量 */
  s: '按类型取模块（如 s.experience）',
  vars: '模板变量的当前取值',

  /* 页面 */
  page: '页面设置',
  'page.format': '纸张规格',
  'page.widthMm': '页宽（毫米）',
  'page.heightMm': '页高（毫米）',
  'page.margin': '页边距（毫米）',
  'page.margin.top': '上边距',
  'page.margin.right': '右边距',
  'page.margin.bottom': '下边距',
  'page.margin.left': '左边距',

  /* 元信息 */
  meta: '元信息',
  'meta.templateId': '当前模板 ID',
  'meta.generatedAt': '渲染时间',
};

/** 模块类型的中文名，用于 s.<type> 这一层 */
const SECTION_TYPE_LABELS: Record<string, string> = {
  basics: '基本信息',
  summary: '个人简介',
  experience: '工作经历',
  education: '教育经历',
  skills: '专业技能',
  projects: '项目经历',
  languages: '语言能力',
  certificates: '证书资质',
  awards: '荣誉奖项',
  interests: '兴趣爱好',
  custom: '自定义模块',
};

/**
 * 简历原始字段的中文名，用于 raw 之下那一层。
 * 这些是用户在编辑器里实际填写的字段，按字段名匹配而不按路径。
 */
const RAW_FIELD_LABELS: Record<string, string> = {
  id: '条目 ID',
  visible: '是否显示',
  company: '公司名称',
  position: '职位',
  location: '地点',
  startDate: '开始时间',
  endDate: '结束时间',
  isCurrent: '是否至今',
  description: '描述',
  school: '学校',
  degree: '学历',
  major: '专业',
  name: '名称',
  level: '熟练度 / 等级',
  keywords: '关键词',
  url: '链接',
  issuer: '颁发机构',
  awarder: '颁发机构',
  date: '日期',
  title: '标题',
  subtitle: '副标题',
  summary: '概述',
  role: '角色',
};

/* ============================================================
 * 预览
 * ============================================================ */

function previewOf(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') {
    if (value === '') return '（空）';
    return value.length > 24 ? `"${value.slice(0, 24)}…"` : `"${value}"`;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return `${value.length} 项`;
  if (typeof value === 'object') return '对象';
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 给对象打「信息量」分，用于挑选数组的结构样本。
 * 非空的嵌套数组权重最高 —— 它决定了子树能不能展开。
 */
function richnessOf(obj: Record<string, unknown>): number {
  let score = Object.keys(obj).length;
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      if (value.length > 0) score += 5;
    } else if (isPlainObject(value)) {
      score += 2;
    } else if (typeof value === 'string' && value !== '') {
      score += 1;
    }
  }
  return score;
}

/**
 * 挑选数组的结构样本。
 *
 * 不能简单取 [0]：sections 排序后第一项通常是「个人简介」，它的 items 是空数组，
 * 用它取样会导致整棵条目字段子树展不开。这里选结构最完整的那一项。
 */
function pickSample(list: unknown[]): Record<string, unknown> | undefined {
  let best: Record<string, unknown> | undefined;
  let bestScore = -1;

  for (const item of list) {
    if (!isPlainObject(item)) continue;
    const score = richnessOf(item);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return best;
}

/** 以 Safe 结尾的字段需要用 {{& }} 输出 */
function snippetForValue(path: string): string {
  const last = path.split('.').pop() || '';
  return last.endsWith('Safe') ? `{{& ${path}}}` : `{{${path}}}`;
}

function snippetForArray(path: string): string {
  return `{{#each ${path}}}\n  \n{{/each}}`;
}

/* ============================================================
 * 别名解析
 * ============================================================ */

interface IBuildContext {
  /** 模板声明的变量，用于给 vars.* 取 label */
  variables: ITemplateVariable[];
  /** s 之下由字典补齐、但示例数据里并不存在的模块类型 */
  syntheticSectionTypes: Set<string>;
}

/**
 * 解析节点的中文别名。
 *
 * @param semanticPath 节点自身的语义路径
 * @param parentPath   父节点的语义路径
 * @param key          字段名
 */
function aliasFor(
  semanticPath: string,
  parentPath: string,
  key: string,
  ctx: IBuildContext
): string {
  // vars 之下：用模板作者自己写的 label
  if (parentPath === 'vars') {
    const variable = ctx.variables.find((v) => v.key === key);
    if (variable?.label) return variable.label;
    return '模板变量';
  }

  // s 之下：这一层的 key 是模块类型
  if (parentPath === 's') {
    return SECTION_TYPE_LABELS[key] || '模块';
  }

  const known = LABELS[semanticPath];
  if (known) return known;

  // raw 之下：简历原始字段
  if (parentPath.endsWith('.raw') || parentPath === 'raw') {
    return RAW_FIELD_LABELS[key] || '原始字段';
  }

  return '';
}

/**
 * 规范化语义路径。
 *
 * `s.experience` 这一层等价于 sections 的一个元素，把它折叠成 `sections`，
 * 这样它下面的字段可以直接复用 sections.* 的别名，不必为 11 种模块各写一份。
 */
function semanticChildPath(parentSemantic: string, childKey: string): string {
  if (parentSemantic === 's') return 'sections';
  return `${parentSemantic}.${childKey}`;
}

/* ============================================================
 * 构建
 * ============================================================ */

function buildNode(
  key: string,
  value: unknown,
  path: string,
  semanticPath: string,
  parentSemantic: string,
  idPrefix: string,
  depth: number,
  ctx: IBuildContext
): IVarNode {
  const id = `${idPrefix}/${key}`;
  const alias = aliasFor(semanticPath, parentSemantic, key, ctx);
  const isSynthetic = parentSemantic === 's' && ctx.syntheticSectionTypes.has(key);

  if (Array.isArray(value)) {
    const sample = pickSample(value);
    const children: IVarNode[] = [];

    if (depth < MAX_DEPTH && sample) {
      for (const [childKey, childValue] of Object.entries(sample)) {
        if (HIDDEN_KEYS.has(childKey)) continue;
        // 在 each 内部，字段要通过 this. 访问
        children.push(
          buildNode(
            childKey,
            childValue,
            `this.${childKey}`,
            `${semanticPath}.${childKey}`,
            semanticPath,
            id,
            depth + 1,
            ctx
          )
        );
      }
    }

    return {
      id,
      label: `${key}[]`,
      alias,
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
        children.push(
          buildNode(
            childKey,
            childValue,
            `${path}.${childKey}`,
            semanticChildPath(semanticPath, childKey),
            semanticPath,
            id,
            depth + 1,
            ctx
          )
        );
      }
    }

    return {
      id,
      label: key,
      alias,
      path,
      kind: 'object',
      preview: isSynthetic ? '示例数据中暂无' : previewOf(value),
      snippet: `{{#with ${path}}}\n  \n{{/with}}`,
      children: children.length ? children : undefined,
    };
  }

  return {
    id,
    label: key,
    alias,
    path,
    kind: 'value',
    preview: previewOf(value),
    snippet: snippetForValue(path),
  };
}

/**
 * 树的展示范围。
 *
 * current：只给出示例数据里真实存在的 s.*，面板短、一眼能扫完；
 * all：完整上下文（basics / sections / vars / page / meta），并按字典补齐所有模块类型。
 */
export type TTreeScope = 'current' | 'all';

export interface IBuildTreeOptions {
  /** 模板声明的变量，用于给 vars.* 显示模板作者写的 label */
  variables?: ITemplateVariable[];
  /** 缺省 current */
  scope?: TTreeScope;
}

/**
 * 生成变量树
 */
export function buildVariableTree(
  context: IRenderContext,
  options: IBuildTreeOptions = {}
): IVarNode[] {
  const variables = options.variables || [];

  if ((options.scope || 'current') === 'current') {
    const ctx: IBuildContext = { variables, syntheticSectionTypes: new Set() };
    const root = buildNode('s', currentSectionIndex(context), 's', 's', '', 'root', 1, ctx);
    // 不展示 s 这一层，直接把各模块提到顶层；标签换成完整路径，看到的就是要写的变量名
    return (root.children || []).map((node) => ({ ...node, label: node.path }));
  }

  const { s, syntheticTypes } = enrichSectionIndex(context);

  const ctx: IBuildContext = {
    variables,
    syntheticSectionTypes: syntheticTypes,
  };

  const nodes: IVarNode[] = [];

  for (const [key, value] of Object.entries(context)) {
    if (HIDDEN_KEYS.has(key)) continue;
    // s 用补齐后的版本，让 11 种模块类型都可见
    nodes.push(buildNode(key, key === 's' ? s : value, key, key, '', 'root', 1, ctx));
  }

  return nodes;
}

/**
 * 当前模块索引：示例数据里真实存在的那几个模块，去掉 undefined 占位。
 */
function currentSectionIndex(context: IRenderContext): Record<string, unknown> {
  const s: Record<string, unknown> = {};
  for (const [type, value] of Object.entries(context.s as Record<string, unknown>)) {
    if (value) s[type] = value;
  }
  return s;
}

/**
 * 补齐 s 索引。
 *
 * 示例数据只有 5 个模块，但 s.awards、s.certificates 这些路径同样合法。
 * 如果树里看不到，模板作者就不知道能用。这里按模块类型字典补齐，
 * 缺失的用结构最完整的那个模块做字段结构，预览标注为「示例数据中暂无」。
 */
function enrichSectionIndex(context: IRenderContext): {
  s: Record<string, unknown>;
  syntheticTypes: Set<string>;
} {
  const structureSample = pickSample(context.sections as unknown as unknown[]);
  const s: Record<string, unknown> = {};
  const syntheticTypes = new Set<string>();

  for (const type of Object.keys(SECTION_TYPE_LABELS)) {
    const existing = (context.s as Record<string, unknown>)[type];
    if (existing) {
      s[type] = existing;
    } else if (structureSample) {
      s[type] = structureSample;
      syntheticTypes.add(type);
    }
  }

  // 示例数据里出现了字典之外的类型（比如自定义 type），也保留
  for (const [type, value] of Object.entries(context.s as Record<string, unknown>)) {
    if (value && !(type in s)) s[type] = value;
  }

  return { s, syntheticTypes };
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

export { SECTION_TYPE_LABELS, RAW_FIELD_LABELS };
