/**
 * API Key 类型（MCP 接入）
 */

export interface IApiKeySummary {
  api_key_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  is_revoked: boolean;
  revoked_at: string | null;
}

export interface IApiKeyCreated extends IApiKeySummary {
  /** 明文仅创建时返回一次 */
  api_key: string;
}
