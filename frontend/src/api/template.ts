import request from '/@/utils/request';
import type { IApiResponse, ITemplate, ITemplateConfig } from '/@/types/resume';

export function listTemplatesApi(): Promise<IApiResponse<ITemplate[]>> {
  return request.post('/api/template-service/v1/list-templates', {}).then((r) => r.data);
}

export function getTemplateDetailApi(templateId: string): Promise<IApiResponse<ITemplate>> {
  return request
    .post('/api/template-service/v1/get-detail', { template_id: templateId })
    .then((r) => r.data);
}

export function createTemplateApi(data: {
  name: string;
  description?: string;
  thumbnail_url?: string;
  config: ITemplateConfig;
}): Promise<IApiResponse<{ template_id: string }>> {
  return request.post('/api/template-service/v1/create-template', data).then((r) => r.data);
}
