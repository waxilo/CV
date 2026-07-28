import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { ElMessage } from 'element-plus';
import type { IApiResponse } from '/@/types/resume';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function detectPlatform(): string {
  const w = window as Window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  if (w.__TAURI_INTERNALS__ || w.__TAURI__) return 'desktop';
  return 'web';
}

const request: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-App-Version': '1.0.0',
    'X-Platform': detectPlatform(),
  },
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('cv_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Request-Id'] = crypto.randomUUID();
  return config;
});

request.interceptors.response.use(
  (response) => {
    const data = response.data as IApiResponse;
    if (data && data.success === false) {
      ElMessage.error(data.message || '请求失败');
      return Promise.reject(data);
    }
    return response;
  },
  (error: AxiosError<IApiResponse>) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || '网络错误';

    if (status === 401) {
      localStorage.removeItem('cv_token');
      localStorage.removeItem('cv_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      }
      ElMessage.error('登录已过期，请重新登录');
    } else {
      ElMessage.error(message);
    }
    return Promise.reject(error);
  }
);

export default request;
