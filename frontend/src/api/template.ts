import request from '/@/utils/request';
import type { IApiResponse } from '/@/types/resume';
import type { ITemplate, ITemplateConfig } from '/@/types/template';

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

export function updateTemplateApi(data: {
  template_id: string;
  name?: string;
  description?: string;
  thumbnail_url?: string;
  config?: ITemplateConfig;
}): Promise<IApiResponse<{ template_id: string }>> {
  return request.post('/api/template-service/v1/update-template', data).then((r) => r.data);
}

export function deleteTemplateApi(templateId: string): Promise<IApiResponse<void>> {
  return request
    .post('/api/template-service/v1/delete-template', { template_id: templateId })
    .then((r) => r.data);
}

export function cloneTemplateApi(
  templateId: string,
  name?: string
): Promise<IApiResponse<{ template_id: string }>> {
  return request
    .post('/api/template-service/v1/clone-template', { template_id: templateId, name })
    .then((r) => r.data);
}
