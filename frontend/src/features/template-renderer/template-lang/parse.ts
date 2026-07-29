/**
 * 模板语法解析：源码 → AST
 *
 * 支持的语法：
 *   {{path}}                        转义插值
 *   {{& path}}                      受控原样输出（仅 *Safe 字段或 nl2br 输出）
 *   {{! 注释 }}                     注释
 *   {{#if cond}}…{{else}}…{{/if}}   条件
 *   {{#unless cond}}…{{/unless}}    反向条件
 *   {{#each list}}…{{/each}}        循环，内部可用 this / @index / @first / @last
 *   {{#with obj}}…{{/with}}         作用域切换
 *   {{#key}}…{{/key}}               Mustache 兼容：数组迭代 / 对象切换 / 真值判断
 *   {{^key}}…{{/key}}               Mustache 兼容：反向
 *   {{x | date('YYYY.MM')}}         过滤器链（白名单）
 *
 * 明确禁止：
 *   {{{ }}}  三花括号原始输出
 */

import { TEMPLATE_LIMITS } from '@cv/template-schema';
import { isKnownHelper, listHelperNames } from '../helpers';
import {
  TemplateSyntaxError,
  type IExpr,
  type IFilterCall,
  type INodeBlock,
  type TArg,
  type TBlockTag,
  type TNode,
} from './ast';

const RESERVED_TAGS = new Set<TBlockTag>(['if', 'unless', 'each', 'with']);
const PATH_RE = /^(\.|@?[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z0-9_$]+)*)$/;
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/* ============================================================
 * 词法：切出所有 {{...}}
 * ============================================================ */

interface IRawTag {
  inner: string;
  start: number;
  end: number;
  line: number;
}

function tokenize(source: string): { tags: IRawTag[]; text: string } {
  const tags: IRawTag[] = [];
  let pos = 0;
  let line = 1;

  while (pos < source.length) {
    const open = source.indexOf('{{', pos);
    if (open === -1) break;

    // 统计换行推进行号
    for (let i = pos; i < open; i++) {
      if (source[i] === '\n') line += 1;
    }

    if (source.startsWith('{{{', open)) {
      throw new TemplateSyntaxError(
        '禁止三花括号原始输出，请改用 {{& field}} 输出受信 HTML',
        line,
        source.slice(open, open + 20)
      );
    }

    // 记录标签起始行；下面扫描标签内部时 line 会继续推进
    const tagLine = line;

    // 找 }}，跳过字符串内部
    let cursor = open + 2;
    let quote: string | null = null;
    let close = -1;
    while (cursor < source.length) {
      const ch = source[cursor];
      if (quote) {
        if (ch === '\\') {
          cursor += 2;
          continue;
        }
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '}' && source[cursor + 1] === '}') {
        close = cursor;
        break;
      } else if (ch === '\n') {
        line += 1;
      }
      cursor += 1;
    }

    if (close === -1) {
      throw new TemplateSyntaxError('存在未闭合的 {{', tagLine, source.slice(open, open + 20));
    }

    tags.push({
      inner: source.slice(open + 2, close),
      start: open,
      end: close + 2,
      line: tagLine,
    });
    pos = close + 2;
  }

  return { tags, text: source };
}

/* ============================================================
 * 表达式解析
 * ============================================================ */

