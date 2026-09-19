import { defineConfig, devices } from '@playwright/test';
import { config as loadDotEnv } from 'dotenv';

// Explicit CLI/CI values always win; local files only provide missing defaults.
loadDotEnv({ path: '.env.development.local', override: false, quiet: true });
loadDotEnv({ path: '.env.test.local', override: false, quiet: true });

const appBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const zeroBaseUrl = process.env.VITE_ZERO_CACHE_URL ?? 'http://127.0.0.1:4848';
const zeroKeepaliveUrl = new URL('/keepalive', zeroBaseUrl).href;
const reuseExistingServer = process.env.E2E_REUSE_SERVER === '1';
const appCommand = process.env.E2E_APP_COMMAND ?? 'pnpm run test:e2e:serve';
const zeroCommand = process.env.E2E_ZERO_COMMAND ?? 'pnpm exec zero-cache';
const zeroAdminPassword = process.env.ZERO_ADMIN_PASSWORD || 'polity-e2e-local-only';
// The cache child and global readiness probe must use the same credential.
process.env.ZERO_ADMIN_PASSWORD = zeroAdminPassword;
const zeroStartupTimeout = Number(process.env.E2E_ZERO_STARTUP_TIMEOUT_MS ?? 180_000);
const collaborationBaseUrl = process.env.E2E_COLLABORATION_URL ?? 'http://127.0.0.1:1236';
const collaborationUrl = new URL(collaborationBaseUrl);
const webServerGracefulShutdown = { signal: 'SIGTERM' as const, timeout: 10_000 };
const configuredGlobalTimeout = process.env.E2E_GLOBAL_TIMEOUT_MS;
const globalTimeout =
  configuredGlobalTimeout === undefined
    ? process.env.CI
      ? 15 * 60 * 1000
      : undefined
    : Number(configuredGlobalTimeout);
if (
  configuredGlobalTimeout !== undefined &&
  (!Number.isSafeInteger(globalTimeout) || (globalTimeout ?? 0) <= 0)
) {
  throw new Error('E2E_GLOBAL_TIMEOUT_MS must be a positive safe integer in milliseconds');
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120 * 1000,
  globalTimeout,
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

    // Uncomment to test on Firefox (requires: pnpm exec playwright install firefox)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // Uncomment to test on WebKit (requires: pnpm exec playwright install webkit)
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
      env: {
        STUDIO_ENABLED: 'true',
        STUDIO_PILOT_USER_IDS: '',
        COLLABORATION_WEBSOCKET_URL: collaborationBaseUrl.replace(/^http/, 'ws'),
      },
      url: appBaseUrl,
      reuseExistingServer,
      timeout: 300 * 1000,
      gracefulShutdown: webServerGracefulShutdown,
    },
    {
      command: zeroCommand,
      // Run the cache directly: the development supervisor can outlive its
      // shell during teardown and keep Playwright's output pipes open.
      env: {
        ZERO_ADMIN_PASSWORD: zeroAdminPassword,
        ZERO_UPSTREAM_DB:
          process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
        ZERO_QUERY_URL: new URL('/api/query', appBaseUrl).href,
        ZERO_MUTATE_URL: new URL('/api/mutate', appBaseUrl).href,
        ZERO_PORT: new URL(zeroBaseUrl).port || '4848',
        ZERO_NUM_SYNC_WORKERS: '3',
        ZERO_CVR_MAX_CONNS: '6',
        ZERO_UPSTREAM_MAX_CONNS: '6',
        ZERO_CVR_GARBAGE_COLLECTION_INACTIVITY_THRESHOLD_HOURS: '0.25',
        ZERO_CVR_GARBAGE_COLLECTION_INITIAL_INTERVAL_SECONDS: '30',
        ZERO_CVR_GARBAGE_COLLECTION_INITIAL_BATCH_SIZE: '100',
      },
      url: zeroKeepaliveUrl,
      reuseExistingServer,
      timeout: zeroStartupTimeout,
      gracefulShutdown: webServerGracefulShutdown,
    },
    {
      command: 'pnpm run collaboration:server',
      url: new URL('/health', collaborationUrl).href,
      env: { PORT: collaborationUrl.port || '1236' },
      reuseExistingServer,
      timeout: 60_000,
      gracefulShutdown: webServerGracefulShutdown,
    },
  ],
});
