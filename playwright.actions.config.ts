import { defineConfig } from '@playwright/test';

/** API-mocked UI contract suite; deliberately separate from real persistence E2E. */
export default defineConfig({
  testDir: './e2e/lab-04', testMatch: 'actions-taken-ui.spec.ts', workers: 1,
  reporter: 'list', outputDir: 'artifacts/lab-04/browser-output',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
    browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'tablet', use: { viewport: { width: 900, height: 1024 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } },
    { name: 'narrow', use: { viewport: { width: 320, height: 812 } } },
  ],
});
