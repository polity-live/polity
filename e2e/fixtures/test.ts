import fs from 'node:fs/promises';
import path from 'node:path';
import { test as base } from '@playwright/test';

import { cleanupE2ERows } from './cleanup';
import { authenticateWorker, ensureE2EAuthUser, type E2EWorkerUser } from './auth';
import { seedCreatePrerequisites, type SeedData } from './seed';
import { CreateFlowPage, createSmokeTestTimeoutMs } from './create-flow-page';

const LOCK_DIR = path.join(process.cwd(), 'test-results', '.locks');
const AUTH_LOCK_PATH = path.join(LOCK_DIR, 'create-auth.lock');
const SMOKE_LOCK_PATH = path.join(LOCK_DIR, 'create-smoke.lock');
const DEFAULT_SMOKE_LOCK_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_SMOKE_LOCK_STALE_MS = 30 * 60_000;
const DEFAULT_AUTH_LOCK_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_AUTH_LOCK_STALE_MS = 10 * 60_000;

interface TestFixtures {
  _createSmokeTimeout: undefined;
  _mockCurrencyApi: undefined;
  createFlowPage: CreateFlowPage;
  e2eRun: {
    prefix: string;
  };
  seed: SeedData;
}

interface WorkerFixtures {
  workerStorageState: string;
  e2eUser: E2EWorkerUser;
}

function sanitizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function configuredMs(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function errorCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined;
}

async function removeStaleLock(lockPath: string, staleAfterMs: number, now = Date.now()) {
  try {
    const stat = await fs.stat(lockPath);
    if (now - stat.mtimeMs > staleAfterMs) {
      await fs.unlink(lockPath);
    }
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
}

async function acquireLock(
  lockPath: string,
  options: {
    timeoutMs: number;
    staleAfterMs: number;
    metadata: Record<string, unknown>;
  }
) {
  await fs.mkdir(LOCK_DIR, { recursive: true });
  const { timeoutMs, staleAfterMs, metadata } = options;
  const deadline = Date.now() + timeoutMs;
  const token = `${process.pid}:${Date.now()}:${Math.random()}`;

  while (Date.now() < deadline) {
    try {
      const file = await fs.open(lockPath, 'wx');
      await file.writeFile(
        JSON.stringify({
          token,
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
          ...metadata,
        })
      );
      await file.close();

      return async () => {
        try {
          const raw = await fs.readFile(lockPath, 'utf8');
          if (raw.includes(token)) {
            await fs.unlink(lockPath);
          }
        } catch (error) {
          if (errorCode(error) !== 'ENOENT') throw error;
        }
      };
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') throw error;
      await removeStaleLock(lockPath, staleAfterMs);
      await sleep(250);
    }
  }

  throw new Error(`Timed out waiting for ${lockPath} after ${timeoutMs}ms.`);
}

async function acquireSmokeLock(testInfo: { title: string; workerIndex: number }) {
  return acquireLock(SMOKE_LOCK_PATH, {
    timeoutMs: configuredMs('E2E_CREATE_SMOKE_LOCK_TIMEOUT_MS', DEFAULT_SMOKE_LOCK_TIMEOUT_MS),
    staleAfterMs: configuredMs('E2E_CREATE_SMOKE_LOCK_STALE_MS', DEFAULT_SMOKE_LOCK_STALE_MS),
    metadata: {
      workerIndex: testInfo.workerIndex,
      title: testInfo.title,
    },
  });
}

async function acquireAuthLock(workerIndex: number) {
  return acquireLock(AUTH_LOCK_PATH, {
    timeoutMs: configuredMs('E2E_CREATE_AUTH_LOCK_TIMEOUT_MS', DEFAULT_AUTH_LOCK_TIMEOUT_MS),
    staleAfterMs: configuredMs('E2E_CREATE_AUTH_LOCK_STALE_MS', DEFAULT_AUTH_LOCK_STALE_MS),
    metadata: { workerIndex, purpose: 'authenticate worker' },
  });
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  _mockCurrencyApi: [
    async ({ page }, use) => {
      await page.route('**/api/currency/currencies', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ currencies: ['EUR', 'GBP', 'JPY', 'USD'], source: 'test' }),
        });
      });
      await page.route('**/api/currency/rates', async route => {
        const body = route.request().postDataJSON() as {
          requests?: { base: string; quote: string; date?: string }[];
        };
        const rates = (body.requests ?? []).map(request => ({
          baseCurrency: request.base,
          quoteCurrency: request.quote,
          requestedDate: request.date ?? null,
          rateDate: request.date ?? '2026-07-17',
          rate: request.base === request.quote ? 1 : 1.1,
          source: 'frankfurter',
          cacheStatus: request.base === request.quote ? 'identity' : 'fresh',
        }));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ rates }),
        });
      });
      await use(undefined);
    },
    { auto: true },
  ],

  _createSmokeTimeout: [
    // Playwright requires fixture callbacks to destructure the first argument, even when no fixtures are used.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, testInfo) => {
      let releaseSmokeLock: (() => Promise<void>) | undefined;

      if (testInfo.title.includes('@smoke')) {
        const smokeLockTimeoutMs = configuredMs(
          'E2E_CREATE_SMOKE_LOCK_TIMEOUT_MS',
          DEFAULT_SMOKE_LOCK_TIMEOUT_MS
        );
        testInfo.setTimeout(
          Math.max(testInfo.timeout, createSmokeTestTimeoutMs(), smokeLockTimeoutMs + 60_000)
        );
        releaseSmokeLock = await acquireSmokeLock(testInfo);
      }

      try {
        await use(undefined);
      } finally {
        await releaseSmokeLock?.();
      }
    },
    { auto: true },
  ],

  workerStorageState: [
    async ({ browser }, use, workerInfo) => {
      const releaseAuthLock = await acquireAuthLock(workerInfo.parallelIndex);
      try {
        const user = await authenticateWorker(browser, workerInfo.parallelIndex);
        await use(user.storageStatePath);
      } finally {
        await releaseAuthLock();
      }
    },
    {
      scope: 'worker',
      timeout:
        configuredMs('E2E_CREATE_AUTH_LOCK_TIMEOUT_MS', DEFAULT_AUTH_LOCK_TIMEOUT_MS) + 120_000,
    },
  ],

  e2eUser: [
    async ({ workerStorageState }, use, workerInfo) => {
      const match = workerStorageState.match(/worker-(\d+)\.json$/);
      const workerIndex = Number(match?.[1] ?? workerInfo.parallelIndex);
      const { workerUser } = await import('./auth');
      await use(workerUser(workerIndex));
    },
    { scope: 'worker' },
  ],

  storageState: async ({ workerStorageState }, use) => {
    await use(workerStorageState);
  },

  // Playwright requires fixture callbacks to destructure the first argument, even when no fixtures are used.
  // eslint-disable-next-line no-empty-pattern
  e2eRun: async ({}, use, testInfo) => {
    const prefix = `E2E-${testInfo.workerIndex}-${Date.now()}-${sanitizeTitle(testInfo.title)}`;
    await use({ prefix });
    await cleanupE2ERows({ prefix });
  },

  seed: async ({ e2eRun, e2eUser }, use) => {
    await ensureE2EAuthUser(e2eUser);
    const seed = await seedCreatePrerequisites(e2eRun.prefix, e2eUser.id);
    await use(seed);
  },

  createFlowPage: async ({ page }, use) => {
    await use(new CreateFlowPage(page));
  },
});

export { expect } from '@playwright/test';
