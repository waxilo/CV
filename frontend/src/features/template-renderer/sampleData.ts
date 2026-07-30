import type { IResumeData } from '/@/types/resume';

/**
 * 设计器预览 & 左侧变量树用的示例简历数据。
 *
 * 人设：8 年经验的 Java 后端开发工程师。之所以选一个具体身份而不是泛泛的
 * 「全栈工程师」占位内容，是因为模板作者需要看到接近真实简历的字段长度、
 * 条目数量与文案密度，才能判断排版是否扛得住真实数据（而不是被短短几个字
 * 撑起来的「看起来很美」的假象）。
 *
 * sections 数组顺序不要随意调整：部分单测直接用下标定位到某个模块
 * （见 renderer.test.ts「过滤隐藏的模块与条目」）。新增模块请追加到末尾。
 */
export function createSampleResumeData(): IResumeData {
  return {
    basics: {
      name: '陈昊',
      headline: 'Java 后端开发工程师',
      email: 'chenhao.dev@example.com',
      phone: '139-0000-0000',
      location: '北京',
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
        content:
          '8 年 Java 后端开发经验，深耕电商与支付领域，擅长基于 Spring Cloud 的微服务架构设计与高并发系统优化。主导过日均千万级订单系统的架构升级，具备扎实的分布式系统、数据库调优与线上问题排查能力。',
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
            company: '某电商科技有限公司',
            position: '高级 Java 开发工程师',
            location: '北京',
            startDate: '2021-06',
            endDate: '',
            isCurrent: true,
            description:
              '负责订单中心微服务的架构设计与核心开发，基于 Spring Cloud Alibaba 完成从单体到微服务的拆分；引入 Redis 多级缓存与 Kafka 异步削峰，将大促期间订单接口 P99 延迟从 800ms 降至 120ms；主导 MySQL 分库分表方案，支撑日均 2000 万+ 订单量。',
            visible: true,
          },
          {
            id: 'e2',
            company: '某金融科技有限公司',
            position: 'Java 开发工程师',
            location: '上海',
            startDate: '2018-07',
            endDate: '2021-05',
            isCurrent: false,
            description:
              '参与支付网关系统开发，负责渠道路由与对账模块；使用 RocketMQ 实现异步通知，保障消息不丢失；优化核心接口 SQL 与索引，响应时间降低 40%；配合团队完成系统国密算法改造，通过金融合规审计。',
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
            school: '某理工大学',
            degree: '本科',
            major: '计算机科学与技术',
            startDate: '2014-09',
            endDate: '2018-06',
            description: '主修数据结构、操作系统、数据库原理与分布式系统，连续三年获校级奖学金。',
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
          { id: 's1', name: 'Java', level: 5, keywords: ['JVM 调优', '并发编程'], visible: true },
          {
            id: 's2',
            name: 'Spring Boot / Spring Cloud',
            level: 5,
            keywords: ['微服务', 'Spring Cloud Alibaba'],
            visible: true,
          },
          { id: 's3', name: 'MySQL', level: 4, keywords: ['分库分表', 'SQL 调优'], visible: true },
          { id: 's4', name: 'Redis', level: 4, keywords: ['缓存架构', '分布式锁'], visible: true },
          { id: 's5', name: 'Kafka / RocketMQ', level: 4, keywords: ['消息队列'], visible: true },
          { id: 's6', name: 'Docker / Kubernetes', level: 3, keywords: ['容器化部署'], visible: true },
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
            name: '订单中心微服务化改造',
            url: '',
            startDate: '2022-03',
            endDate: '2023-01',
            description:
              '主导单体订单系统拆分为 8 个微服务，基于 Spring Cloud Alibaba 实现服务治理，配合 Sentinel 完成限流熔断；大促期间系统可用性达到 99.99%。',
            visible: true,
          },
          {
            id: 'p2',
            name: '支付对账系统',
            url: '',
            startDate: '2019-04',
            endDate: '2020-02',
            description:
              '设计并实现跨渠道自动对账流程，通过 RocketMQ 消费交易流水，日终差错率从人工核对的 0.3% 降至 0.02%。',
            visible: true,
          },
        ],
      },
      {
        id: 'languages',
        type: 'languages',
        name: '语言能力',
        visible: true,
        order: 5,
        items: [{ id: 'l1', name: '英语', level: '熟练（CET-6，可阅读英文技术文档）', visible: true }],
      },
      {
        id: 'certificates',
        type: 'certificates',
        name: '证书资质',
        visible: true,
        order: 6,
        items: [
          {
            id: 'c1',
            name: '系统集成项目管理工程师（软考中级）',
            issuer: '工业和信息化部教育与考试中心',
            date: '2020-05',
            url: '',
            visible: true,
          },
          {
            id: 'c2',
            name: 'Oracle Certified Professional, Java SE 11 Developer',
            issuer: 'Oracle',
            date: '2019-11',
            url: '',
            visible: true,
          },
        ],
      },
      {
        id: 'awards',
        type: 'awards',
        name: '荣誉奖项',
        visible: true,
        order: 7,
        items: [
          {
            id: 'a1',
            title: '年度技术突破奖',
            subtitle: '某电商科技有限公司',
            date: '2023-01',
            description: '主导的订单中心性能优化项目获评公司年度技术突破奖。',
            visible: true,
          },
        ],
      },
      {
        id: 'interests',
        type: 'interests',
        name: '兴趣爱好',
        visible: true,
        order: 8,
        items: [
          {
            id: 'i1',
            title: '技术分享与开源',
            description: '维护个人技术博客，累计发布 30+ 篇 Java 后端技术文章；参与过 Spring 生态开源项目的问题修复。',
            visible: true,
          },
          { id: 'i2', title: '羽毛球', description: '', visible: true },
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
