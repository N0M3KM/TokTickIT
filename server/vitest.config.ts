import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // พอร์ต 3001 ตามที่เปลี่ยนใน docker-compose
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/lab1-staging-docs/**'],
    environment: 'node',
  },
});