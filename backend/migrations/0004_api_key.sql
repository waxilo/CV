-- API Key：供 MCP / 外部工具鉴权，明文仅创建时返回一次
CREATE TABLE IF NOT EXISTS api_key (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  is_revoked INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_api_key_hash
  ON api_key(key_hash);

CREATE INDEX IF NOT EXISTS idx_api_key_user_id
  ON api_key(user_id);

CREATE INDEX IF NOT EXISTS idx_api_key_user_active
  ON api_key(user_id)
  WHERE is_revoked = 0;
