import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 开发期：本地起服务，API 与 WebSocket 代理到 NestJS（论文 5.1.3）
export default defineConfig({
  plugins: [react()],
  build: {
    // antd 全量引入固有大（gzip 后 ~260KB），分包后阈值放宽保持构建输出干净
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 依赖分包（论文 5.9.1）：antd / 编辑器 / 协作三大块拆开，避免单 chunk 过大。
        // 用函数式按 node_modules 路径分包：y-protocols 等包无 "." 导出，对象式写法无法解析
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('antd') || id.includes('@ant-design') || id.includes('dayjs') || id.includes('/rc-')) {
            return 'antd';
          }
          if (id.includes('@tiptap') || id.includes('tiptap-markdown') || id.includes('prosemirror')) {
            return 'tiptap';
          }
          if (id.includes('yjs') || id.includes('y-protocols') || id.includes('y-websocket') || id.includes('lib0')) {
            return 'yjs';
          }
          if (id.includes('react') || id.includes('scheduler')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
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
