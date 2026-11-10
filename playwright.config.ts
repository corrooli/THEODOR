import { defineConfig, devices } from '@playwright/test';

// Local runs can point at an existing Chromium via CHROMIUM_PATH; CI installs browsers.
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4318/THEODOR/',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4318 --strictPort',
    url: 'http://localhost:4318/THEODOR/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
