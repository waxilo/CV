/**
 * 模板配置类型 —— 前后端唯一来源
 *
 * v2 引入 engine 三态：
 *   - 'html'   代码化 HTML 模板（本期主力）
 *   - 'blocks' v1 区块 DSL 兼容路径
 *   - 'vue'    预留，本期校验阶段拒绝
 */

/* ============================================================
 * 简历模块类型（与 types/resume.ts 保持一致，此处为校验用权威列表）
 * ============================================================ */

export const SECTION_TYPES = [
  'basics',
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'languages',
  'certificates',
  'awards',
  'interests',
  'custom',
] as const;

export type TSectionType = (typeof SECTION_TYPES)[number];

/* ============================================================
 * v1 区块 DSL
 * ============================================================ */

export const TEMPLATE_LAYOUTS = [
  'sidebar-left',
  'sidebar-right',
  'single-column',
  'two-column',
] as const;

export type TTemplateLayout = (typeof TEMPLATE_LAYOUTS)[number];

export const BLOCK_TYPES = ['basics', 'section', 'divider', 'text', 'avatar', 'html'] as const;

export type TBlockType = (typeof BLOCK_TYPES)[number];

export type TTextAlign = 'left' | 'center' | 'right';

export interface IBlockStyle {
  padding?: string;
  margin?: string;
  fontSize?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: TTextAlign;
  fontWeight?: string;
  borderRadius?: string;
}

export interface ITemplateBlock {
  id: string;
  type: TBlockType;
  visible: boolean;
  /** section 区块绑定的简历模块类型 */
  sectionType?: TSectionType;
  /** text / html 区块内容 */
  content?: string;
  style?: IBlockStyle;
}

export interface ITemplateColumn {
  id: string;
  /** 12 栅格宽度 */
  span: number;
  blocks: ITemplateBlock[];
  style?: IBlockStyle;
}

export interface ITemplateRow {
  id: string;
  columns: ITemplateColumn[];
  style?: IBlockStyle;
}

export interface ITemplateDocument {
  rows: ITemplateRow[];
}

/** v1 配置结构，仅用于迁移输入 */
export interface ITemplateConfigV1 {
  schemaVersion: 1;
  layout: TTemplateLayout;
  primaryColor: string;
  fontFamily: string;
  fontSize: number;
  spacing: number;
  customCss?: string;
  document: ITemplateDocument;
}

/** 更早的配置：只有主题字段，没有 document */
export interface ILegacyTemplateConfig {
  schemaVersion?: number;
  layout?: TTemplateLayout;
  primaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  spacing?: number;
  customCss?: string;
  document?: ITemplateDocument;
}

/* ============================================================
 * v2 代码化模板
 * ============================================================ */

export const TEMPLATE_ENGINES = ['html', 'vue', 'blocks'] as const;

export type TTemplateEngine = (typeof TEMPLATE_ENGINES)[number];

/** 本期启用的引擎；vue 保留在类型里但校验阶段拒绝 */
export const ENABLED_ENGINES: readonly TTemplateEngine[] = ['html', 'blocks'];

export const VARIABLE_TYPES = [
  'color',
  'number',
  'length',
  'text',
  'select',
  'boolean',
] as const;

export type TVariableType = (typeof VARIABLE_TYPES)[number];

export type TVariableValue = string | number | boolean;

export interface ITemplateVariable {
  /** 合法标识符，用于 vars.<key> 与 CSS 变量名派生 */
  key: string;
  label: string;
  type: TVariableType;
  default: TVariableValue;
  /** type=select 时的候选项 */
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  /** 显式指定 CSS 变量名，缺省为 --tpl-{kebab(key)} */
  cssVar?: string;
  /** 属性面板分组 */
  group?: string;
  /** type=number 注入 CSS 时补的单位，缺省 px；设为 '' 表示无单位 */
  unit?: string;
}

export type TPageFormat = 'a4';

export interface IPageMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ITemplatePage {
  format: TPageFormat;
  /** 毫米 */
  margin: IPageMargin;
  /** 兼容旧配置；渲染时始终启用自动分页 */
  paged: boolean;
}

export interface ITemplateSource {
  /** engine=html 必填 */
  html?: string;
  /** engine=vue 必填（预留） */
  vue?: string;
  css: string;
}

export interface ITemplateMeta {
  title: string;
  author?: string;
  description?: string;
  tags?: string[];
  /** 模板依赖的渲染上下文契约版本 */
  contextVersion: number;
}

export interface ITemplateCapabilities {
  /** 允许 https 外链图片 */
  allowRemoteImages: boolean;
  /** 允许 @font-face */
  allowWebFonts: boolean;
  /** 允许 Vue SFC 内的 script（预留，本期恒为 false） */
  allowScript: boolean;
}

/**
 * v2 模板配置。
 *
 * 注意：layout / primaryColor / fontFamily / fontSize / spacing / customCss / document
 * 是 v1 兼容字段，engine='blocks' 时承载真实配置；engine='html' 时它们仍保留有效值，
 * 用途是模板中心的色块预览与 variables 的兜底默认值。normalizeTemplateConfig
 * 保证这些字段一定有值，因此消费方无需判空。
 */
export interface ITemplateConfigV2 {
  schemaVersion: 2;
  engine: TTemplateEngine;
  meta: ITemplateMeta;
  page: ITemplatePage;
  variables: ITemplateVariable[];
  source: ITemplateSource;
  capabilities: ITemplateCapabilities;

  /* v1 兼容字段 */
  layout: TTemplateLayout;
  primaryColor: string;
  fontFamily: string;
  fontSize: number;
  spacing: number;
  customCss: string;
  document: ITemplateDocument;
}

/** 当前主类型别名 */
export type ITemplateConfig = ITemplateConfigV2;

/** 模板信任档位，决定沙箱与清洗强度 */
export type TTemplateTrust = 'trusted' | 'owned' | 'foreign';

export interface ITemplate {
  template_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  config: ITemplateConfigV2;
  is_builtin: boolean;
  /** 后端下发的信任档位，旧接口可能缺省 */
  trust?: TTemplateTrust;
}

/* ============================================================
 * 校验结果
 * ============================================================ */

export interface IValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
