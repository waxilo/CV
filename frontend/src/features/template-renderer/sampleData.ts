import type { IResumeData } from '/@/types/resume';

/** 设计器预览用的示例简历数据 */
export function createSampleResumeData(): IResumeData {
  return {
    basics: {
      name: '张三',
      headline: '全栈工程师',
      email: 'zhangsan@example.com',
      phone: '138-0000-0000',
      location: '上海',
      url: 'https://github.com/example',
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
        content: '5 年互联网研发经验，擅长 Vue / Node.js，注重交付高质量产品。',
      },
      {
        id: 'experience',
        type: 'experience',
        name: '工作经历',
        visible: true,
        order: 1,
        items: [
          {
            id: 'e1',
            company: '某科技公司',
            position: '高级前端工程师',
            location: '上海',
            startDate: '2022-03',
            endDate: '',
            isCurrent: true,
            description: '负责核心业务前端架构与性能优化。',
            visible: true,
          },
        ],
      },
      {
        id: 'education',
        type: 'education',
        name: '教育经历',
        visible: true,
        order: 2,
        items: [
          {
            id: 'ed1',
            school: '某大学',
            degree: '本科',
            major: '计算机科学',
            startDate: '2014',
            endDate: '2018',
            description: '',
            visible: true,
          },
        ],
      },
      {
        id: 'skills',
        type: 'skills',
        name: '专业技能',
        visible: true,
        order: 3,
        items: [
          { id: 's1', name: 'Vue', level: 5, keywords: [], visible: true },
          { id: 's2', name: 'TypeScript', level: 4, keywords: [], visible: true },
        ],
      },
      {
        id: 'projects',
        type: 'projects',
        name: '项目经历',
        visible: true,
        order: 4,
        items: [
          {
            id: 'p1',
            name: 'CV Builder',
            url: '',
            startDate: '2025',
            endDate: '2026',
            description: '可视化简历模板设计与导出系统。',
            visible: true,
          },
        ],
      },
    ],
    metadata: {
      templateId: 'preview',
      // 空对象表示「使用模板声明的变量默认值」，
      // 这样设计器预览展示的是模板自己的配色，不会被示例数据的 theme 覆盖
      templateVars: {},
      theme: {
        primaryColor: '#2563eb',
        textColor: '#0f172a',
        backgroundColor: '#ffffff',
        fontFamily: 'Inter',
        fontSize: 14,
        spacing: 1.15,
      },
      // 不设 page：设计器预览完全跟随模板声明的纸张与页边距
    },
  };
}
