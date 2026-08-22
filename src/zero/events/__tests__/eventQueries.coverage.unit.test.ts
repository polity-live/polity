import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createQueryHarness,
  evaluatePredicate,
  type QueryHarness,
} from '../../__tests__/test-utils/zeroHarness';

beforeEach(() => {
  vi.resetModules();
});

async function loadQueries() {
  const harness = createQueryHarness();
  vi.doMock('@rocicorp/zero', () => ({
    defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
  }));
  vi.doMock('../../schema', () => ({ zql: harness.zql }));
  const mod = await import('../queries');
  return { harness, eventQueries: mod.eventQueries };
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

const enabledArgs = {
  id: 'row-1',
  eventId: 'event-1',
  agendaItemId: 'agenda-1',
  electionId: 'election-1',
  amendmentId: 'amendment-1',
  groupId: 'group-1',
  creatorId: 'creator-1',
  userId: 'user-1',
  user_id: 'user-1',
  status: 'active',
  statuses: ['active', 'confirmed'],
  roleId: 'role-1',
  roleIds: ['role-1', 'role-2'],
  query: ' needle ',
  order: 'ascending',
  limit: 25,
  start: { id: 'cursor-1', created_at: 100, start_date: 100 },
  dir: 'backward',
  from: 10,
  to: 200,
  eventIds: ['event-1', 'event-2'],
};

const disabledArgs = {
  ...enabledArgs,
  groupId: undefined,
  creatorId: undefined,
  status: undefined,
  statuses: [],
  roleId: undefined,
  roleIds: [],
  query: '   ',
  order: 'descending',
  start: null,
  dir: 'forward',
  from: null,
  to: null,
  eventIds: [],
};

describe('event query registry coverage', () => {
  it('materializes every query with enabled and disabled optional filters', async () => {
    const { harness, eventQueries } = await loadQueries();
    const registry = eventQueries as unknown as Record<
      string,
      {
        fn: (input: {
          args: typeof enabledArgs;
          ctx: { userID?: string; email: string };
        }) => unknown;
      }
    >;

    for (const query of Object.values(registry)) {
      query.fn({
        args: enabledArgs,
        ctx: { userID: 'user-1', email: 'user@example.com' },
      });
      query.fn({
        args: disabledArgs as unknown as typeof enabledArgs,
        ctx: { userID: undefined, email: '' },
      });
      query.fn({
        args: enabledArgs,
        ctx: { userID: 'anon', email: '' },
      });
      query.fn({
        args: {
          ...disabledArgs,
          statuses: undefined,
          roleIds: undefined,
          order: 'ascending',
          dir: 'forward',
        } as unknown as typeof enabledArgs,
        ctx: { userID: 'user-1', email: '' },
      });
      query.fn({
        args: {
          ...disabledArgs,
          order: 'descending',
          dir: 'backward',
        } as unknown as typeof enabledArgs,
        ctx: { userID: 'user-1', email: '' },
      });
    }

    executePredicates(harness);
    expect(Object.keys(harness.byTable).length).toBeGreaterThan(20);
  });

  it('keeps the unfiltered activity feed when severity is all', async () => {
    const { eventQueries } = await loadQueries();

    expect(() =>
      (eventQueries.activities as any).fn({
        args: { entityId: 'event-1', severity: 'all', cursor: null, limit: 20 },
        ctx: { userID: 'user-1', email: 'user@example.com' },
      })
    ).not.toThrow();
  });
});
