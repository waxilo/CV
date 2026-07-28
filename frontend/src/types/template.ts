/**
 * 模板 DSL（schemaVersion = 1）
 * 行列栅格 + 区块，支持受限 HTML/CSS
 */

import type { TSectionType } from './resume';

export type { TSectionType };

export type TTemplateLayout = 'sidebar-left' | 'sidebar-right' | 'single-column' | 'two-column';

export type TBlockType = 'basics' | 'section' | 'divider' | 'text' | 'avatar' | 'html';

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
  /** text / html 内容 */
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

export interface ITemplateConfig {
  schemaVersion: 1;
  layout: TTemplateLayout;
  primaryColor: string;
  fontFamily: string;
  fontSize: number;
  spacing: number;
  customCss?: string;
  document: ITemplateDocument;
}

/** 兼容旧版仅含 layout/主题字段的配置 */
export interface ILegacyTemplateConfig {
  layout?: TTemplateLayout;
  primaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  spacing?: number;
  schemaVersion?: number;
  customCss?: string;
  document?: ITemplateDocument;
}

export interface ITemplate {
  template_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  config: ITemplateConfig;
  is_builtin: boolean;
}

export const TEMPLATE_LIMITS = {
  maxRows: 40,
  maxColumnsPerRow: 4,
  maxBlocksPerColumn: 30,
  maxHtmlLength: 20_000,
  maxCssLength: 30_000,
  maxTextLength: 4_000,
} as const;
