/**
 * 模板限额 —— 前后端唯一来源
 */
export const TEMPLATE_LIMITS = {
  /* ===== v2 代码化模板 ===== */
  /** source.html 最大长度 */
  maxHtmlLength: 60_000,
  /** source.vue 最大长度（预留） */
  maxVueLength: 60_000,
  /** source.css 最大长度 */
  maxCssLength: 60_000,
  /** variables 声明数量上限 */
  maxVariables: 40,
  /** 单个模板 config 序列化后的字节上限 */
  maxTotalConfigBytes: 200_000,
  /** 模板语法嵌套深度上限，防御深层嵌套导致的栈溢出 */
  maxNestingDepth: 24,
  /** 单次 each 迭代上限，防御超长数组 */
  maxIterations: 2_000,

  /* ===== v1 区块 DSL（engine=blocks 兼容路径） ===== */
  maxRows: 40,
  maxColumnsPerRow: 4,
  maxBlocksPerColumn: 30,
  maxTextLength: 4_000,
  /** v1 html 区块的内容上限 */
  maxBlockHtmlLength: 20_000,
} as const;

/** 契约版本：IRenderContext 的结构版本 */
export const CONTEXT_VERSION = 1 as const;

/** 模板配置结构版本 */
export const TEMPLATE_SCHEMA_VERSION = 2 as const;
