import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://localhost:3020', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3020/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
