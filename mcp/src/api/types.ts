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

export interface IResumeMetadata {
  templateId: string;
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
