import { defineConfig, devices } from '@playwright/test';
import { config as loadDotEnv } from 'dotenv';

// Explicit CLI/CI values always win; local files only provide missing defaults.
loadDotEnv({ path: '.env.development.local', override: false, quiet: true });
loadDotEnv({ path: '.env.test.local', override: false, quiet: true });

const appBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const zeroBaseUrl = process.env.VITE_ZERO_CACHE_URL ?? 'http://127.0.0.1:4848';
const zeroKeepaliveUrl = new URL('/keepalive', zeroBaseUrl).href;
const reuseExistingServer = process.env.E2E_REUSE_SERVER === '1';
const appCommand = process.env.E2E_APP_COMMAND ?? 'npm run test:e2e:serve';
const webServerGracefulShutdown = { signal: 'SIGTERM' as const, timeout: 10_000 };

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120 * 1000,
  globalTimeout: process.env.CI ? 15 * 60 * 1000 : undefined,
  /* Global setup to prepare test users */
  globalSetup: './e2e/global-setup.ts',
  /* Global teardown only closes suite resources. Test fixtures own their exact data. */
  globalTeardown: './e2e/global-teardown.ts',
  /* Files may be sharded across isolated stacks; tests sharing one stack stay sequential. */
  fullyParallel: false,
  workers: 1,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? process.env.PLAYWRIGHT_BLOB_REPORT === '1'
      ? [
          ['line'],
          ['github'],
          ['blob', { outputDir: process.env.PLAYWRIGHT_BLOB_DIR ?? 'blob-report' }],
        ]
      : [
          ['line'],
          ['github'],
          ['html', { open: 'never', outputFolder: process.env.PLAYWRIGHT_REPORT_DIR }],
        ]
    : [['line'], ['html', { open: 'never', outputFolder: process.env.PLAYWRIGHT_REPORT_DIR }]],
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: appBaseUrl,
    trace: 'retain-on-first-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    timezoneId: 'Europe/Berlin',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'chromium-mobile',
      grep: /@mobile/,
      use: {
        ...devices['Pixel 5'],
      },
    },

    // Uncomment to test on Firefox (requires: npx playwright install firefox)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // Uncomment to test on WebKit (requires: npx playwright install webkit)
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: appCommand,
      url: appBaseUrl,
      reuseExistingServer,
      timeout: 300 * 1000,
      gracefulShutdown: webServerGracefulShutdown,
    },
    {
      command: 'npm run zero:dev',
      url: zeroKeepaliveUrl,
      reuseExistingServer,
      timeout: 180 * 1000,
      gracefulShutdown: webServerGracefulShutdown,
    },
  ],
});
