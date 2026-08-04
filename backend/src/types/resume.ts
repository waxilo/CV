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
  /**
   * 用户对模板 variables 的覆写值，key 与 ITemplateVariable.key 对应。
   *
   * 属于用户数据而不是模板数据：内置模板只读、模板可被多人共用，
   * 所以调色调字号的结果必须存在简历侧。
   * 取值优先级：variables[].default → metadata.theme（仅当本字段缺失）→ 本字段
   */
  templateVars?: Record<string, string | number | boolean>;
  theme: IResumeTheme;
  /**
   * 用户对页面设置的覆写。整体与各字段都可缺省，缺省表示跟随模板的 page 配置 ——
   * 否则模板声明的纸张与页边距永远不会生效。
   */
  page?: {
    /** 毫米，四向统一 */
    margin?: number;
    format?: 'a4' | 'letter';
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
      birthDate: '',
      graduationDate: '',
      gender: '',
      age: '',
      workYears: '',
      wechat: '',
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
      // 新简历不预设页边距与模板变量：让模板自己声明的默认值生效。
      // templateVars 为空对象（而不是缺失）表示这份简历已进入 v2 变量体系。
      templateVars: {},
      // 不预设 page：纸张与页边距跟随模板声明，用户改动时才写入覆写值
    },
  };
}
