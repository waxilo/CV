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
  /** 模板配置 JSON：布局、配色、字体等 */
  config: text('config', { mode: 'json' }).notNull(),
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
