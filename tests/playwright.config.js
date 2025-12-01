import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries:0,
  workers:1,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
    actionTimeout:1000
  },
  webServer: {
    command: 'node app.js',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // This will auto-start app when tests run
  webServer: {
    command: 'node app.js',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});