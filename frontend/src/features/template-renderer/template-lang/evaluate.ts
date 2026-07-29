/**
 * 模板求值：AST + 上下文 → HTML 字符串
 *
 * 求值器不执行任何用户代码：过滤器只能命中 HELPERS 白名单，
 * 路径解析禁止 __proto__ / constructor / prototype。
 */

import { TEMPLATE_LIMITS } from '@cv/template-schema';
import { escapeHtml, HELPERS, RAW_SAFE_HELPERS, SafeHtml } from '../helpers';
import {
  TemplateRuntimeError,
  type IExpr,
  type INodeBlock,
  type TArg,
  type TNode,
} from './ast';

/* ============================================================
 * 作用域
 * ============================================================ */

interface IFrame {
  value: unknown;
  index?: number;
  first?: boolean;
  last?: boolean;
  length?: number;
}

interface IScope {
  root: Record<string, unknown>;
  frames: IFrame[];
}

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getByPath(target: unknown, segments: string[]): unknown {
  let current = target;
  for (const segment of segments) {
    if (current == null) return undefined;
    if (FORBIDDEN_SEGMENTS.has(segment)) return undefined;
    if (typeof current !== 'object' && typeof current !== 'function') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** 找到最近一个带迭代信息的 frame */
function findIterationFrame(scope: IScope): IFrame | undefined {
  for (let i = scope.frames.length - 1; i >= 0; i--) {
    if (scope.frames[i].index !== undefined) return scope.frames[i];
  }
  return undefined;
}

function innermostValue(scope: IScope): unknown {
  return scope.frames.length ? scope.frames[scope.frames.length - 1].value : scope.root;
}

/**
 * 路径解析。查找顺序与 Mustache 一致：
 * 由内层 frame 向外层回退，最后落到 root。
 */
export function resolvePath(path: string, scope: IScope): unknown {
  if (path === '.' || path === 'this') return innermostValue(scope);

  if (path.startsWith('@')) {
    const frame = findIterationFrame(scope);
    if (!frame) return undefined;
    switch (path) {
      case '@index':
        return frame.index;
      case '@number':
        return (frame.index ?? 0) + 1;
      case '@first':
        return frame.first;
      case '@last':
        return frame.last;
      case '@length':
        return frame.length;
      default:
        return undefined;
    }
  }

  const segments = path.split('.');

  if (segments[0] === 'this') {
    return getByPath(innermostValue(scope), segments.slice(1));
  }

  const head = segments[0];

  // 内层 frame 优先
  for (let i = scope.frames.length - 1; i >= 0; i--) {
    const value = scope.frames[i].value;
    if (isPlainObject(value) && head in value) {
      return getByPath(value, segments);
    }
  }

  return getByPath(scope.root, segments);
}

/* ============================================================
 * 表达式求值
 * ============================================================ */

function evalArg(arg: TArg, scope: IScope): unknown {
  return arg.kind === 'literal' ? arg.value : resolvePath(arg.path, scope);
}

export function evalExpr(expr: IExpr, scope: IScope, line?: number): unknown {
  let value = resolvePath(expr.path, scope);

  for (const filter of expr.filters) {
    const fn = HELPERS[filter.name];
    if (!fn) {
      throw new TemplateRuntimeError(`未知过滤器「${filter.name}」`, line);
    }
    const args = filter.args.map((a) => evalArg(a, scope));
    try {
      value = fn(value, ...args);
    } catch (e) {
      throw new TemplateRuntimeError(
        `过滤器「${filter.name}」执行失败：${e instanceof Error ? e.message : String(e)}`,
        line
      );
    }
  }

  return value;
}

/**
 * 真值判定。与 JS 的差别：
 *   - 空数组算 false（模板里 {{#if list}} 更符合直觉）
 *   - 数字 0 算 true（level=0 是有效取值）
 */
export function truthy(value: unknown): boolean {
  if (value == null || value === false) return false;
  if (value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof SafeHtml) return value.value !== '';
  return true;
}

/* ============================================================
 * 原样输出的准入判定
 * ============================================================ */

function resolveRawOutput(expr: IExpr, value: unknown, line?: number): string {
  if (value instanceof SafeHtml) return value.value;

  const lastFilter = expr.filters.length ? expr.filters[expr.filters.length - 1].name : '';
  if (lastFilter && RAW_SAFE_HELPERS.has(lastFilter)) {
    return value == null ? '' : String(value);
  }

  const lastSegment = expr.path.split('.').pop() || '';
  if (lastSegment.endsWith('Safe')) {
    return value == null ? '' : String(value);
  }

  throw new TemplateRuntimeError(
    `{{& ${expr.source}}} 不允许原样输出：只能用于以 Safe 结尾的字段（如 descriptionSafe）或 nl2br 的输出`,
    line
  );
}

/* ============================================================
 * 渲染
 * ============================================================ */

function renderNodes(nodes: TNode[], scope: IScope, out: string[]): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        out.push(node.value);
        break;

      case 'interp': {
        const value = evalExpr(node.expr, scope, node.line);
        if (node.raw) {
          out.push(resolveRawOutput(node.expr, value, node.line));
        } else if (value != null && value !== false) {
          out.push(escapeHtml(value));
        }
        break;
      }

      case 'block':
        renderBlock(node, scope, out);
        break;
    }
  }
}

function iterate(node: INodeBlock, list: unknown[], scope: IScope, out: string[]): void {
  const limit = Math.min(list.length, TEMPLATE_LIMITS.maxIterations);
  for (let i = 0; i < limit; i++) {
    scope.frames.push({
      value: list[i],
      index: i,
      first: i === 0,
      last: i === limit - 1,
      length: limit,
    });
    renderNodes(node.children, scope, out);
    scope.frames.pop();
  }
}

function renderBlock(node: INodeBlock, scope: IScope, out: string[]): void {
  const value = evalExpr(node.expr, scope, node.line);

  switch (node.tag) {
    case 'if':
      renderNodes(truthy(value) ? node.children : node.alt, scope, out);
      return;

    case 'unless':
      renderNodes(truthy(value) ? node.alt : node.children, scope, out);
      return;

    case 'each': {
      if (Array.isArray(value) && value.length > 0) {
        iterate(node, value, scope, out);
      } else {
        renderNodes(node.alt, scope, out);
      }
      return;
    }

    case 'with': {
      if (truthy(value)) {
        scope.frames.push({ value });
        renderNodes(node.children, scope, out);
        scope.frames.pop();
      } else {
        renderNodes(node.alt, scope, out);
      }
      return;
    }

    case 'inverted':
      renderNodes(truthy(value) ? node.alt : node.children, scope, out);
      return;

    case 'auto': {
      // Mustache 兼容：数组迭代 / 对象切换作用域 / 其他真值直接渲染
      if (Array.isArray(value)) {
        if (value.length > 0) iterate(node, value, scope, out);
        else renderNodes(node.alt, scope, out);
        return;
      }
      if (!truthy(value)) {
        renderNodes(node.alt, scope, out);
        return;
      }
      if (isPlainObject(value)) {
        scope.frames.push({ value });
        renderNodes(node.children, scope, out);
        scope.frames.pop();
      } else {
        renderNodes(node.children, scope, out);
      }
      return;
    }
  }
}

/**
 * 渲染 AST
 */
export function renderAst(ast: TNode[], data: Record<string, unknown>): string {
  const out: string[] = [];
  renderNodes(ast, { root: data, frames: [] }, out);
  return out.join('');
}
