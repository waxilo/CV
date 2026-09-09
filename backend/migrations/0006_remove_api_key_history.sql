-- 清除已有吊销记录，并兼容滚动部署期间旧 Worker 的软吊销逻辑
DELETE FROM api_key WHERE is_revoked = 1;

CREATE TRIGGER IF NOT EXISTS delete_revoked_api_key
AFTER UPDATE OF is_revoked ON api_key
WHEN NEW.is_revoked = 1
BEGIN
  DELETE FROM api_key WHERE id = NEW.id;
END;
