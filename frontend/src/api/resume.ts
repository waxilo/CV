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
}): Promise<IApiResponse<{ resume_id: string }>> {
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
