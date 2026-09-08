import axios from 'axios';

/** token 本地存储键（论文 3.4.2 安全性：SPA 常规做法，XSS 防护依赖 React 转义） */
export const TOKEN_KEY = 'wangyan_token';

export interface ApiError {
  statusCode: number;
  message: string | string[];
}

/** 统一 axios 实例：开发期走 Vite 代理 → NestJS :13000（vite.config.ts） */
export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

/** 请求拦截：自动附带 Bearer Token（论文 5.2.3 身份校验的客户端配合） */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** 响应拦截：401 统一清理并跳登录页（路由守卫的兜底） */
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/** 从 Nest 错误响应中提取可展示的文案 */
export function extractErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: ApiError } })?.response?.data;
  if (!data?.message) return '网络错误，请稍后重试';
  return Array.isArray(data.message) ? data.message.join('；') : data.message;
}
