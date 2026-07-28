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
  level: number;
  keywords: string[];
  visible: boolean;
}

export interface IProjectItem {
  id: string;
  name: string;
  url: string;
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
  theme: IResumeTheme;
  page: {
    margin: number;
    format: 'a4' | 'letter';
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
  updated_at: string;
  created_at: string;
}

export interface IResumeDetail extends IResumeSummary {
  data: IResumeData;
}

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
