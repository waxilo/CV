import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
});

export const resumes = sqliteTable('resume', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  /** JSON Resume 结构：basics / sections / metadata */
  data: text('data', { mode: 'json' }).notNull(),
  templateId: text('template_id').notNull().default('modern'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  /** 公开分享令牌；每次开启分享重新生成，关闭后置空 */
  shareToken: text('share_token'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
});

export const templates = sqliteTable('template', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  /** 预览图 URL */
  thumbnailUrl: text('thumbnail_url'),
  /** 模板配置 JSON：engine / source / variables / page，见 shared/template-schema */
  config: text('config', { mode: 'json' }).notNull(),
  /**
   * 渲染引擎，从 config.engine 冗余出来。
   * 单独成列是为了模板中心按引擎筛选，以及后续审核流程按引擎分流。
   */
  engine: text('engine').notNull().default('blocks'),
  /** config 的结构版本，冗余列便于批量迁移时定位老数据 */
  schemaVersion: integer('schema_version').notNull().default(1),
  /** 是否系统内置模板 */
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(true),
  /** 上传者（自定义模板） */
  userId: text('user_id'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
