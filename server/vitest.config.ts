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
    // Real database cases require the disposable-cluster harness:
    // npm run test:workflow-db (from repository root).
    exclude: ['tests/**/lab1-staging-docs/**', 'tests/**/*.db.test.ts'],
    environment: 'node',
  },
});