/** 按顶层分隔符切分，忽略引号与括号内部 */
function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      current += ch;
      if (ch === '\\' && i + 1 < input.length) {
        current += input[i + 1];
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function parseArg(raw: string, line: number): TArg {
  const text = raw.trim();
  if (!text) throw new TemplateSyntaxError('过滤器参数为空', line);

  if (
    (text.startsWith("'") && text.endsWith("'") && text.length >= 2) ||
    (text.startsWith('"') && text.endsWith('"') && text.length >= 2)
  ) {
    return { kind: 'literal', value: text.slice(1, -1).replace(/\\(['"\\])/g, '$1') };
  }
  if (text === 'true') return { kind: 'literal', value: true };
  if (text === 'false') return { kind: 'literal', value: false };
  if (text === 'null') return { kind: 'literal', value: null };

  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return { kind: 'literal', value: Number(text) };
  }

  validatePath(text, line);
  return { kind: 'path', path: text };
}

function parseFilter(raw: string, line: number): IFilterCall {
  const text = raw.trim();
  const open = text.indexOf('(');

  let name: string;
  let args: TArg[] = [];

  if (open === -1) {
    name = text;
  } else {
    if (!text.endsWith(')')) {
      throw new TemplateSyntaxError(`过滤器「${text}」缺少右括号`, line);
    }
    name = text.slice(0, open).trim();
    const argsText = text.slice(open + 1, -1).trim();
    if (argsText) {
      args = splitTopLevel(argsText, ',').map((a) => parseArg(a, line));
    }
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new TemplateSyntaxError(`过滤器名「${name}」不合法`, line);
  }
  if (!isKnownHelper(name)) {
    throw new TemplateSyntaxError(
      `未知过滤器「${name}」，可用：${listHelperNames().join(' / ')}`,
      line
    );
  }

  return { name, args };
}

function validatePath(path: string, line: number): void {
  if (!PATH_RE.test(path)) {
    throw new TemplateSyntaxError(`路径「${path}」不合法`, line);
  }
  for (const segment of path.split('.')) {
    if (FORBIDDEN_PATH_SEGMENTS.has(segment)) {
      throw new TemplateSyntaxError(`路径中不允许访问「${segment}」`, line);
    }
  }
}

export function parseExpr(source: string, line: number): IExpr {
  const trimmed = source.trim();
  if (!trimmed) throw new TemplateSyntaxError('表达式为空', line);

  const segments = splitTopLevel(trimmed, '|');
  const path = segments[0].trim();
  if (!path) throw new TemplateSyntaxError('表达式缺少取值路径', line);
  validatePath(path, line);

  const filters = segments.slice(1).map((s) => parseFilter(s, line));
  return { path, filters, source: trimmed };
}

/* ============================================================
 * 语法：AST 构建
 * ============================================================ */

interface IFrame {
  block: INodeBlock;
  /** 是否已经进入 {{else}} 之后的分支 */
  inAlt: boolean;
}

export function parseTemplate(source: string): TNode[] {
  const { tags } = tokenize(source);

  const rootChildren: TNode[] = [];
  const stack: IFrame[] = [];

  const target = (): TNode[] => {
    if (!stack.length) return rootChildren;
    const top = stack[stack.length - 1];
    return top.inAlt ? top.block.alt : top.block.children;
  };

  const pushText = (value: string) => {
    if (value) target().push({ kind: 'text', value });
  };

  let cursor = 0;

  for (const tag of tags) {
    pushText(source.slice(cursor, tag.start));
    cursor = tag.end;

    const inner = tag.inner.trim();
    if (!inner) continue;

    /* 注释 */
    if (inner.startsWith('!')) continue;

    /* 闭合 */
    if (inner.startsWith('/')) {
      const key = inner.slice(1).trim();
      const frame = stack.pop();
      if (!frame) {
        throw new TemplateSyntaxError(`多余的闭合标签 {{/${key}}}`, tag.line);
      }
      if (frame.block.closeKey !== key) {
        throw new TemplateSyntaxError(
          `闭合标签不匹配：期望 {{/${frame.block.closeKey}}}，实际 {{/${key}}}`,
          tag.line
        );
      }
      continue;
    }

    /* else */
    if (inner === 'else') {
      const frame = stack[stack.length - 1];
      if (!frame) {
        throw new TemplateSyntaxError('{{else}} 必须位于块内部', tag.line);
      }
      if (frame.inAlt) {
        throw new TemplateSyntaxError('同一个块内出现了多个 {{else}}', tag.line);
      }
      frame.inAlt = true;
      continue;
    }

    /* 开块 */
    if (inner.startsWith('#') || inner.startsWith('^')) {
      const inverted = inner.startsWith('^');
      const body = inner.slice(1).trim();
      if (!body) throw new TemplateSyntaxError('块标签缺少表达式', tag.line);

      let tagName: TBlockTag;
      let exprSource: string;
      let closeKey: string;

      if (inverted) {
        tagName = 'inverted';
        exprSource = body;
        closeKey = body;
      } else {
        const spaceIdx = body.search(/\s/);
        const head = spaceIdx === -1 ? body : body.slice(0, spaceIdx);
        const rest = spaceIdx === -1 ? '' : body.slice(spaceIdx).trim();

        if (RESERVED_TAGS.has(head as TBlockTag) && rest) {
          tagName = head as TBlockTag;
          exprSource = rest;
          closeKey = head;
        } else {
          // Mustache 兼容形式 {{#items}}
          tagName = 'auto';
          exprSource = body;
          closeKey = body;
        }
      }

      const block: INodeBlock = {
        kind: 'block',
        tag: tagName,
        expr: parseExpr(exprSource, tag.line),
        closeKey,
        children: [],
        alt: [],
        line: tag.line,
      };

      target().push(block);
      stack.push({ block, inAlt: false });

      if (stack.length > TEMPLATE_LIMITS.maxNestingDepth) {
        throw new TemplateSyntaxError(
          `块嵌套深度超过 ${TEMPLATE_LIMITS.maxNestingDepth}`,
          tag.line
        );
      }
      continue;
    }

    /* 原样输出 */
    if (inner.startsWith('&')) {
      const exprSource = inner.slice(1).trim();
      target().push({
        kind: 'interp',
        expr: parseExpr(exprSource, tag.line),
        raw: true,
        line: tag.line,
      });
      continue;
    }

    /* 普通插值 */
    target().push({
      kind: 'interp',
      expr: parseExpr(inner, tag.line),
      raw: false,
      line: tag.line,
    });
  }

  pushText(source.slice(cursor));

  if (stack.length) {
    const unclosed = stack[stack.length - 1].block;
    throw new TemplateSyntaxError(
      `块 {{#${unclosed.closeKey}}} 没有对应的 {{/${unclosed.closeKey}}}`,
      unclosed.line
    );
  }

  return rootChildren;
}

/* ============================================================
 * 编译缓存
 * ============================================================ */

const CACHE_LIMIT = 48;
const cache = new Map<string, TNode[]>();

export function compileTemplate(source: string): TNode[] {
  const hit = cache.get(source);
  if (hit) return hit;

  const ast = parseTemplate(source);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(source, ast);
  return ast;
}

export function clearTemplateCache(): void {
  cache.clear();
}
