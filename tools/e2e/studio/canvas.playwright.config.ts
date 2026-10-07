import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'canvas.e2e.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 20000 },
  reporter: 'list',
  outputDir: '../../../output/studio/canvas-browser-tests',
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1440, height: 1100 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
