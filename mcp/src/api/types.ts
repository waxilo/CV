/**
 * 与 CV Builder 后端对齐的精简类型（MCP 侧独立维护，避免强耦合 frontend）。
 */

export interface IApiResponse<T = unknown> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
}

export interface IResumeBasics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  url: string;
  avatarUrl: string;
  birthDate: string;
  graduationDate: string;
  gender: string;
  age: string;
  workYears: string;
  wechat: string;
}

export interface IResumeSection {
  id: string;
  type: string;
  name: string;
  visible: boolean;
  order: number;
  items: Record<string, unknown>[];
  content?: string;
}

export interface IResumeTheme {
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  fontSize: number;
  spacing: number;
}

/** 模板变量声明（与 shared/template-schema 对齐的精简版） */
export interface ITemplateVariable {
  key: string;
  label?: string;
  type?: 'color' | 'number' | 'length' | 'text' | 'select' | 'boolean';
  default?: string | number | boolean;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  cssVar?: string;
  group?: string;
}

/** 模板完整配置（简历快照 / 模板中心共用） */
export interface ITemplateConfig {
  schemaVersion?: number;
  engine: 'html' | 'blocks' | 'vue';
  meta?: Record<string, unknown>;
  page: {
    format?: string;
    margin: { top: number; right: number; bottom: number; left: number };
  };
  variables: ITemplateVariable[];
  source: { html?: string; css?: string };
  capabilities?: Record<string, unknown>;
  layout?: string;
  primaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  spacing?: number;
  customCss?: string;
  document?: Record<string, unknown>;
}

export interface IResumeMetadata {
  templateId: string;
  /** 简历持有的模板完整副本（完全固化快照）；缺失时渲染回退模板中心 */
  templateConfig?: ITemplateConfig;
  templateVars?: Record<string, string | number | boolean>;
  theme: IResumeTheme;
  page?: {
    margin?: number;
    format?: 'a4';
  };
}

export interface IResumeData {
  basics: IResumeBasics;
  sections: IResumeSection[];
  metadata: IResumeMetadata;
}

export interface IResumeSummary {
  resume_id: string;
  title: string;
  slug: string;
  template_id: string;
  is_public: boolean;
  is_locked?: boolean;
  share_token?: string | null;
  data: IResumeData;
  updated_at: string;
  created_at: string;
}

export type IResumeDetail = IResumeSummary;

/** 模板中心条目（list-templates 返回） */
export interface ITemplateSummary {
  template_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  config: ITemplateConfig;
  is_builtin: boolean;
  trust?: 'trusted' | 'owned' | 'foreign';
}

/**
 * 粗校验：导入/写回所需的最小结构。
 */
export function isResumeDataShape(value: unknown): value is IResumeData {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (!record.basics || typeof record.basics !== 'object') return false;
  if (!Array.isArray(record.sections)) return false;
  if (!record.metadata || typeof record.metadata !== 'object') return false;
  const metadata = record.metadata as Record<string, unknown>;
  if (typeof metadata.templateId !== 'string' || !metadata.templateId.trim()) return false;
  if (!metadata.theme || typeof metadata.theme !== 'object') return false;
  return true;
}

/** 粗校验：模板配置是否具备可调整的最小结构 */
export function isTemplateConfigShape(value: unknown): value is ITemplateConfig {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (typeof record.engine !== 'string') return false;
  if (!record.source || typeof record.source !== 'object') return false;
  if (!Array.isArray(record.variables)) return false;
  if (!record.page || typeof record.page !== 'object') return false;
  return true;
}
