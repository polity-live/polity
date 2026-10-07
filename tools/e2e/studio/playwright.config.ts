import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'editor.e2e.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: 'list',
  outputDir: '../../../output/studio/browser-tests',
  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'output/studio/browser-state.json',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
