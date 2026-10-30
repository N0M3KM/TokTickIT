import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/lab-04/ticket-workflow.db.test.ts'],
    environment: 'node', fileParallelism: false, maxWorkers: 1, minWorkers: 1,
    testTimeout: 20_000, hookTimeout: 30_000,
  },
});
