/**
 * 模板配置迁移
 *
 * 实现已上移到 shared/template-schema/src/migrate.ts，前后端共用。
 * 这里保留原有导出名，避免调用方改动。
 */

export {
  normalizeTemplateConfig,
  migrateTemplateConfig,
  createDefaultTemplateConfig,
  createDocumentFromLayout,
  createDefaultPage,
  createDefaultMeta,
  createDefaultCapabilities,
  createBaseVariables,
  cloneConfig,
  uid,
  DEFAULT_PAGE_MARGIN,
} from '@cv/template-schema';
