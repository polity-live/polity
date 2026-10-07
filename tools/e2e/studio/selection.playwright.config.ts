import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'selection.e2e.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: 'list',
  outputDir: '../../../output/studio/selection-browser-tests',
  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'output/studio/browser-state.json',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
