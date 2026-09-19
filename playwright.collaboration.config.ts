import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
for (const path of ['.env', '.env.local', '.env.development', '.env.development.local'])
  config({ path, override: false, quiet: true });

/** Uses only the already running, guarded acceptance stack and its demo users. */
export default defineConfig({
  testDir: './tools/collaboration/e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [
    ['line'],
    ['json', { outputFile: 'output/collaboration-migration/browser-results.json' }],
  ],
  outputDir: 'output/collaboration-migration/browser-artifacts',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
