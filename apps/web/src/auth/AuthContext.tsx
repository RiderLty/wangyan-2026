import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, extractErrorMessage, TOKEN_KEY } from '../api/client';

/** 脱敏用户信息（与服务端 users 表字段对应，论文 4.3.2） */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 认证上下文（论文 5.2.4 界面背后的前端状态管理）
 * 轻量方案：React Context + localStorage，不引入状态库（AGENTS §2.3）
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  // 启动时若有 token，拉取当前用户校验会话有效性
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setInitializing(false);
      return;
    }
    api
      .get<AuthUser>('/users/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setInitializing(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    });
    localStorage.setItem(TOKEN_KEY, res.data.access_token);
    setUser(res.data.user);
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      await api.post('/auth/register', { email, username, password });
      // 注册成功后自动登录
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // token 已失效时登出接口 401，忽略即可
      extractErrorMessage(e);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, register, logout }),
    [user, initializing, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
