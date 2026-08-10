/**
 * 简历数据结构（与后端保持一致，参考 Reactive Resume）
 */

export type TSectionType =
  | 'basics'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'languages'
  | 'certificates'
  | 'awards'
  | 'interests'
  | 'custom';

export interface IResumeBasics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  url: string;
  avatarUrl: string;
  /** 出生年月日，自由文本，如 2000.01 或 2000-01-15 */
  birthDate: string;
  /** 毕业年月日，自由文本，如 2023.06 */
  graduationDate: string;
  /** 性别，如 男 / 女 */
  gender: string;
  /** 年龄，如 24 */
  age: string;
  /** 工作年限，如 3年 */
  workYears: string;
  /** 微信号 */
  wechat: string;
}

export interface IExperienceItem {
  id: string;
  company: string;
  position: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  visible: boolean;
}

export interface IEducationItem {
  id: string;
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
  description: string;
  visible: boolean;
}

export interface ISkillItem {
  id: string;
  name: string;
  /** 兼容旧数据；编辑器已不再录入 */
  level?: number;
  keywords: string[];
  /** 技能描述，用于展开说明掌握范围与实践经验 */
  description: string;
  visible: boolean;
}

export interface IProjectItem {
  id: string;
  name: string;
  /** 兼容旧数据；编辑器已不再录入 */
  url?: string;
  startDate: string;
  endDate: string;
  description: string;
  visible: boolean;
}

export interface ILanguageItem {
  id: string;
  name: string;
  level: string;
  visible: boolean;
}

export interface ICertificateItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  url: string;
  visible: boolean;
}

export interface ICustomItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  description: string;
  visible: boolean;
}

export type TSectionItem =
  | IExperienceItem
  | IEducationItem
  | ISkillItem
  | IProjectItem
  | ILanguageItem
  | ICertificateItem
  | ICustomItem
  | Record<string, unknown>;

export interface IResumeSection {
  id: string;
  type: TSectionType;
  name: string;
  visible: boolean;
  order: number;
  items: TSectionItem[];
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
  /**
   * 用户对模板 variables 的覆写值，key 与 ITemplateVariable.key 对应。
   *
   * 这份数据属于用户而不是模板：内置模板只读、共享模板会被多人使用，
   * 所以调色调字号的结果必须存在简历侧。
   * 取值优先级：variables[].default → metadata.theme → metadata.templateVars
   */
  templateVars?: Record<string, string | number | boolean>;
  theme: IResumeTheme;
  /**
   * 用户对页面边距的覆写；纸张规格始终为 A4。
   */
  page?: {
    /** 毫米，四向统一 */
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
  /** 锁定后禁止编辑/删除（含 MCP），仅允许复制 */
  is_locked?: boolean;
  share_token?: string | null;
  /** 列表接口也返回，用于卡片缩略图预览 */
  data: IResumeData;
  updated_at: string;
  created_at: string;
}

export interface IResumeDetail extends IResumeSummary {}

export type {
  ITemplateConfig,
  ITemplate,
  ITemplateDocument,
  ITemplateRow,
  ITemplateColumn,
  ITemplateBlock,
  IBlockStyle,
  TTemplateLayout,
  TBlockType,
} from './template';

export interface IUser {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

export interface IApiResponse<T = unknown> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
}
