/**
 * 模板配置迁移 —— 前后端唯一来源
 *
 * 支持的输入形态：
 *   1. 只有主题字段的最早期配置（{ layout, primaryColor, ... }）
 *   2. v1 区块 DSL（schemaVersion: 1 + document）
 *   3. v2 代码化模板（schemaVersion: 2）
 *
 * 输出统一为完整的 ITemplateConfigV2，所有字段保证有值。
 */

import { CONTEXT_VERSION } from './limits';
import {
  TEMPLATE_LAYOUTS,
  TEMPLATE_ENGINES,
  type ILegacyTemplateConfig,
  type IPageMargin,
  type ITemplateBlock,
  type ITemplateCapabilities,
  type ITemplateConfigV2,
  type ITemplateDocument,
  type ITemplateMeta,
  type ITemplatePage,
  type ITemplateSource,
  type ITemplateVariable,
  type TTemplateEngine,
  type TTemplateLayout,
} from './types';

/* ============================================================
 * 工具
 * ============================================================ */

let fallbackIdCounter = 0;

export function uid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  fallbackIdCounter += 1;
  return `id-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function layoutOf(value: unknown): TTemplateLayout {
  return TEMPLATE_LAYOUTS.includes(value as TTemplateLayout)
    ? (value as TTemplateLayout)
    : 'single-column';
}

/* ============================================================
 * 默认值
 * ============================================================ */

export const DEFAULT_PAGE_MARGIN: IPageMargin = { top: 16, right: 16, bottom: 16, left: 16 };

export function createDefaultPage(overrides: Partial<ITemplatePage> = {}): ITemplatePage {
  return {
    format: overrides.format === 'letter' ? 'letter' : 'a4',
    margin: { ...DEFAULT_PAGE_MARGIN, ...(overrides.margin || {}) },
    paged: overrides.paged ?? true,
  };
}

export function createDefaultCapabilities(
  overrides: Partial<ITemplateCapabilities> = {}
): ITemplateCapabilities {
  return {
    allowRemoteImages: overrides.allowRemoteImages ?? true,
    allowWebFonts: overrides.allowWebFonts ?? false,
    allowScript: false,
  };
}

export function createDefaultMeta(overrides: Partial<ITemplateMeta> = {}): ITemplateMeta {
  return {
    title: str(overrides.title, '未命名模板'),
    author: overrides.author,
    description: overrides.description,
    tags: Array.isArray(overrides.tags) ? overrides.tags : [],
    contextVersion:
      typeof overrides.contextVersion === 'number' ? overrides.contextVersion : CONTEXT_VERSION,
  };
}

/**
 * 所有模板默认暴露的基础变量。
 * 内置模板会在此基础上追加自己的变量。
 */
export function createBaseVariables(theme: {
  primaryColor: string;
  fontFamily: string;
  fontSize: number;
  spacing: number;
}): ITemplateVariable[] {
  return [
    {
      key: 'primaryColor',
      label: '主色',
      type: 'color',
      default: theme.primaryColor,
      group: '配色',
    },
    {
      key: 'textColor',
      label: '正文颜色',
      type: 'color',
      default: '#0f172a',
      group: '配色',
    },
    {
      key: 'mutedColor',
      label: '辅助文字颜色',
      type: 'color',
      default: '#64748b',
      group: '配色',
    },
    {
      key: 'fontFamily',
      label: '字体',
      type: 'select',
      default: theme.fontFamily,
      options: [
        { label: 'Inter', value: 'Inter' },
        { label: 'Helvetica', value: 'Helvetica' },
        { label: 'Georgia', value: 'Georgia' },
        { label: 'PingFang SC', value: 'PingFang SC' },
        { label: 'Source Han Sans SC', value: 'Source Han Sans SC' },
      ],
      group: '排版',
    },
    {
      key: 'fontSize',
      label: '正文字号',
      type: 'number',
      default: theme.fontSize,
      min: 10,
      max: 20,
      step: 0.5,
      unit: 'px',
      group: '排版',
    },
    {
      key: 'lineHeight',
      label: '行距',
      type: 'number',
      default: theme.spacing,
      min: 0.8,
      max: 2,
      step: 0.05,
      unit: '',
      group: '排版',
    },
    {
      key: 'sectionGap',
      label: '模块间距',
      type: 'length',
      default: '18px',
      group: '排版',
    },
    {
      key: 'dateFormat',
      label: '日期格式',
      type: 'select',
      default: 'YYYY.MM',
      options: [
        { label: '2022.03', value: 'YYYY.MM' },
        { label: '2022年3月', value: 'YYYY年M月' },
        { label: 'Mar 2022', value: 'MMM YYYY' },
        { label: '2022', value: 'YYYY' },
      ],
      group: '显示',
    },
    {
      key: 'showAvatar',
      label: '显示头像',
      type: 'boolean',
      default: false,
      group: '显示',
    },
  ];
}

/* ============================================================
 * v1 区块文档生成（从旧 layout 推导）
 * ============================================================ */

/** id 生成器类型，便于注入确定性实现 */
export type TIdFactory = () => string;

/**
 * 确定性 id 生成器。
 *
 * 内置模板在模块顶层构造，而 Cloudflare Workers 禁止在全局作用域调用
 * crypto.randomUUID()（会报 "Disallowed operation called within global scope"）。
 * 内置模板的区块 id 不需要全局唯一，用序号即可。
 */
export function createSequentialIds(prefix: string): TIdFactory {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}-${n}`;
  };
}

