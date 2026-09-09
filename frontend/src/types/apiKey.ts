/**
 * API Key 类型（MCP 接入）
 */

export interface IApiKeySummary {
  api_key_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  can_copy: boolean;
}

export interface IApiKeyCreated {
  api_key_id: string;
  name: string;
  key_prefix: string;
  api_key: string;
  created_at: string;
}

export interface IApiKeySecret {
  api_key_id: string;
  api_key: string;
}
