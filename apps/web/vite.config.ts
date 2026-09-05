import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 开发期：本地起服务，API 与 WebSocket 代理到 NestJS（论文 5.1.3）
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:13000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:13000',
        ws: true,
      },
    },
  },
});
