import { test as base } from '@playwright/test';

import { cleanupE2ERows } from './cleanup';
import { authenticateWorker, type E2EWorkerUser } from './auth';
import { seedCreatePrerequisites, type SeedData } from './seed';
import { CreateFlowPage, createSmokeTestTimeoutMs } from './create-flow-page';

interface TestFixtures {
  _createSmokeTimeout: undefined;
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

export const test = base.extend<TestFixtures, WorkerFixtures>({
  _createSmokeTimeout: [
    async (_args, use, testInfo) => {
      if (testInfo.title.includes('@smoke')) {
        testInfo.setTimeout(Math.max(testInfo.timeout, createSmokeTestTimeoutMs()));
      }
      await use(undefined);
    },
    { auto: true },
  ],

  workerStorageState: [
    async ({ browser }, use, workerInfo) => {
      const user = await authenticateWorker(browser, workerInfo.parallelIndex);
      await use(user.storageStatePath);
    },
    { scope: 'worker', timeout: 90_000 },
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

  e2eRun: async (_args, use, testInfo) => {
    const prefix = `E2E-${testInfo.workerIndex}-${Date.now()}-${sanitizeTitle(testInfo.title)}`;
    await use({ prefix });
    await cleanupE2ERows({ prefix });
  },

  seed: async ({ e2eRun, e2eUser }, use) => {
    const seed = await seedCreatePrerequisites(e2eRun.prefix, e2eUser.id);
    await use(seed);
  },

  createFlowPage: async ({ page }, use) => {
    await use(new CreateFlowPage(page));
  },
});

export { expect } from '@playwright/test';
