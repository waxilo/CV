/**
 * 简历数据结构（参考 Reactive Resume / JSON Resume）
 * 模块可拖拽排序，模板通过 metadata.templateId 切换
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
  level: number; // 1-5
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
  /** 拖拽排序用 */
  order: number;
  items: TSectionItem[];
  /** 自定义模块的自由内容 */
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

export function createDefaultResumeData(): IResumeData {
  return {
    basics: {
      name: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      url: '',
      avatarUrl: '',
    },
    sections: [
      {
        id: 'summary',
        type: 'summary',
        name: '个人简介',
        visible: true,
        order: 0,
        items: [],
        content: '',
      },
      {
        id: 'experience',
        type: 'experience',
        name: '工作经历',
        visible: true,
        order: 1,
        items: [],
      },
      {
        id: 'education',
        type: 'education',
        name: '教育经历',
        visible: true,
        order: 2,
        items: [],
      },
      {
        id: 'skills',
        type: 'skills',
        name: '专业技能',
        visible: true,
        order: 3,
        items: [],
      },
      {
        id: 'projects',
        type: 'projects',
        name: '项目经历',
        visible: true,
        order: 4,
        items: [],
      },
    ],
    metadata: {
      templateId: 'modern',
      theme: {
        primaryColor: '#2563eb',
        textColor: '#0f172a',
        backgroundColor: '#ffffff',
        fontFamily: 'Inter',
        fontSize: 14,
        spacing: 1.15,
      },
      page: {
        margin: 24,
        format: 'a4',
      },
    },
  };
}
