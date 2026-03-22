import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3000',
    channel: 'chrome',
    headless: true,
  },
  webServer: [
    {
      command: 'npm run dev -w @flower-survey/backend',
      url: 'http://localhost:4000/api/v1/surveys/flower-soul-profile/active',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w @flower-survey/frontend',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        BACKEND_ORIGIN: 'http://localhost:4000',
      },
    },
  ],
});
