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

import { groupQueries } from '../queries';

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

beforeEach(() => {
  queryState.byTable = {};
});

describe('group wiki roster query', () => {
  it('loads all active wiki memberships without self-or-manager filtering', () => {
    groupQueries.wikiData.fn({ args: { id: 'group-1' }, ctx });

    const groupCalls = lastQuery('group').calls;
    const membershipCalls = relatedCalls(groupCalls, 'memberships');

    expect(membershipCalls).toContainEqual([
      'where',
      'status',
      'IN',
      ['active', 'member', 'admin'],
    ]);
    expect(membershipCalls.some(call => call[0] === 'where' && typeof call[1] === 'function')).toBe(
      false
    );
    expect(membershipCalls.some(call => call[0] === 'related' && call[1] === 'user')).toBe(true);
  });
});
