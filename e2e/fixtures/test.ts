import { test as base } from '@playwright/test';

import { cleanupE2ERows } from './cleanup';
import { actorUser, authenticateActor, removeActorAuthState, type E2EActorUser } from './auth';
import { seedCreatePrerequisites, type SeedData } from './seed';
import { CreateFlowPage } from './create-flow-page';
import { TutorialFlowPage } from './tutorial-flow-page';
import { e2eRunId, e2eTestNamespace } from './run';

interface TestFixtures {
  _mockCurrencyApi: undefined;
  createFlowPage: CreateFlowPage;
  e2eRun: E2ERunFixture;
  e2eUser: E2EActorUser;
  seed: SeedData;
  tutorialFlowPage: TutorialFlowPage;
}

export interface E2ERunFixture {
  actor: (name?: string) => E2EActorUser;
  actorId: string;
  prefix: string;
  registerActorId: (id: string) => void;
  registerEntityId: (id: string) => void;
  runId: string;
  testId: string;
}

export const test = base.extend<TestFixtures>({
  _mockCurrencyApi: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        window.sessionStorage.setItem('polity.alphaWarning.0.11.1.acknowledged', 'true');
      });
      await page.route('**/api/currency/currencies', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            currencies: ['EUR', 'GBP', 'JPY', 'USD'],
            source: 'test',
          }),
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

  // Playwright requires fixture callbacks to destructure the first argument, even when no fixtures are used.
  // oxlint-disable-next-line no-empty-pattern
  e2eRun: async ({}, use, testInfo) => {
    const prefix = e2eTestNamespace(testInfo);
    const actorIds = new Set<string>();
    const entityIds = new Set<string>();
    const actors = new Map<string, E2EActorUser>();
    const actor = (name = 'primary') => {
      const existing = actors.get(name);
      if (existing) return existing;
      const created = actorUser(prefix, name);
      actors.set(name, created);
      actorIds.add(created.id);
      return created;
    };
    const primary = actor();
    const fixture: E2ERunFixture = {
      actor,
      actorId: primary.id,
      prefix,
      registerActorId: id => actorIds.add(id),
      registerEntityId: id => entityIds.add(id),
      runId: e2eRunId(),
      testId: testInfo.testId,
    };
    try {
      await use(fixture);
    } finally {
      await cleanupE2ERows({ actorIds: [...actorIds], entityIds: [...entityIds] });
    }
  },

  e2eUser: async ({ browser, e2eRun }, use) => {
    const user = e2eRun.actor();
    try {
      await authenticateActor(browser, user);
      await use(user);
    } finally {
      await removeActorAuthState(user);
    }
  },

  storageState: async ({ e2eUser }, use) => {
    await use(e2eUser.storageStatePath);
  },

  seed: async ({ e2eRun, e2eUser }, use) => {
    const seed = await seedCreatePrerequisites(e2eRun.prefix, e2eUser.id);
    e2eRun.registerActorId(seed.extraUserId);
    for (const [key, value] of Object.entries(seed)) {
      if (key.endsWith('Id') && key !== 'userId' && key !== 'extraUserId') {
        e2eRun.registerEntityId(value);
      }
    }
    await use(seed);
  },

  createFlowPage: async ({ e2eRun, page }, use) => {
    await use(new CreateFlowPage(page, target => target.id && e2eRun.registerEntityId(target.id)));
  },

  tutorialFlowPage: async ({ page }, use) => {
    await use(new TutorialFlowPage(page));
  },
});

export { expect } from '@playwright/test';
