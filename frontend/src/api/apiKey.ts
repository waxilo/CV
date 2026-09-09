import request from '/@/utils/request';
import type { IApiResponse } from '/@/types/resume';
import type { IApiKeyCreated, IApiKeySecret, IApiKeySummary } from '/@/types/apiKey';

export function createApiKeyApi(data?: {
  name?: string;
}): Promise<IApiResponse<IApiKeyCreated>> {
  return request.post('/api/auth-service/v1/create-api-key', data ?? {}).then((r) => r.data);
}

export function listApiKeysApi(): Promise<IApiResponse<IApiKeySummary[]>> {
  return request.post('/api/auth-service/v1/list-api-keys', {}).then((r) => r.data);
}

export function getApiKeyApi(apiKeyId: string): Promise<IApiResponse<IApiKeySecret>> {
  return request
    .post('/api/auth-service/v1/get-api-key', { api_key_id: apiKeyId })
    .then((r) => r.data);
}

export function rotateApiKeyApi(apiKeyId: string): Promise<IApiResponse<IApiKeySecret>> {
  return request
    .post('/api/auth-service/v1/rotate-api-key', { api_key_id: apiKeyId })
    .then((r) => r.data);
}

export function revokeApiKeyApi(apiKeyId: string): Promise<IApiResponse<{ api_key_id: string }>> {
  return request
    .post('/api/auth-service/v1/revoke-api-key', { api_key_id: apiKeyId })
    .then((r) => r.data);
}
