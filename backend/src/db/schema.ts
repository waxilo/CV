import { boolean, index, int, json, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const users = mysqlTable('user', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 64 }),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  createdAt: varchar('created_at', { length: 40 }).notNull().default(sql`''`),
  updatedAt: varchar('updated_at', { length: 40 }).notNull().default(sql`''`),
  deletedAt: varchar('deleted_at', { length: 40 }),
  isDeleted: boolean('is_deleted').notNull().default(false),
});

export const resumes = mysqlTable(
  'resume',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    title: varchar('title', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    /** JSON Resume 结构：basics / sections / metadata */
    data: json('data').notNull(),
    templateId: varchar('template_id', { length: 64 }).notNull().default('modern'),
    isPublic: boolean('is_public').notNull().default(false),
    /** 锁定后禁止编辑/删除（含 MCP），仅允许复制 */
    isLocked: boolean('is_locked').notNull().default(false),
    /** 公开分享令牌；每次开启分享重新生成，关闭后置空 */
    shareToken: varchar('share_token', { length: 36 }),
    createdAt: varchar('created_at', { length: 40 }).notNull().default(sql`''`),
    updatedAt: varchar('updated_at', { length: 40 }).notNull().default(sql`''`),
    deletedAt: varchar('deleted_at', { length: 40 }),
    isDeleted: boolean('is_deleted').notNull().default(false),
  },
  (table) => ({
    userIndex: index('idx_resume_user_id').on(table.userId),
  })
);

export const templates = mysqlTable('template', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 256 }),
  /** 预览图 URL */
  thumbnailUrl: varchar('thumbnail_url', { length: 512 }),
  /** 模板配置 JSON：engine / source / variables / page，见 shared/template-schema */
  config: json('config').notNull(),
  /**
   * 渲染引擎，从 config.engine 冗余出来。
   * 单独成列是为了模板中心按引擎筛选，以及后续审核流程按引擎分流。
   */
  engine: varchar('engine', { length: 16 }).notNull().default('blocks'),
  /** config 的结构版本，冗余列便于批量迁移时定位老数据 */
  schemaVersion: int('schema_version').notNull().default(1),
  /** 是否系统内置模板 */
  isBuiltin: boolean('is_builtin').notNull().default(true),
  /** 上传者（自定义模板） */
  userId: varchar('user_id', { length: 36 }),
  createdAt: varchar('created_at', { length: 40 }).notNull().default(sql`''`),
  updatedAt: varchar('updated_at', { length: 40 }).notNull().default(sql`''`),
  deletedAt: varchar('deleted_at', { length: 40 }),
  isDeleted: boolean('is_deleted').notNull().default(false),
});

/** MCP / 外部工具 API Key；哈希用于鉴权，密文用于用户按需复制 */
export const apiKeys = mysqlTable(
  'api_key',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    /** 列表展示前缀，如 cvk_xxxxxxxx… */
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    /** SHA-256(明文) 十六进制 */
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    /** AES-GCM 密文；旧记录为空，复制前需轮换 */
    encryptedKey: varchar('encrypted_key', { length: 255 }),
    lastUsedAt: varchar('last_used_at', { length: 40 }),
    createdAt: varchar('created_at', { length: 40 }).notNull().default(sql`''`),
    isRevoked: boolean('is_revoked').notNull().default(false),
  },
  (table) => ({
    hashUnique: uniqueIndex('uniq_api_key_hash').on(table.keyHash),
    userIndex: index('idx_api_key_user_id').on(table.userId),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
