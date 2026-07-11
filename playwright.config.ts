import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'regression',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
