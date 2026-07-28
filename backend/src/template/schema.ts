/**
 * 模板 DSL 校验（后端 Zod）
 */
import { z } from 'zod';

export const TEMPLATE_LIMITS = {
  maxRows: 40,
  maxColumnsPerRow: 4,
  maxBlocksPerColumn: 30,
  maxHtmlLength: 20_000,
  maxCssLength: 30_000,
  maxTextLength: 4_000,
} as const;

const layoutEnum = z.enum(['sidebar-left', 'sidebar-right', 'single-column', 'two-column']);
const blockTypeEnum = z.enum(['basics', 'section', 'divider', 'text', 'avatar', 'html']);
const sectionTypeEnum = z.enum([
  'basics',
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'languages',
  'certificates',
  'awards',
  'interests',
  'custom',
]);

const styleSchema = z
  .object({
    padding: z.string().max(64).optional(),
    margin: z.string().max(64).optional(),
    fontSize: z.string().max(32).optional(),
    color: z.string().max(64).optional(),
    backgroundColor: z.string().max(64).optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    fontWeight: z.string().max(32).optional(),
    borderRadius: z.string().max(32).optional(),
  })
  .optional();

const blockSchema = z
  .object({
    id: z.string().min(1).max(64),
    type: blockTypeEnum,
    visible: z.boolean(),
    sectionType: sectionTypeEnum.optional(),
    content: z.string().max(TEMPLATE_LIMITS.maxHtmlLength).optional(),
    style: styleSchema,
  })
  .superRefine((block, ctx) => {
    if (block.type === 'section' && !block.sectionType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'section 区块需要 sectionType' });
    }
    if (block.type === 'html') {
      const html = block.content || '';
      if (html.includes('{{{')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '禁止三花括号原始输出' });
      }
      if (/<\s*script/i.test(html) || /\son\w+\s*=/i.test(html)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'HTML 包含禁止的脚本或事件属性' });
      }
    }
    if (block.type === 'text' && (block.content || '').length > TEMPLATE_LIMITS.maxTextLength) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '文本过长' });
    }
  });

const columnSchema = z.object({
  id: z.string().min(1).max(64),
  span: z.number().int().min(1).max(12),
  blocks: z.array(blockSchema).max(TEMPLATE_LIMITS.maxBlocksPerColumn),
  style: styleSchema,
});

const rowSchema = z
  .object({
    id: z.string().min(1).max(64),
    columns: z.array(columnSchema).min(1).max(TEMPLATE_LIMITS.maxColumnsPerRow),
    style: styleSchema,
  })
  .superRefine((row, ctx) => {
    const sum = row.columns.reduce((acc, c) => acc + c.span, 0);
    if (sum > 12) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '列宽之和不能超过 12' });
    }
  });

const FORBIDDEN_CSS = [/@import/i, /url\s*\(/i, /expression\s*\(/i, /javascript\s*:/i, /behavior\s*:/i, /-moz-binding/i];

export function assertSafeCss(css: string | undefined): string | null {
  if (!css) return null;
  if (css.length > TEMPLATE_LIMITS.maxCssLength) return 'CSS 过长';
  for (const re of FORBIDDEN_CSS) {
    if (re.test(css)) return `CSS 包含禁止语法: ${re.source}`;
  }
  return null;
}

export const templateConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    layout: layoutEnum,
    primaryColor: z.string().min(1).max(64),
    fontFamily: z.string().min(1).max(64),
    fontSize: z.number().min(10).max(20),
    spacing: z.number().min(0.8).max(2),
    customCss: z.string().max(TEMPLATE_LIMITS.maxCssLength).optional().default(''),
    document: z.object({
      rows: z.array(rowSchema).min(1).max(TEMPLATE_LIMITS.maxRows),
    }),
  })
  .superRefine((cfg, ctx) => {
    const cssErr = assertSafeCss(cfg.customCss);
    if (cssErr) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: cssErr });
    }
  });

export type TTemplateConfig = z.infer<typeof templateConfigSchema>;

/** 旧配置兼容：仅主题字段时自动升级 */
export function normalizeIncomingConfig(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const cfg = raw as Record<string, unknown>;
  if (cfg.schemaVersion === 1 && cfg.document) return raw;

  const layout = (cfg.layout as string) || 'single-column';
  const id = () => crypto.randomUUID();
  const section = (type: string) => ({ id: id(), type: 'section', visible: true, sectionType: type });
  const basics = { id: id(), type: 'basics', visible: true };
  const avatar = { id: id(), type: 'avatar', visible: true };

  let document: { rows: unknown[] };
  if (layout === 'sidebar-left') {
    document = {
      rows: [
        {
          id: id(),
          columns: [
            {
              id: id(),
              span: 4,
              style: { backgroundColor: 'var(--primary)', color: '#ffffff', padding: '24px' },
              blocks: [avatar, basics, section('skills')],
            },
            {
              id: id(),
              span: 8,
              style: { padding: '24px' },
              blocks: [section('summary'), section('experience'), section('education'), section('projects')],
            },
          ],
        },
      ],
    };
  } else if (layout === 'sidebar-right') {
    document = {
      rows: [
        {
          id: id(),
          columns: [
            {
              id: id(),
              span: 8,
              style: { padding: '24px' },
              blocks: [section('summary'), section('experience'), section('education'), section('projects')],
            },
            {
              id: id(),
              span: 4,
              style: { backgroundColor: 'var(--primary)', color: '#ffffff', padding: '24px' },
              blocks: [avatar, basics, section('skills')],
            },
          ],
        },
      ],
    };
  } else if (layout === 'two-column') {
    document = {
      rows: [
        {
          id: id(),
          columns: [
            {
              id: id(),
              span: 12,
              style: { padding: '24px 24px 8px', textAlign: 'center' },
              blocks: [avatar, basics],
            },
          ],
        },
        {
          id: id(),
          columns: [
            {
              id: id(),
              span: 6,
              style: { padding: '12px 24px' },
              blocks: [section('summary'), section('experience'), section('projects')],
            },
            {
              id: id(),
              span: 6,
              style: { padding: '12px 24px' },
              blocks: [section('education'), section('skills')],
            },
          ],
        },
      ],
    };
  } else {
    document = {
      rows: [
        {
          id: id(),
          columns: [
            {
              id: id(),
              span: 12,
              style: { padding: '28px', textAlign: 'center' },
              blocks: [basics, { id: id(), type: 'divider', visible: true }],
            },
          ],
        },
        {
          id: id(),
          columns: [
            {
              id: id(),
              span: 12,
              style: { padding: '0 28px 28px' },
              blocks: [
                section('summary'),
                section('experience'),
                section('education'),
                section('skills'),
                section('projects'),
              ],
            },
          ],
        },
      ],
    };
  }

  return {
    schemaVersion: 1,
    layout,
    primaryColor: cfg.primaryColor || '#2563eb',
    fontFamily: cfg.fontFamily || 'Inter',
    fontSize: cfg.fontSize ?? 14,
    spacing: cfg.spacing ?? 1.15,
    customCss: cfg.customCss || '',
    document,
  };
}
