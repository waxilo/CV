-- 简历锁定：锁定后不可编辑/删除（含 MCP），仅允许复制
ALTER TABLE resume ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0;
