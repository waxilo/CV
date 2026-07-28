-- 用户表
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_email_active ON user(email) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_username_active ON user(username) WHERE is_deleted = 0;

-- 简历表
CREATE TABLE IF NOT EXISTS resume (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  data TEXT NOT NULL,
  template_id TEXT NOT NULL DEFAULT 'modern',
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_resume_user_id ON resume(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_resume_user_slug_active ON resume(user_id, slug) WHERE is_deleted = 0;

-- 模板表
CREATE TABLE IF NOT EXISTS template (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  config TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 1,
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0
);

-- 内置模板种子数据
INSERT OR IGNORE INTO template (id, name, description, thumbnail_url, config, is_builtin) VALUES
(
  'modern',
  '现代简约',
  '左侧强调色栏 + 右侧内容，适合互联网岗位',
  NULL,
  '{"layout":"sidebar-left","primaryColor":"#2563eb","fontFamily":"Inter","fontSize":14,"spacing":1.15}',
  1
),
(
  'classic',
  '经典正式',
  '居中标题 + 分节横线，适合传统行业',
  NULL,
  '{"layout":"single-column","primaryColor":"#1e293b","fontFamily":"Georgia","fontSize":14,"spacing":1.2}',
  1
),
(
  'minimal',
  '极简白',
  '大量留白、轻量排版，适合设计/产品岗',
  NULL,
  '{"layout":"single-column","primaryColor":"#0f172a","fontFamily":"Helvetica","fontSize":13,"spacing":1.3}',
  1
);
