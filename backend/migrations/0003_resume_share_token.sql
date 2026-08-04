-- 简历在线分享令牌：每次开启分享重新生成，关闭后旧链接失效
ALTER TABLE resume ADD COLUMN share_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_resume_share_token_active
  ON resume(share_token)
  WHERE share_token IS NOT NULL AND is_deleted = 0;
