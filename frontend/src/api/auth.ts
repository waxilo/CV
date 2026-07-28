import request from '/@/utils/request';
import type { IApiResponse, IUser } from '/@/types/resume';

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest {
  email: string;
  username: string;
  password: string;
  display_name?: string;
}

export interface IAuthResult {
  token: string;
  user: IUser;
}

export function loginApi(data: ILoginRequest): Promise<IApiResponse<IAuthResult>> {
  return request.post('/api/auth-service/v1/login', data).then((r) => r.data);
}

export function registerApi(data: IRegisterRequest): Promise<IApiResponse<IAuthResult>> {
  return request.post('/api/auth-service/v1/register', data).then((r) => r.data);
}

export function getProfileApi(): Promise<IApiResponse<IUser>> {
  return request.post('/api/auth-service/v1/get-profile', {}).then((r) => r.data);
}
