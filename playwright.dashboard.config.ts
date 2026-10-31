import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e/lab-04', testMatch: 'requester-dashboard.spec.ts', workers: 1,
  reporter: 'list', outputDir: 'artifacts/lab-04/dashboard-browser-output', timeout: 45_000,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL, browserName: 'chromium', channel: 'chrome' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'tablet', use: { viewport: { width: 900, height: 1024 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } },
    { name: 'narrow', use: { viewport: { width: 320, height: 812 } } },
  ],
});
