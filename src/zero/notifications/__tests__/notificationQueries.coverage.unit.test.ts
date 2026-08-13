import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createQueryHarness,
  evaluatePredicate,
  type QueryHarness,
} from '../../__tests__/test-utils/zeroHarness';

beforeEach(() => vi.resetModules());

async function loadQueries() {
  const harness = createQueryHarness();
  vi.doMock('@rocicorp/zero', () => ({
    defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
  }));
  vi.doMock('../../schema', () => ({ zql: harness.zql }));
  const mod = await import('../queries');
  return { harness, notificationQueries: mod.notificationQueries };
}

function executePredicates(harness: QueryHarness) {
  for (const queries of Object.values(harness.byTable)) {
    for (const query of queries) {
      for (const call of query.calls) {
        if (call[0] === 'where' && typeof call[1] === 'function') {
          evaluatePredicate(call[1]);
        }
      }
    }
  }
}

const baseArgs = {
  id: 'notification-1',
  notificationId: 'notification-1',
  tab: 'all',
  query: ' needle ',
  entityId: 'group-1',
  entityType: 'group',
  entity_id: 'group-1',
  groupIds: ['group-1'],
  eventIds: ['event-1'],
  amendmentIds: ['amendment-1'],
  blogIds: ['blog-1'],
  endpoint: 'https://push.example/subscription',
  limit: 25,
  start: { id: 'cursor-1', created_at: 100 },
  dir: 'backward',
};

describe('notification query registry coverage', () => {
  it('materializes every query across tabs, scopes, cursors, and caller identities', async () => {
    const { harness, notificationQueries } = await loadQueries();
    const registry = notificationQueries as unknown as Record<
      string,
      { fn: (input: { args: typeof baseArgs; ctx: { userID?: string; email: string } }) => unknown }
    >;
    const variants = [
      { args: baseArgs, userID: 'user-1' },
      {
        args: {
          ...baseArgs,
          tab: 'unread',
          query: '   ',
          entityId: null,
          entityType: null,
          start: null,
          dir: 'forward',
          groupIds: [],
          eventIds: [],
          amendmentIds: [],
          blogIds: [],
        },
        userID: undefined,
      },
      { args: { ...baseArgs, tab: 'personal', entityType: 'event' }, userID: 'anon' },
      { args: { ...baseArgs, tab: 'read', entityType: 'event' }, userID: 'user-1' },
      { args: { ...baseArgs, tab: 'entity', entityType: 'amendment' }, userID: 'user-1' },
      { args: { ...baseArgs, tab: 'trash', entityType: 'blog' }, userID: 'user-1' },
      { args: { ...baseArgs, tab: 'unknown', entityType: 'todo' }, userID: 'user-1' },
    ];

    for (const query of Object.values(registry)) {
      for (const variant of variants) {
        query.fn({
          args: variant.args as typeof baseArgs,
          ctx: { userID: variant.userID, email: '' },
        });
      }
    }

    executePredicates(harness);
    expect(Object.keys(harness.byTable).length).toBeGreaterThan(15);
  });
});
