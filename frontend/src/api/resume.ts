import request from '/@/utils/request';
import type { IApiResponse, IResumeData, IResumeDetail, IResumeSummary } from '/@/types/resume';

export function createResumeApi(data: {
  title?: string;
  template_id?: string;
  slug?: string;
}): Promise<IApiResponse<{ resume_id: string; title: string; slug: string; template_id: string; data: IResumeData }>> {
  return request.post('/api/resume-service/v1/create-resume', data).then((r) => r.data);
}

export function listResumesApi(): Promise<IApiResponse<IResumeSummary[]>> {
  return request.post('/api/resume-service/v1/list-resumes', {}).then((r) => r.data);
}

export function getResumeDetailApi(resumeId: string): Promise<IApiResponse<IResumeDetail>> {
  return request.post('/api/resume-service/v1/get-detail', { resume_id: resumeId }).then((r) => r.data);
}

export function updateResumeApi(data: {
  resume_id: string;
  title?: string;
  data?: IResumeData;
  template_id?: string;
  is_public?: boolean;
  slug?: string;
}): Promise<IApiResponse<{ resume_id: string; is_public?: boolean; share_token?: string | null }>> {
  return request.post('/api/resume-service/v1/update-resume', data).then((r) => r.data);
}

export function deleteResumeApi(resumeId: string): Promise<IApiResponse<void>> {
  return request.post('/api/resume-service/v1/delete-resume', { resume_id: resumeId }).then((r) => r.data);
}

export function cloneResumeApi(
  resumeId: string
): Promise<IApiResponse<{ resume_id: string; title: string; slug: string; template_id: string }>> {
  return request
    .post('/api/resume-service/v1/clone-resume', { resume_id: resumeId })
    .then((r) => r.data);
}

/** 公开分享预览（无需登录）；返回最新简历数据 + 模板配置 */
export interface ISharedResumePayload {
  resume_id: string;
  title: string;
  slug: string;
  template_id: string;
  data: IResumeData;
  template_config: unknown;
  updated_at: string;
}

export function getSharedResumeApi(shareToken: string): Promise<IApiResponse<ISharedResumePayload>> {
  return request.post('/api/share-service/v1/get-resume', { share_token: shareToken }).then((r) => r.data);
}
