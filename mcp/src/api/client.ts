/**
 * CV Builder HTTP 客户端：调用现有 resume-service API。
 */

import type { IApiResponse, IResumeData, IResumeDetail, IResumeSummary } from './types.js';
import type { IMcpConfig } from '../config.js';

export class CvApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = 'CV_API_ERROR') {
    super(message);
    this.name = 'CvApiError';
    this.status = status;
    this.code = code;
  }
}

export class CvApiClient {
  constructor(private readonly config: IMcpConfig) {}

  async listResumes(): Promise<IResumeSummary[]> {
    const res = await this.post<IResumeSummary[]>('/api/resume-service/v1/list-resumes', {});
    return res.data ?? [];
  }

  async getResume(resumeId: string): Promise<IResumeDetail> {
    const res = await this.post<IResumeDetail>('/api/resume-service/v1/get-detail', {
      resume_id: resumeId,
    });
    if (!res.data) {
      throw new CvApiError('简历详情为空', 502, 'RESUME_EMPTY');
    }
    return res.data;
  }

  /**
   * 新建空简历（默认模板 modern）；可选随后由工具层写入完整 data。
   */
  async createResume(input: {
    title?: string;
    template_id?: string;
    slug?: string;
  }): Promise<{
    resume_id: string;
    title: string;
    slug: string;
    template_id: string;
    data: IResumeData;
  }> {
    const res = await this.post<{
      resume_id: string;
      title: string;
      slug: string;
      template_id: string;
      data: IResumeData;
    }>('/api/resume-service/v1/create-resume', input);
    if (!res.data) {
      throw new CvApiError('创建响应为空', 502, 'CREATE_EMPTY');
    }
    return res.data;
  }

  async updateResume(input: {
    resume_id: string;
    title?: string;
    data?: IResumeData;
    template_id?: string;
    is_public?: boolean;
    slug?: string;
  }): Promise<{ resume_id: string; is_public?: boolean; share_token?: string | null }> {
    const res = await this.post<{
      resume_id: string;
      is_public?: boolean;
      share_token?: string | null;
    }>('/api/resume-service/v1/update-resume', input);
    if (!res.data) {
      throw new CvApiError('更新响应为空', 502, 'UPDATE_EMPTY');
    }
    return res.data;
  }

  /**
   * 深拷贝一份简历；副本默认未锁定，适合 MCP 先复制再改，避免动原件。
   */
  async cloneResume(input: {
    resume_id: string;
    title?: string;
  }): Promise<{
    resume_id: string;
    title: string;
    slug: string;
    template_id: string;
    is_locked?: boolean;
    source_resume_id?: string;
  }> {
    const res = await this.post<{
      resume_id: string;
      title: string;
      slug: string;
      template_id: string;
      is_locked?: boolean;
      source_resume_id?: string;
    }>('/api/resume-service/v1/clone-resume', input);
    if (!res.data) {
      throw new CvApiError('复制响应为空', 502, 'CLONE_EMPTY');
    }
    return res.data;
  }

  private async post<T>(path: string, body: unknown): Promise<IApiResponse<T>> {
    const url = `${this.config.apiBase}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          Accept: 'application/json',
        },
        body: JSON.stringify(body ?? {}),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new CvApiError(`网络请求失败: ${detail}`, 0, 'NETWORK_ERROR');
    }

    let payload: IApiResponse<T> | null = null;
    const text = await response.text();
    try {
      payload = text ? (JSON.parse(text) as IApiResponse<T>) : null;
    } catch {
      throw new CvApiError(
        `API 返回非 JSON（HTTP ${response.status}）: ${text.slice(0, 200)}`,
        response.status,
        'INVALID_JSON'
      );
    }

    if (!response.ok || !payload?.success) {
      throw new CvApiError(
        payload?.message || `请求失败 HTTP ${response.status}`,
        response.status,
        payload?.code || 'HTTP_ERROR'
      );
    }

    return payload;
  }
}
