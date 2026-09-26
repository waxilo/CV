-- CV Builder 的 MySQL 结构（自托管，共享 mysql-server 容器）。
--
-- 与 D1 时代的语义对齐，差异都在注释里说明：
--   * D1 的 TEXT 列在这里按用途收敛为 VARCHAR（需要建索引/唯一约束的列 MySQL 必须定长前缀），
--     大 JSON（resume.data / template.config，上限约 200KB+）用 JSON 列（LONGTEXT 底，最大 1GB）。
--   * 时间列沿用 D1 的字符串存储（应用写 ISO 字符串；历史行混有 'YYYY-MM-DD HH:MM:SS'，
--     排序语义与 D1 时代一致，不做格式化迁移）。
--   * SQLite 的部分唯一索引（WHERE is_deleted = 0）MySQL 不支持，用「生成列 + 普通唯一索引」
--     复刻：非活跃行生成的辅助列为 NULL，MySQL 唯一索引不约束 NULL。
--   * D1 里 api_key.revoked_at + 软吊销触发器是滚动部署遗留（0006 已清空旧数据、删除即硬删），
--     这里不再保留 revoked_at 列。

CREATE TABLE IF NOT EXISTS `user` (
  id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(64) NULL,
  avatar_url VARCHAR(512) NULL,
  created_at VARCHAR(40) NOT NULL DEFAULT (''),
  updated_at VARCHAR(40) NOT NULL DEFAULT (''),
  deleted_at VARCHAR(40) NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_email (email),
  UNIQUE KEY uniq_user_username (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `resume` (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(100) NOT NULL,
  slug VARCHAR(64) NOT NULL,
  data JSON NOT NULL,
  template_id VARCHAR(64) NOT NULL DEFAULT 'modern',
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  share_token VARCHAR(36) NULL,
  created_at VARCHAR(40) NOT NULL DEFAULT (''),
  updated_at VARCHAR(40) NOT NULL DEFAULT (''),
  deleted_at VARCHAR(40) NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  -- 复刻 uniq_resume_user_slug_active ON resume(user_id, slug) WHERE is_deleted = 0
  slug_active VARCHAR(64) GENERATED ALWAYS AS (IF(`is_deleted` = 0, `slug`, NULL)) STORED,
  -- 复刻 uniq_resume_share_token_active WHERE share_token IS NOT NULL AND is_deleted = 0
  share_token_active VARCHAR(36) GENERATED ALWAYS AS (IF(`is_deleted` = 0 AND `share_token` IS NOT NULL, `share_token`, NULL)) STORED,
  PRIMARY KEY (id),
  KEY idx_resume_user_id (user_id),
  UNIQUE KEY uniq_resume_user_slug_active (user_id, slug_active),
  UNIQUE KEY uniq_resume_share_token_active (share_token_active)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `template` (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(64) NOT NULL,
  description VARCHAR(256) NULL,
  thumbnail_url VARCHAR(512) NULL,
  config JSON NOT NULL,
  engine VARCHAR(16) NOT NULL DEFAULT 'blocks',
  schema_version INT NOT NULL DEFAULT 1,
  is_builtin TINYINT(1) NOT NULL DEFAULT 1,
  user_id VARCHAR(36) NULL,
  created_at VARCHAR(40) NOT NULL DEFAULT (''),
  updated_at VARCHAR(40) NOT NULL DEFAULT (''),
  deleted_at VARCHAR(40) NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_template_engine (engine)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `api_key` (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(64) NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  key_hash VARCHAR(64) NOT NULL,
  encrypted_key VARCHAR(255) NULL,
  last_used_at VARCHAR(40) NULL,
  created_at VARCHAR(40) NOT NULL DEFAULT (''),
  is_revoked TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_api_key_hash (key_hash),
  KEY idx_api_key_user_id (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
