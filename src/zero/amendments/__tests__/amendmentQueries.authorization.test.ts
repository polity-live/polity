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

interface PredicateQuery {
  where: (...args: unknown[]) => PredicateQuery;
  whereExists: (relation: string, fn: (q: PredicateQuery) => unknown) => PredicateQuery;
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

import { amendmentQueries } from '../queries';

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

function predicateCalls(predicate: unknown): QueryCall[] {
  const calls: QueryCall[] = [];

  const makeQuery = (table: string): PredicateQuery => {
    const query: PredicateQuery = {
      where: (...args: unknown[]) => {
        calls.push(['where', table, ...args]);
        if (typeof args[0] === 'function') args[0](helpers);
        return query;
      },
      whereExists: (relation: string, fn: (q: PredicateQuery) => unknown) => {
        calls.push(['whereExists', table, relation]);
        fn(makeQuery(`${table}.${relation}`));
        return query;
      },
    };

    return query;
  };

  const helpers = {
    cmp: (...args: unknown[]) => {
      calls.push(['cmp', ...args]);
      return ['cmp', ...args];
    },
    exists: (relation: string, fn: (q: PredicateQuery) => unknown) => {
      calls.push(['exists', relation]);
      fn(makeQuery(relation));
      return ['exists', relation];
    },
    or: (...args: unknown[]) => {
      calls.push(['or', ...args]);
      return ['or', ...args];
    },
  };

  if (typeof predicate === 'function') predicate(helpers);
  return calls;
}

beforeEach(() => {
  queryState.byTable = {};
});

describe('amendment query nested authorization', () => {
  it('filters support votes in full amendment details', () => {
    amendmentQueries.byIdFull.fn({ args: { id: 'amendment-1' }, ctx });

    const amendmentCalls = lastQuery('amendment').calls;
    const supportVoteCalls = relatedCalls(amendmentCalls, 'support_votes');

    expect(supportVoteCalls[0][0]).toBe('where');
    expect(typeof supportVoteCalls[0][1]).toBe('function');
    expect(supportVoteCalls.some(call => call[0] === 'related' && call[1] === 'user')).toBe(true);

    const calls = predicateCalls(supportVoteCalls[0][1]);
    expect(calls).toEqual(
      expect.arrayContaining([
        ['cmp', 'user_id', ctx.userID],
        ['whereExists', 'collaborators', 'role'],
        ['whereExists', 'collaborators.role', 'action_rights'],
        ['where', 'collaborators.role.action_rights', 'resource', 'amendments'],
        ['where', 'collaborators.role.action_rights', 'action', 'manage'],
      ])
    );
  });

  it('filters change request votes by caller or amendment private access', () => {
    amendmentQueries.changeRequestsWithVotes.fn({
      args: { amendment_id: 'amendment-1' },
      ctx,
    });

    const changeRequestCalls = lastQuery('change_request').calls;
    const voteCalls = relatedCalls(changeRequestCalls, 'votes');

    expect(voteCalls[0][0]).toBe('where');
    expect(typeof voteCalls[0][1]).toBe('function');
    expect(voteCalls.some(call => call[0] === 'related' && call[1] === 'user')).toBe(true);
  });

  it('filters amendment discussion thread and comment votes', () => {
    amendmentQueries.threads.fn({ args: { amendment_id: 'amendment-1' }, ctx });

    const threadCalls = lastQuery('thread').calls;
    const threadVoteCalls = relatedCalls(threadCalls, 'votes');
    const commentCalls = relatedCalls(threadCalls, 'comments');
    const commentVoteCalls = relatedCalls(commentCalls, 'votes');

    expect(threadVoteCalls[0][0]).toBe('where');
    expect(typeof threadVoteCalls[0][1]).toBe('function');
    expect(commentVoteCalls[0][0]).toBe('where');
    expect(typeof commentVoteCalls[0][1]).toBe('function');
  });
});
