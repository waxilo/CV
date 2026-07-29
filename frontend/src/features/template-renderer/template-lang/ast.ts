/**
 * 模板语法的 AST 定义与错误类型
 */

export type TBlockTag = 'if' | 'unless' | 'each' | 'with' | 'auto' | 'inverted';

/** 过滤器实参 */
export type TArg =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'path'; path: string };

export interface IFilterCall {
  name: string;
  args: TArg[];
}

/** 一个取值表达式：路径 + 过滤器链 */
export interface IExpr {
  path: string;
  filters: IFilterCall[];
  /** 原始文本，报错时展示 */
  source: string;
}

export interface INodeText {
  kind: 'text';
  value: string;
}

export interface INodeInterp {
  kind: 'interp';
  expr: IExpr;
  /** true 表示 {{& x}} 原样输出 */
  raw: boolean;
  line: number;
}

export interface INodeBlock {
  kind: 'block';
  tag: TBlockTag;
  expr: IExpr;
  /** 闭合标签需要匹配的字符串：保留字块是 tag 本身，auto/inverted 是原始 key */
  closeKey: string;
  children: TNode[];
  alt: TNode[];
  line: number;
}

export type TNode = INodeText | INodeInterp | INodeBlock;

export class TemplateSyntaxError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly snippet?: string
  ) {
    super(snippet ? `第 ${line} 行：${message}（${snippet}）` : `第 ${line} 行：${message}`);
    this.name = 'TemplateSyntaxError';
  }
}

export class TemplateRuntimeError extends Error {
  constructor(
    message: string,
    public readonly line?: number
  ) {
    super(line ? `第 ${line} 行：${message}` : message);
    this.name = 'TemplateRuntimeError';
  }
}
