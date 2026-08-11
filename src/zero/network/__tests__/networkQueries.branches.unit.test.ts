import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryDefinition {
  fn: (input: { args: Record<string, any>; ctx: { userID?: string | null } }) => unknown;
}

const applyGroupQueryAccess = vi.hoisted(() => vi.fn((query: unknown) => query));

function createAutoQueryHarness() {
  const touchedTables: string[] = [];

  function makeQuery(table: string): any {
    const query: Record<string, (...args: any[]) => any> = {};
    const helpers = {
      cmp: (...args: unknown[]) => ({ kind: 'cmp', args }),
      and: (...args: unknown[]) => ({ kind: 'and', args }),
      or: (...args: unknown[]) => ({ kind: 'or', args }),
      exists: (relation: string, callback: (child: any) => unknown) => {
        callback(makeQuery(`${table}.${relation}`));
        return { kind: 'exists', relation };
      },
    };

    query.where = (...args: any[]) => {
      if (typeof args[0] === 'function') args[0](helpers);
      return query;
    };
    query.whereExists = (relation: string, callback: (child: any) => unknown) => {
      callback(makeQuery(`${table}.${relation}`));
      return query;
    };
    query.related = (relation: string, callback?: (child: any) => unknown) => {
      callback?.(makeQuery(`${table}.${relation}`));
      return query;
    };
    for (const method of ['orderBy', 'limit', 'start', 'one']) {
      query[method] = () => query;
    }
    return query;
  }

  return {
    touchedTables,
    zql: new Proxy(
      {},
      {
        get: (_target, property) => {
          touchedTables.push(String(property));
          return makeQuery(String(property));
        },
      }
    ),
  };
}

beforeEach(() => {
  vi.resetModules();
  applyGroupQueryAccess.mockClear();
});

async function loadQueries() {
  const harness = createAutoQueryHarness();
  vi.doMock('@rocicorp/zero', () => ({
    defineQuery: (validator: unknown, fn: QueryDefinition['fn']) => ({ validator, fn }),
  }));
  vi.doMock('../../schema', () => ({ zql: harness.zql }));
  vi.doMock('../../rbac/query-access', () => ({ applyGroupQueryAccess }));
  const { networkQueries } = await import('../queries');
  return {
    harness,
    networkQueries: networkQueries as unknown as Record<string, QueryDefinition>,
  };
}

const broadArgs = {
  id: 'connection-1',
  groupId: 'group-a',
  groupAId: 'group-a',
  groupBId: 'group-b',
  status: 'active',
  relationshipType: 'sibling',
  rights: ['informationRight'],
  query: '  council  ',
  limit: 20,
  start: { id: 'cursor-1', updated_at: 100 },
  dir: 'backward',
  direction: 'outgoing',
};

describe('networkQueries branch coverage', () => {
  it('builds every network query and all nested relation and access callbacks', async () => {
    const { harness, networkQueries } = await loadQueries();

    for (const query of Object.values(networkQueries)) {
      query.fn({ args: broadArgs, ctx: { userID: 'user-1' } });
    }

    expect(Object.keys(networkQueries)).toHaveLength(18);
    expect(harness.touchedTables).toEqual(
      expect.arrayContaining([
        'group_connection',
        'group_connection_request',
        'group_hierarchy_path',
        'group_effective_right',
        'group_workflow',
        'group_workflow_approval',
      ])
    );
    expect(applyGroupQueryAccess).toHaveBeenCalled();
  });

  it('covers every connection-page filter and paging direction', async () => {
    const { networkQueries } = await loadQueries();
    const page = networkQueries.groupConnectionPage;
    const base = {
      groupId: 'group-a',
      rights: [],
      query: '   ',
      limit: 10,
      start: null,
      dir: 'forward',
    };

    for (const relationshipType of ['all', 'parent', 'child'] as const) {
      page.fn({
        args: { ...base, relationshipType },
        ctx: { userID: relationshipType === 'all' ? undefined : null },
      });
    }
    page.fn({
      args: {
        ...base,
        status: 'inactive',
        relationshipType: 'sibling',
        rights: ['activeVotingRight'],
        query: 'Council',
        start: { id: 'cursor-2', updated_at: 200 },
        dir: 'backward',
      },
      ctx: { userID: 'user-1' },
    });
    page.fn({
      args: { ...base, rights: undefined },
      ctx: { userID: 'user-1' },
    });
  });

  it('covers incoming and outgoing request search pages with and without cursors', async () => {
    const { networkQueries } = await loadQueries();
    const page = networkQueries.groupConnectionRequestPage;

    page.fn({
      args: {
        groupId: 'group-a',
        direction: 'incoming',
        query: '',
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx: { userID: undefined },
    });
    page.fn({
      args: {
        groupId: 'group-a',
        direction: 'outgoing',
        query: ' council ',
        limit: 10,
        start: { id: 'request-cursor', updated_at: 50 },
        dir: 'backward',
      },
      ctx: { userID: 'user-1' },
    });
  });
});
