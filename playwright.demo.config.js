import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/sandbox',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8088/odinbook/',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build:demo && node scripts/serve-demo.js',
    url: 'http://localhost:8088/odinbook/',
    timeout: 30000,
  },
});
