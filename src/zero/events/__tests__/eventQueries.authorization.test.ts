import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryCall = readonly [string, ...unknown[]];

interface FakeQuery {
  readonly table: string;
  readonly calls: QueryCall[];
  where: (...args: unknown[]) => FakeQuery;
  whereExists: (relation: string, fn: (q: FakeQuery) => unknown) => FakeQuery;
  related: (relation: string, fn?: (q: FakeQuery) => unknown) => FakeQuery;
  orderBy: (...args: unknown[]) => FakeQuery;
  one: () => FakeQuery;
}

const queryState = vi.hoisted(() => ({
  byTable: {} as Record<string, FakeQuery[]>,
}));

vi.mock('@rocicorp/zero', () => ({
  defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
}));

vi.mock('../../schema', () => {
  function createQuery(table: string): FakeQuery {
    const query: FakeQuery = {
      table,
      calls: [],
      where: (...args: unknown[]) => {
        query.calls.push(['where', ...args]);
        return query;
      },
      whereExists: (relation: string, fn: (q: FakeQuery) => unknown) => {
        const child = createQuery(`${table}.${relation}`);
        query.calls.push(['whereExists', relation, child.calls]);
        fn(child);
        return query;
      },
      related: (relation: string, fn?: (q: FakeQuery) => unknown) => {
        const child = createQuery(`${table}.${relation}`);
        query.calls.push(['related', relation, child.calls]);
        if (fn) fn(child);
        return query;
      },
      orderBy: (...args: unknown[]) => {
        query.calls.push(['orderBy', ...args]);
        return query;
      },
      one: () => {
        query.calls.push(['one']);
        return query;
      },
    };

    queryState.byTable[table] = [...(queryState.byTable[table] ?? []), query];
    return query;
  }

  return {
    zql: new Proxy(
      {},
      {
        get: (_target, prop) => createQuery(String(prop)),
      }
    ),
  };
});

import { eventQueries } from '../queries';

const ctx = { userID: 'user-1', email: 'user@example.com' };

function lastQuery(table: string): FakeQuery {
  const query = queryState.byTable[table]?.at(-1);
  if (!query) throw new Error(`No query captured for ${table}`);
  return query;
}

function relatedCalls(calls: QueryCall[], relation: string): QueryCall[] {
  const call = calls.find(call => call[0] === 'related' && call[1] === relation);
  if (!call) throw new Error(`No related(${relation}) call captured`);
  return call[2] as QueryCall[];
}

function expectDelegateAccessFilter(calls: QueryCall[]) {
  expect(calls[0][0]).toBe('where');
  expect(typeof calls[0][1]).toBe('function');
}

beforeEach(() => {
  queryState.byTable = {};
});

describe('event query delegate authorization', () => {
  it('filters direct delegate lists to self or event participants', () => {
    eventQueries.delegates.fn({ args: { eventId: 'event-1' }, ctx });

    expectDelegateAccessFilter(lastQuery('event_delegate').calls);
  });

  it('filters nested wiki delegates to self or event participants', () => {
    eventQueries.wikiData.fn({ args: { id: 'event-1' }, ctx });

    const eventCalls = lastQuery('event').calls;
    const delegateCalls = relatedCalls(eventCalls, 'delegates');

    expectDelegateAccessFilter(delegateCalls);
  });

  it('filters delegates nested under delegate allocation target events', () => {
    eventQueries.delegateAllocationsBySourceGroup.fn({
      args: { groupId: 'group-1' },
      ctx,
    });

    const allocationCalls = lastQuery('group_delegate_allocation').calls;
    const eventCalls = relatedCalls(allocationCalls, 'event');
    const delegateCalls = relatedCalls(eventCalls, 'delegates');

    expectDelegateAccessFilter(delegateCalls);
  });
});
