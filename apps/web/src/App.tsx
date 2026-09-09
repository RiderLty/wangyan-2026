import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { Spin } from 'antd';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { TOKEN_KEY } from './api/client';

/** 路由守卫（论文 5.2.3）：未登录访问受保护页 → 重定向 /login */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="正在验证登录状态..." />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** ⚠️ 临时开发路由：headless 截图用，写入 token 后跳转（截图完成后移除） */
function DevLogin() {
  const [params] = useSearchParams();
  useEffect(() => {
    const token = params.get('token');
    if (token) localStorage.setItem(TOKEN_KEY, token);
    const nid = params.get('note');
    const kw = params.get('kw');
    const qs: string[] = [];
    if (nid) qs.push(`note=${nid}`);
    if (kw) qs.push(`q=${encodeURIComponent(kw)}`);
    window.location.replace('/' + (qs.length ? `?${qs.join('&')}` : ''));
  }, [params]);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" />
    </div>
  );
}

/** 路由表：公开页（登录/注册）+ 受保护页（业务） */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/__dev_login" element={<DevLogin />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
