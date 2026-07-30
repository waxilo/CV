import { describe, expect, it } from 'vitest';
import { getBuiltinTemplate } from '@cv/template-schema';
import {
  buildRenderContext,
  createSampleResumeData,
  normalizeTemplateConfig,
} from '/@/features/template-renderer';
import { buildVariableTree, type IVarNode } from '../variableTree';

const config = normalizeTemplateConfig(getBuiltinTemplate('modern')?.config);
const context = buildRenderContext(createSampleResumeData(), config);
const tree = buildVariableTree(context, { variables: config.variables, scope: 'all' });

function findIn(roots: IVarNode[], path: string[]): IVarNode | undefined {
  let nodes: IVarNode[] | undefined = roots;
  let node: IVarNode | undefined;
  for (const key of path) {
    node = nodes?.find((n) => n.label === key);
    if (!node) return undefined;
    nodes = node.children;
  }
  return node;
}

function find(path: string[]): IVarNode | undefined {
  return findIn(tree, path);
}

describe('buildVariableTree 别名', () => {
  it('顶层节点带中文别名', () => {
    expect(find(['basics'])?.alias).toBe('基本信息');
    expect(find(['sections[]'])?.alias).toContain('简历模块');
    expect(find(['s'])?.alias).toContain('按类型');
    expect(find(['page'])?.alias).toBe('页面设置');
  });

  it('基本信息字段带别名', () => {
    expect(find(['basics', 'name'])?.alias).toBe('姓名');
    expect(find(['basics', 'headline'])?.alias).toBe('求职方向');
    expect(find(['basics', 'initial'])?.alias).toContain('首字');
  });

  it('归一化条目字段带别名 —— 这些字段名最难猜', () => {
    const items = find(['sections[]', 'items[]']);
    expect(items?.alias).toBe('条目列表');
    expect(items?.children?.find((n) => n.label === 'title')?.alias).toBe('主标题');
    expect(items?.children?.find((n) => n.label === 'subtitle')?.alias).toBe('副标题');
    expect(items?.children?.find((n) => n.label === 'meta')?.alias).toBe('补充信息');
    expect(items?.children?.find((n) => n.label === 'dateRange')?.alias).toBe('时间区间');
    expect(items?.children?.find((n) => n.label === 'descriptionSafe')?.alias).toContain('HTML');
  });

  it('raw 之下用简历原始字段的别名', () => {
    const raw = find(['sections[]', 'items[]', 'raw']);
    expect(raw?.alias).toContain('原始字段');
    expect(raw?.children?.find((n) => n.label === 'company')?.alias).toBe('公司名称');
    expect(raw?.children?.find((n) => n.label === 'position')?.alias).toBe('职位');
    expect(raw?.children?.find((n) => n.label === 'startDate')?.alias).toBe('开始时间');
  });

  it('s.<type> 显示模块类型的中文名', () => {
    const s = find(['s']);
    expect(s?.children?.find((n) => n.label === 'experience')?.alias).toBe('工作经历');
    expect(s?.children?.find((n) => n.label === 'education')?.alias).toBe('教育经历');
    expect(s?.children?.find((n) => n.label === 'skills')?.alias).toBe('专业技能');
  });

  it('s 下补齐示例数据里没有的模块类型，并标注出来', () => {
    const s = find(['s']);
    // 示例数据现在覆盖了 9 种真实模块，custom 仍然缺失，靠字典补齐
    const custom = s?.children?.find((n) => n.label === 'custom');
    expect(custom?.alias).toBe('自定义模块');
    expect(custom?.preview).toContain('暂无');
    // 补齐的节点仍然可以展开看字段结构
    expect(custom?.children?.find((n) => n.label === 'items[]')?.alias).toBe('条目列表');

    // 示例里存在的模块不该被标注
    expect(s?.children?.find((n) => n.label === 'experience')?.preview).not.toContain('暂无');
    expect(s?.children?.find((n) => n.label === 'awards')?.preview).not.toContain('暂无');
  });

  it('s.<type> 的子字段复用 sections 的别名，不必为 11 种模块各写一份', () => {
    const experience = find(['s', 'experience']);
    expect(experience?.children?.find((n) => n.label === 'name')?.alias).toBe('模块标题');
    const items = experience?.children?.find((n) => n.label === 'items[]');
    expect(items?.alias).toBe('条目列表');
    expect(items?.children?.find((n) => n.label === 'title')?.alias).toBe('主标题');
  });

  it('vars.<key> 用模板作者写的 label', () => {
    const vars = find(['vars']);
    expect(vars?.children?.find((n) => n.label === 'primaryColor')?.alias).toBe('主色');
    expect(vars?.children?.find((n) => n.label === 'fontSize')?.alias).toBe('正文字号');
    expect(vars?.children?.find((n) => n.label === 'showAvatar')?.alias).toBe('显示头像');
  });

  it('每个节点都有别名，不留空白', () => {
    const missing: string[] = [];
    const walk = (nodes: IVarNode[]) => {
      for (const node of nodes) {
        if (!node.alias) missing.push(node.path);
        if (node.children) walk(node.children);
      }
    };
    walk(tree);
    expect(missing).toEqual([]);
  });
});

describe('buildVariableTree 默认范围', () => {
  const current = buildVariableTree(context, { variables: config.variables });

  it('顶层直接是各模块，不再套一层 s，标签就是变量名', () => {
    const labels = current.map((n) => n.label);
    expect(labels).toContain('s.experience');
    expect(labels).toContain('s.education');
    expect(labels.every((l) => l.startsWith('s.'))).toBe(true);
  });

  it('只有示例数据里真实存在的模块，不再补齐', () => {
    const labels = current.map((n) => n.label);
    // 示例数据现在覆盖了 9 种模块，custom 是唯一没有示例数据、也不会被补齐的类型
    expect(labels).not.toContain('s.custom');
    expect(labels).toContain('s.awards');
    expect(labels).toContain('s.certificates');
  });

  it('顶层模块保留中文别名', () => {
    expect(current.find((n) => n.label === 's.experience')?.alias).toBe('工作经历');
  });

  it('模块字段仍带别名与可复制路径', () => {
    const title = findIn(current, ['s.experience', 'items[]', 'title']);
    expect(title?.alias).toBe('主标题');
    expect(title?.path).toBe('this.title');
    expect(findIn(current, ['s.experience'])?.path).toBe('s.experience');
  });
});

describe('buildVariableTree 插入路径', () => {
  it('数组内部字段用 this. 前缀，顶层字段用完整路径', () => {
    expect(find(['basics', 'name'])?.path).toBe('basics.name');
    expect(find(['sections[]', 'items[]'])?.path).toBe('this.items');
    expect(find(['sections[]', 'items[]'])?.children?.find((n) => n.label === 'title')?.path).toBe(
      'this.title'
    );
  });

  it('Safe 字段的插入片段用 {{& }}', () => {
    const items = find(['sections[]', 'items[]']);
    const safe = items?.children?.find((n) => n.label === 'descriptionSafe');
    expect(safe?.snippet).toBe('{{& this.descriptionSafe}}');

    const plain = items?.children?.find((n) => n.label === 'title');
    expect(plain?.snippet).toBe('{{this.title}}');
  });

  it('数组节点插入 each 循环', () => {
    expect(find(['sections[]'])?.snippet).toContain('{{#each sections}}');
  });
});
