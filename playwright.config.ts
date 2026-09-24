import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync('.tools/browsers'))
  process.env.PLAYWRIGHT_BROWSERS_PATH = resolve('.tools/browsers');
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
    ...(process.env.EVACU_TEST_EDGE
      ? [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }]
      : []),
  ],
});
