import { v4 as uuidv4 } from 'uuid';
import type {
  ILegacyTemplateConfig,
  ITemplateConfig,
  ITemplateDocument,
  TTemplateLayout,
} from '/@/types/template';

function uid(): string {
  return uuidv4();
}

function sectionBlock(sectionType: string) {
  return {
    id: uid(),
    type: 'section' as const,
    visible: true,
    sectionType: sectionType as ITemplateConfig['document']['rows'][0]['columns'][0]['blocks'][0]['sectionType'],
  };
}

/**
 * 根据旧 layout 生成默认 document 栅格
 */
export function createDocumentFromLayout(layout: TTemplateLayout): ITemplateDocument {
  const basics = { id: uid(), type: 'basics' as const, visible: true };
  const avatar = { id: uid(), type: 'avatar' as const, visible: true };
  const summary = sectionBlock('summary');
  const experience = sectionBlock('experience');
  const education = sectionBlock('education');
  const skills = sectionBlock('skills');
  const projects = sectionBlock('projects');

  if (layout === 'sidebar-left') {
    return {
      rows: [
        {
          id: uid(),
          columns: [
            {
              id: uid(),
              span: 4,
              style: { backgroundColor: 'var(--primary)', color: '#ffffff', padding: '24px' },
              blocks: [avatar, basics, skills],
            },
            {
              id: uid(),
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
          id: uid(),
          columns: [
            {
              id: uid(),
              span: 8,
              style: { padding: '24px' },
              blocks: [summary, experience, education, projects],
            },
            {
              id: uid(),
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
          id: uid(),
          columns: [
            {
              id: uid(),
              span: 12,
              style: { padding: '24px 24px 8px', textAlign: 'center' },
              blocks: [avatar, basics],
            },
          ],
        },
        {
          id: uid(),
          columns: [
            {
              id: uid(),
              span: 6,
              style: { padding: '12px 24px' },
              blocks: [summary, experience, projects],
            },
            {
              id: uid(),
              span: 6,
              style: { padding: '12px 24px' },
              blocks: [education, skills],
            },
          ],
        },
      ],
    };
  }

  // single-column
  return {
    rows: [
      {
        id: uid(),
        columns: [
          {
            id: uid(),
            span: 12,
            style: { padding: '28px', textAlign: 'center' },
            blocks: [basics, { id: uid(), type: 'divider', visible: true }],
          },
        ],
      },
      {
        id: uid(),
        columns: [
          {
            id: uid(),
            span: 12,
            style: { padding: '0 28px 28px' },
            blocks: [summary, experience, education, skills, projects],
          },
        ],
      },
    ],
  };
}

export function createDefaultTemplateConfig(
  layout: TTemplateLayout = 'single-column',
  overrides: Partial<ITemplateConfig> = {}
): ITemplateConfig {
  return {
    schemaVersion: 1,
    layout,
    primaryColor: overrides.primaryColor || '#2563eb',
    fontFamily: overrides.fontFamily || 'Inter',
    fontSize: overrides.fontSize ?? 14,
    spacing: overrides.spacing ?? 1.15,
    customCss: overrides.customCss || '',
    document: overrides.document || createDocumentFromLayout(layout),
  };
}

/**
 * 将任意旧/新配置规范化为 schemaVersion=1
 */
export function migrateTemplateConfig(raw: unknown): ITemplateConfig {
  const cfg = (raw && typeof raw === 'object' ? raw : {}) as ILegacyTemplateConfig;
  const layout = cfg.layout || 'single-column';
  const base = createDefaultTemplateConfig(layout, {
    primaryColor: cfg.primaryColor,
    fontFamily: cfg.fontFamily,
    fontSize: cfg.fontSize,
    spacing: cfg.spacing,
    customCss: cfg.customCss || '',
  });

  if (cfg.schemaVersion === 1 && cfg.document?.rows?.length) {
    return {
      ...base,
      document: cfg.document,
      customCss: cfg.customCss || '',
    };
  }

  return base;
}