function sectionBlock(
  sectionType: ITemplateBlock['sectionType'],
  nextId: TIdFactory
): ITemplateBlock {
  return { id: nextId(), type: 'section', visible: true, sectionType };
}

export function createDocumentFromLayout(
  layout: TTemplateLayout,
  makeId: TIdFactory = uid
): ITemplateDocument {
  const nextId = makeId;
  const basics: ITemplateBlock = { id: nextId(), type: 'basics', visible: true };
  const avatar: ITemplateBlock = { id: nextId(), type: 'avatar', visible: true };
  const summary = sectionBlock('summary', nextId);
  const experience = sectionBlock('experience', nextId);
  const education = sectionBlock('education', nextId);
  const skills = sectionBlock('skills', nextId);
  const projects = sectionBlock('projects', nextId);

  if (layout === 'sidebar-left') {
    return {
      rows: [
        {
          id: nextId(),
          columns: [
            {
              id: nextId(),
              span: 4,
              style: { backgroundColor: 'var(--primary)', color: '#ffffff', padding: '24px' },
              blocks: [avatar, basics, skills],
            },
            {
              id: nextId(),
              span: 8,
              style: { padding: '24px' },
              blocks: [summary, experience, education, projects],
            },
          ],
        },
      ],
    };
  }

  if (layout === 'sidebar-right') {
    return {
      rows: [
        {
          id: nextId(),
          columns: [
            {
              id: nextId(),
              span: 8,
              style: { padding: '24px' },
              blocks: [summary, experience, education, projects],
            },
            {
              id: nextId(),
              span: 4,
              style: { backgroundColor: 'var(--primary)', color: '#ffffff', padding: '24px' },
              blocks: [avatar, basics, skills],
            },
          ],
        },
      ],
    };
  }

  if (layout === 'two-column') {
    return {
      rows: [
        {
          id: nextId(),
          columns: [
            {
              id: nextId(),
              span: 12,
              style: { padding: '24px 24px 8px', textAlign: 'center' },
              blocks: [avatar, basics],
            },
          ],
        },
        {
          id: nextId(),
          columns: [
            {
              id: nextId(),
              span: 6,
              style: { padding: '12px 24px' },
              blocks: [summary, experience, projects],
            },
            {
              id: nextId(),
              span: 6,
              style: { padding: '12px 24px' },
              blocks: [education, skills],
            },
          ],
        },
      ],
    };
  }

  return {
    rows: [
      {
        id: nextId(),
        columns: [
          {
            id: nextId(),
            span: 12,
            style: { padding: '28px', textAlign: 'center' },
            blocks: [basics, { id: nextId(), type: 'divider', visible: true }],
          },
        ],
      },
      {
        id: nextId(),
        columns: [
          {
            id: nextId(),
            span: 12,
            style: { padding: '0 28px 28px' },
            blocks: [summary, experience, education, skills, projects],
          },
        ],
      },
    ],
  };
}

