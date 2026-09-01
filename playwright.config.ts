import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for TokTickIT Lab 2 E2E and responsive tests.
 * tests.md §5 (Test Commands), ui-spec.md §13 (Screenshot Paths)
 *
 * Run: npx playwright test e2e/lab-02/
 * The full stack (client + server) must be running before executing E2E tests.
 *   Client: http://localhost:5173  (npm run dev inside client/)
 *   Server: http://localhost:3000  (npm run dev inside server/)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  outputDir: 'artifacts/lab-02/screenshots/test-output',

  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad (gen 7)'],
        viewport: { width: 900, height: 1024 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
});
