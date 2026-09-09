-- 保存可恢复的 API Key 密文；旧 Key 为空，首次复制时轮换
ALTER TABLE api_key ADD COLUMN encrypted_key TEXT;
