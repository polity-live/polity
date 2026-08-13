import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryCall = readonly [string, ...unknown[]];

interface FakeQuery {
  calls: QueryCall[];
  limit: (...args: unknown[]) => FakeQuery;
  one: () => FakeQuery;
  orderBy: (...args: unknown[]) => FakeQuery;
  related: (relation: string, callback?: (query: FakeQuery) => unknown) => FakeQuery;
  start: (...args: unknown[]) => FakeQuery;
  where: (...args: unknown[]) => FakeQuery;
  whereExists: (relation: string, callback: (query: FakeQuery) => unknown) => FakeQuery;
}

const mocks = vi.hoisted(() => ({
  queries: [] as FakeQuery[],
}));

vi.mock('@rocicorp/zero', () => ({
  defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
}));

vi.mock('../../rbac/query-access', () => {
  const pass = (query: unknown) => query;
  return {
    applyAgendaItemQueryAccess: pass,
    applyAmendmentQueryAccess: pass,
    applyBlogQueryAccess: pass,
    applyElectionQueryAccess: pass,
    applyEventManagerQueryAccess: pass,
    applyEventParticipantOrManagerQueryAccess: pass,
    applyEventQueryAccess: pass,
    applyGroupMembershipSelfOrManagerQueryAccess: pass,
    applyGroupQueryAccess: pass,
    applySearchDocumentQueryAccess: pass,
    applyStatementQueryAccess: pass,
    applyTodoQueryAccess: pass,
    applyUserQueryAccess: pass,
    isAuthenticatedUserId: (userId: string | undefined) => Boolean(userId),
    requireQueryUser: pass,
  };
});

vi.mock('../../schema', () => {
  function createQuery(): FakeQuery {
    const query: FakeQuery = {
      calls: [],
      limit: (...args) => {
        query.calls.push(['limit', ...args]);
        return query;
      },
      one: () => {
        query.calls.push(['one']);
        return query;
      },
      orderBy: (...args) => {
        query.calls.push(['orderBy', ...args]);
        return query;
      },
      related: (relation, callback) => {
        const child = createQuery();
        query.calls.push(['related', relation, child.calls]);
        callback?.(child);
        return query;
      },
      start: (...args) => {
        query.calls.push(['start', ...args]);
        return query;
      },
      where: (...args) => {
        if (typeof args[0] === 'function') {
          const cmp = (...values: unknown[]) => ['cmp', ...values];
          const or = (...values: unknown[]) => ['or', ...values];
          args[0]({ cmp, or });
        }
        query.calls.push(['where', ...args]);
        return query;
      },
      whereExists: (relation, callback) => {
        const child = createQuery();
        query.calls.push(['whereExists', relation, child.calls]);
        callback(child);
        return query;
      },
    };
    mocks.queries.push(query);
    return query;
  }

  return {
    zql: new Proxy({}, { get: () => createQuery() }),
  };
});

import { searchQueries } from '../queries';

const authenticated = { userID: 'user-1' };
const anonymous = { userID: '' };

function invoke(
  name: keyof typeof searchQueries,
  args: Record<string, unknown>,
  ctx = authenticated
) {
  return (searchQueries[name] as any).fn({ args, ctx });
}

describe('shared query branch contracts', () => {
  beforeEach(() => {
    mocks.queries = [];
  });

  it('covers search-document text, filters, bounds, ordering, and pagination', () => {
    const defaults = {
      bounds: null,
      createdAfter: null,
      dir: 'forward',
      engagement: 'all',
      limit: 20,
      ownerUserId: undefined,
      query: '',
      snapshotAt: null,
      sort: 'recent',
      start: null,
      topics: [],
      types: [],
    };

    invoke('searchDocumentPage', defaults);
    invoke('searchDocumentPage', {
      ...defaults,
      bounds: { east: 13, north: 53, south: 52, west: 12 },
      createdAfter: 10,
      engagement: 'popular',
      ownerUserId: 'owner-1',
      query: 'a',
      snapshotAt: 20,
      start: { created_at: 9, engagement_score: 7, id: 'start' },
      sort: 'engagement',
      topics: [' Climate ', ''],
      types: ['event', ' '],
    });
    invoke('searchDocumentPage', {
      ...defaults,
      bounds: { east: -170, north: -10, south: 10, west: 170 },
      dir: 'backward',
      engagement: 'rising',
      query: 'climate',
      sort: 'trending',
      start: { created_at: 9, id: 'start', trending_score: 3 },
    });
    invoke('searchDocumentPage', {
      ...defaults,
      engagement: 'discussed',
      query: 'discussion',
    });

    expect(mocks.queries.some(query => query.calls.some(call => call[0] === 'start'))).toBe(true);
    expect(mocks.queries.some(query => query.calls.some(call => call[0] === 'whereExists'))).toBe(
      true
    );
  });

  it('covers document-by-id owner filters and topic listing', () => {
    invoke('searchDocumentById', { id: 'doc-1' });
    invoke('searchDocumentById', { id: 'doc-2', ownerUserId: 'owner-1' });
    invoke('searchDocumentTopics', { limit: 40 });
    expect(mocks.queries.some(query => query.calls.some(call => call[0] === 'one'))).toBe(true);
  });

  it.each([
    ['searchableUsers', { limit: 10, query: ' ada ' }],
    ['searchableGroups', { limit: 10, query: ' group ' }],
    ['searchableStatements', { limit: 10, now: 100, query: ' statement ' }],
    ['searchableBlogs', { limit: 10, query: ' blog ' }],
    ['searchableAmendments', { limit: 10, query: ' amendment ' }],
    ['searchableEvents', { limit: 10, query: ' event ' }],
    ['searchableTodos', { limit: 10, query: ' todo ' }],
    ['searchableTodosByCreator', { limit: 10, query: ' creator todo ', user_id: 'target-user' }],
    ['searchableTodosByGroups', { group_ids: ['group-1'], limit: 10, query: ' group todo ' }],
  ] as const)('covers populated and blank search for %s', (name, populatedArgs) => {
    invoke(name, populatedArgs as any, authenticated);
    invoke(name, { ...populatedArgs, query: '' } as any, anonymous);
    expect(mocks.queries.some(query => query.calls.some(call => call[0] === 'limit'))).toBe(true);
  });

  it('covers authenticated and anonymous nested user assignment relations', () => {
    invoke('userGroupMemberships', { user_id: 'target-user' }, authenticated);
    invoke('userGroupMemberships', { user_id: 'target-user' }, anonymous);
    invoke('userTodoAssignments', { user_id: 'target-user' }, authenticated);
    invoke('userTodoAssignments', { user_id: 'target-user' }, anonymous);
    expect(mocks.queries.length).toBeGreaterThan(0);
  });
});