/* ============================================================
 * 迁移主入口
 * ============================================================ */

interface INormalizeSeed {
  engine: TTemplateEngine;
  layout: TTemplateLayout;
  primaryColor: string;
  fontFamily: string;
  fontSize: number;
  spacing: number;
  customCss: string;
}

function readSeed(cfg: Record<string, unknown>): INormalizeSeed {
  const engine = TEMPLATE_ENGINES.includes(cfg.engine as TTemplateEngine)
    ? (cfg.engine as TTemplateEngine)
    : 'blocks';
  return {
    engine,
    layout: layoutOf(cfg.layout),
    primaryColor: str(cfg.primaryColor, '#2563eb'),
    fontFamily: str(cfg.fontFamily, 'Inter'),
    fontSize: num(cfg.fontSize, 14, 10, 20),
    spacing: num(cfg.spacing, 1.15, 0.8, 2),
    customCss: str(cfg.customCss, ''),
  };
}

function normalizeSource(raw: unknown): ITemplateSource {
  if (!isPlainObject(raw)) return { css: '' };
  return {
    html: typeof raw.html === 'string' ? raw.html : undefined,
    vue: typeof raw.vue === 'string' ? raw.vue : undefined,
    css: str(raw.css, ''),
  };
}

function normalizeVariables(raw: unknown, seed: INormalizeSeed): ITemplateVariable[] {
  if (!Array.isArray(raw)) return createBaseVariables(seed);
  const cleaned = raw.filter(isPlainObject) as unknown as ITemplateVariable[];
  return cleaned.length ? cleaned : createBaseVariables(seed);
}

/**
 * 把任意历史形态的模板配置规范化为 v2。
 *
 * 该函数不做安全校验，只保证结构完整；校验请调用 validateTemplateConfig。
 */
export function normalizeTemplateConfig(raw: unknown): ITemplateConfigV2 {
  const cfg = isPlainObject(raw) ? raw : {};
  const seed = readSeed(cfg);
  const schemaVersion = typeof cfg.schemaVersion === 'number' ? cfg.schemaVersion : 0;

  /* --- 已是 v2 --- */
  if (schemaVersion === 2) {
    const variables = normalizeVariables(cfg.variables, seed);
    const source = normalizeSource(cfg.source);
    const engine: TTemplateEngine = seed.engine;

    // engine=html 但没有 html 源码：降级为 blocks，避免渲染空白
    const effectiveEngine: TTemplateEngine =
      engine === 'html' && !source.html?.trim() ? 'blocks' : engine;

    const document =
      isPlainObject(cfg.document) && Array.isArray(cfg.document.rows)
        ? (cfg.document as unknown as ITemplateDocument)
        : createDocumentFromLayout(seed.layout);

    return syncThemeFromVariables({
      schemaVersion: 2,
      engine: effectiveEngine,
      meta: createDefaultMeta(
        isPlainObject(cfg.meta) ? (cfg.meta as unknown as Partial<ITemplateMeta>) : {}
      ),
      page: createDefaultPage(
        isPlainObject(cfg.page) ? (cfg.page as unknown as Partial<ITemplatePage>) : {}
      ),
      variables,
      source,
      capabilities: createDefaultCapabilities(
        isPlainObject(cfg.capabilities)
          ? (cfg.capabilities as unknown as Partial<ITemplateCapabilities>)
          : {}
      ),
      layout: seed.layout,
      primaryColor: seed.primaryColor,
      fontFamily: seed.fontFamily,
      fontSize: seed.fontSize,
      spacing: seed.spacing,
      customCss: seed.customCss,
      document,
    });
  }

  /* --- v1 或更早：一律包装为 engine=blocks --- */
  const hasDocument = isPlainObject(cfg.document) && Array.isArray(cfg.document.rows);
  const document = hasDocument
    ? (cfg.document as unknown as ITemplateDocument)
    : createDocumentFromLayout(seed.layout);

  return syncThemeFromVariables({
    schemaVersion: 2,
    engine: 'blocks',
    meta: createDefaultMeta({ title: '未命名模板' }),
    page: createDefaultPage(),
    variables: createBaseVariables(seed),
    source: { css: '' },
    capabilities: createDefaultCapabilities(),
    layout: seed.layout,
    primaryColor: seed.primaryColor,
    fontFamily: seed.fontFamily,
    fontSize: seed.fontSize,
    spacing: seed.spacing,
    customCss: seed.customCss,
    document,
  });
}

/**
 * 让顶层主题字段与 variables 的同名默认值保持一致。
 * 模板中心的色块预览读的是顶层 primaryColor，HTML 模板改了变量默认值后需要同步。
 */
function syncThemeFromVariables(config: ITemplateConfigV2): ITemplateConfigV2 {
  const find = (key: string) => config.variables.find((v) => v.key === key);

  const primary = find('primaryColor');
  if (primary && typeof primary.default === 'string') {
    config.primaryColor = primary.default;
  }
  const font = find('fontFamily');
  if (font && typeof font.default === 'string') {
    config.fontFamily = font.default;
  }
  const size = find('fontSize');
  if (size && typeof size.default === 'number') {
    config.fontSize = num(size.default, config.fontSize, 10, 20);
  }
  const lh = find('lineHeight');
  if (lh && typeof lh.default === 'number') {
    config.spacing = num(lh.default, config.spacing, 0.8, 2);
  }

  return config;
}

/** 兼容旧导出：生成一份默认的区块模板配置 */
export function createDefaultTemplateConfig(
  layout: TTemplateLayout = 'single-column',
  overrides: Partial<ITemplateConfigV2> = {}
): ITemplateConfigV2 {
  const seed: INormalizeSeed = {
    engine: 'blocks',
    layout,
    primaryColor: str(overrides.primaryColor, '#2563eb'),
    fontFamily: str(overrides.fontFamily, 'Inter'),
    fontSize: num(overrides.fontSize, 14, 10, 20),
    spacing: num(overrides.spacing, 1.15, 0.8, 2),
    customCss: str(overrides.customCss, ''),
  };

  return {
    schemaVersion: 2,
    engine:
      overrides.engine && TEMPLATE_ENGINES.includes(overrides.engine) ? overrides.engine : 'blocks',
    meta: createDefaultMeta(overrides.meta),
    page: createDefaultPage(overrides.page),
    variables: overrides.variables?.length ? overrides.variables : createBaseVariables(seed),
    source: overrides.source ? normalizeSource(overrides.source) : { css: '' },
    capabilities: createDefaultCapabilities(overrides.capabilities),
    layout,
    primaryColor: seed.primaryColor,
    fontFamily: seed.fontFamily,
    fontSize: seed.fontSize,
    spacing: seed.spacing,
    customCss: seed.customCss,
    document: overrides.document || createDocumentFromLayout(layout),
  };
}

/** 深拷贝配置，设计器的不可变 patch 用 */
export function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 兼容旧命名 */
export const migrateTemplateConfig = normalizeTemplateConfig;

export type { ILegacyTemplateConfig };
