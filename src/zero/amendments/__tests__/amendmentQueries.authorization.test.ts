import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryCall = readonly [string, ...unknown[]];

interface FakeQuery {
  readonly table: string;
  readonly calls: QueryCall[];
  where: (...args: unknown[]) => FakeQuery;
  whereExists: (relation: string, fn: (q: FakeQuery) => unknown) => FakeQuery;
  related: (relation: string, fn?: (q: FakeQuery) => unknown) => FakeQuery;
  orderBy: (...args: unknown[]) => FakeQuery;
  start: (...args: unknown[]) => FakeQuery;
  limit: (...args: unknown[]) => FakeQuery;
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
      start: (...args: unknown[]) => {
        query.calls.push(['start', ...args]);
        return query;
      },
      limit: (...args: unknown[]) => {
        query.calls.push(['limit', ...args]);
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
const anonymousCtx = { userID: undefined, email: undefined } as never;

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
  it('loads all active wiki collaborators without pending statuses', () => {
    amendmentQueries.byIdFull.fn({ args: { id: 'amendment-1' }, ctx });

    const amendmentCalls = lastQuery('amendment').calls;
    const collaboratorCalls = relatedCalls(amendmentCalls, 'collaborators');

    expect(collaboratorCalls).toContainEqual([
      'where',
      'status',
      'IN',
      ['active', 'collaborator', 'member', 'admin'],
    ]);
    expect(
      collaboratorCalls.some(call => call[0] === 'where' && typeof call[1] === 'function')
    ).toBe(false);
    expect(collaboratorCalls.some(call => call[0] === 'related' && call[1] === 'user')).toBe(true);
  });

  it('limits relation collaborator rosters to the caller or active amendment managers', () => {
    amendmentQueries.byIdWithRelations.fn({ args: { id: 'amendment-1' }, ctx });

    const amendmentCalls = lastQuery('amendment').calls;
    const collaboratorCalls = relatedCalls(amendmentCalls, 'collaborators');
    const rosterAccessCall = collaboratorCalls.find(
      call => call[0] === 'where' && typeof call[1] === 'function'
    );

    expect(rosterAccessCall).toBeDefined();

    const calls = predicateCalls(rosterAccessCall?.[1]);
    expect(calls).toEqual(
      expect.arrayContaining([
        ['cmp', 'user_id', ctx.userID],
        ['exists', 'amendment'],
        ['where', 'collaborators', 'user_id', ctx.userID],
        ['where', 'collaborators', 'status', 'IN', ['active', 'collaborator', 'member', 'admin']],
        ['whereExists', 'collaborators', 'role'],
        ['whereExists', 'collaborators.role', 'action_rights'],
        ['where', 'collaborators.role.action_rights', 'resource', 'amendments'],
        ['where', 'collaborators.role.action_rights', 'action', 'manage'],
      ])
    );
  });

  it('limits direct collaborator queries to the caller or active amendment managers', () => {
    amendmentQueries.collaborators.fn({ args: { amendment_id: 'amendment-1' }, ctx });

    const collaboratorCalls = lastQuery('amendment_collaborator').calls;
    const rosterAccessCall = collaboratorCalls.find(
      call => call[0] === 'where' && typeof call[1] === 'function'
    );

    expect(rosterAccessCall).toBeDefined();

    const calls = predicateCalls(rosterAccessCall?.[1]);
    expect(calls).toEqual(
      expect.arrayContaining([
        ['cmp', 'user_id', ctx.userID],
        ['exists', 'amendment'],
        ['where', 'collaborators', 'user_id', ctx.userID],
        ['where', 'collaborators', 'status', 'IN', ['active', 'collaborator', 'member', 'admin']],
      ])
    );
    expect(collaboratorCalls.some(call => call[0] === 'related' && call[1] === 'user')).toBe(true);
  });

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

  it('uses null-aware equality for root comments and replies', () => {
    amendmentQueries.discussionCommentPage.fn({
      args: { threadId: 'thread-1', parentId: null, limit: 50, start: null, dir: 'forward' },
      ctx,
    });

    expect(lastQuery('comment').calls).toContainEqual(['where', 'parent_id', 'IS', null]);

    amendmentQueries.discussionCommentPage.fn({
      args: {
        threadId: 'thread-1',
        parentId: 'comment-1',
        limit: 50,
        start: null,
        dir: 'forward',
      },
      ctx,
    });

    expect(lastQuery('comment').calls).toContainEqual(['where', 'parent_id', 'IS', 'comment-1']);
  });

  it('fail-closes every private amendment relation for an anonymous caller', () => {
    amendmentQueries.byIdWithRelations.fn({ args: { id: 'amendment-1' }, ctx: anonymousCtx });
    expect(relatedCalls(lastQuery('amendment').calls, 'collaborators')).toContainEqual([
      'where',
      'id',
      '__unauthorized__',
    ]);

    amendmentQueries.byIdFull.fn({ args: { id: 'amendment-1' }, ctx: anonymousCtx });
    const supportVoteCalls = relatedCalls(lastQuery('amendment').calls, 'support_votes');
    expect(supportVoteCalls).toContainEqual(['where', 'id', '__unauthorized__']);
    const wikiChangeRequests = relatedCalls(lastQuery('amendment').calls, 'change_requests');
    expect(relatedCalls(wikiChangeRequests, 'votes')).toContainEqual([
      'where',
      'user_id',
      '__anon__',
    ]);

    amendmentQueries.byIdWithDocsAndCollabs.fn({
      args: { id: 'amendment-1' },
      ctx: anonymousCtx,
    });
    const editorCalls = lastQuery('amendment').calls;
    const editorGroupCalls = relatedCalls(editorCalls, 'group');
    expect(relatedCalls(editorGroupCalls, 'memberships')).toContainEqual([
      'where',
      'user_id',
      '__anon__',
    ]);
    expect(relatedCalls(editorGroupCalls, 'guest_accesses')).toContainEqual([
      'where',
      'user_id',
      '__anon__',
    ]);

    amendmentQueries.changeRequestsWithVotes.fn({
      args: { amendment_id: 'amendment-1' },
      ctx: anonymousCtx,
    });
    expect(relatedCalls(lastQuery('change_request').calls, 'votes')).toContainEqual([
      'where',
      'id',
      '__unauthorized__',
    ]);

    amendmentQueries.threads.fn({ args: { amendment_id: 'amendment-1' }, ctx: anonymousCtx });
    const threadCalls = lastQuery('thread').calls;
    expect(relatedCalls(threadCalls, 'votes')).toContainEqual(['where', 'id', '__unauthorized__']);
    expect(relatedCalls(relatedCalls(threadCalls, 'comments'), 'votes')).toContainEqual([
      'where',
      'id',
      '__unauthorized__',
    ]);

    amendmentQueries.collaborators.fn({
      args: { amendment_id: 'amendment-1' },
      ctx: anonymousCtx,
    });
    expect(lastQuery('amendment_collaborator').calls).toContainEqual([
      'where',
      'id',
      '__unauthorized__',
    ]);
  });

  it('applies every group amendment filter and both paging directions', () => {
    amendmentQueries.groupAmendmentPage.fn({
      args: {
        groupId: 'group-1',
        status: 'active',
        displayStatus: 'accepted',
        statuses: [],
        hashtag: 'mobility',
        query: ' streets ',
        limit: 25,
        start: { id: 'start', created_at: 1 },
        dir: 'backward',
      },
      ctx,
    });
    const filtered = lastQuery('amendment').calls;
    expect(filtered).toContainEqual(['orderBy', 'created_at', 'asc']);
    expect(filtered).toContainEqual([
      'start',
      { id: 'start', created_at: 1 },
      { inclusive: false },
    ]);
    expect(
      filtered.some(call => call[0] === 'whereExists' && call[1] === 'amendment_hashtags')
    ).toBe(true);

    amendmentQueries.groupAmendmentPage.fn({
      args: {
        groupId: 'group-1',
        statuses: [],
        query: ' ',
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx,
    });
    expect(lastQuery('amendment').calls).toContainEqual(['orderBy', 'created_at', 'desc']);
  });

  it('covers collaborator, collaboration, and change-request page filters', () => {
    amendmentQueries.collaboratorPage.fn({
      args: {
        amendmentId: 'amendment-1',
        status: 'member',
        statuses: ['admin'],
        roleId: 'role-1',
        roleIds: ['role-2'],
        query: ' Alice ',
        limit: 25,
        start: { id: 'start', created_at: 1 },
        dir: 'backward',
      },
      ctx,
    });
    let calls = lastQuery('amendment_collaborator').calls;
    expect(calls).toEqual(
      expect.arrayContaining([
        ['where', 'status', 'member'],
        ['where', 'status', 'IN', ['admin']],
        ['where', 'role_id', 'role-1'],
        ['where', 'role_id', 'IN', ['role-2']],
        ['start', { id: 'start', created_at: 1 }, { inclusive: false }],
      ])
    );

    amendmentQueries.collaboratorPage.fn({
      args: {
        amendmentId: 'amendment-1',
        status: undefined,
        statuses: [],
        roleId: undefined,
        roleIds: [],
        query: ' ',
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx,
    });

    amendmentQueries.collaborationPageByUser.fn({
      args: {
        userId: 'user-1',
        status: 'member',
        statuses: ['admin'],
        query: ' Streets ',
        limit: 25,
        start: { id: 'start', created_at: 1 },
        dir: 'backward',
      },
      ctx: anonymousCtx,
    });
    calls = lastQuery('amendment_collaborator').calls;
    expect(calls).toEqual(
      expect.arrayContaining([
        ['where', 'status', 'member'],
        ['where', 'status', 'IN', ['admin']],
        ['orderBy', 'created_at', 'asc'],
        ['start', { id: 'start', created_at: 1 }, { inclusive: false }],
      ])
    );
    const collaborationPredicate = calls.find(
      call => call[0] === 'where' && typeof call[1] === 'function'
    );
    expect(predicateCalls(collaborationPredicate?.[1])).toEqual(
      expect.arrayContaining([
        ['cmp', 'user_id', '__anon__'],
        ['exists', 'amendment'],
      ])
    );

    amendmentQueries.collaborationPageByUser.fn({
      args: {
        userId: 'user-1',
        status: undefined,
        statuses: [],
        query: ' ',
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx,
    });

    amendmentQueries.changeRequestPage.fn({
      args: {
        amendmentId: 'amendment-1',
        branchId: 'branch-1',
        status: 'open',
        limit: 25,
        start: { id: 'start', created_at: 1 },
        dir: 'backward',
      },
      ctx,
    });
    calls = lastQuery('change_request').calls;
    expect(calls).toEqual(
      expect.arrayContaining([
        ['where', 'process_branch_id', 'branch-1'],
        ['where', 'status', 'open'],
        ['orderBy', 'created_at', 'asc'],
        ['start', { id: 'start', created_at: 1 }, { inclusive: false }],
      ])
    );
    amendmentQueries.changeRequestPage.fn({
      args: {
        amendmentId: 'amendment-1',
        branchId: undefined,
        status: undefined,
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx,
    });
  });

  it('covers discussion sorting, cursors, and user visibility boundaries', () => {
    amendmentQueries.discussionThreadPage.fn({
      args: {
        amendmentId: 'amendment-1',
        sort: 'time',
        limit: 25,
        start: { id: 'start', created_at: 1, upvotes: 2, downvotes: 1 },
        dir: 'backward',
      },
      ctx,
    });
    expect(lastQuery('thread').calls).toEqual(
      expect.arrayContaining([
        ['orderBy', 'created_at', 'asc'],
        ['start', { id: 'start', created_at: 1, upvotes: 2, downvotes: 1 }, { inclusive: false }],
      ])
    );

    amendmentQueries.discussionThreadPage.fn({
      args: {
        amendmentId: 'amendment-1',
        sort: 'votes',
        limit: 25,
        start: null,
        dir: 'backward',
      },
      ctx,
    });
    expect(lastQuery('thread').calls).toContainEqual(['orderBy', 'downvotes', 'desc']);

    amendmentQueries.discussionThreadPage.fn({
      args: { amendmentId: 'amendment-1', sort: 'votes', limit: 25, start: null, dir: 'forward' },
      ctx,
    });
    expect(lastQuery('thread').calls).toEqual(
      expect.arrayContaining([
        ['orderBy', 'upvotes', 'desc'],
        ['orderBy', 'downvotes', 'asc'],
      ])
    );

    amendmentQueries.discussionCommentPage.fn({
      args: {
        threadId: 'thread-1',
        parentId: null,
        limit: 25,
        start: { id: 'start', created_at: 1 },
        dir: 'backward',
      },
      ctx,
    });
    expect(lastQuery('comment').calls).toEqual(
      expect.arrayContaining([
        ['orderBy', 'created_at', 'desc'],
        ['start', { id: 'start', created_at: 1 }, { inclusive: false }],
      ])
    );

    amendmentQueries.allUsers.fn({ args: {}, ctx: anonymousCtx });
    expect(lastQuery('user').calls).toContainEqual(['where', 'visibility', 'public']);
    amendmentQueries.allUsers.fn({ args: {}, ctx });
    expect(lastQuery('user').calls.some(call => typeof call[1] === 'function')).toBe(true);

    amendmentQueries.usersByIds.fn({ args: { ids: [] }, ctx: anonymousCtx });
    expect(lastQuery('user').calls).toContainEqual(['where', 'id', '__none__']);
    amendmentQueries.usersByIds.fn({ args: { ids: ['user-1'] }, ctx });
    expect(lastQuery('user').calls).toContainEqual(['where', 'id', 'IN', ['user-1']]);

    amendmentQueries.userById.fn({ args: { id: 'user-1' }, ctx: anonymousCtx });
    expect(lastQuery('user').calls).toContainEqual(['where', 'visibility', 'public']);
    amendmentQueries.userById.fn({ args: { id: 'user-1' }, ctx });
    expect(lastQuery('user').calls.some(call => typeof call[1] === 'function')).toBe(true);

    amendmentQueries.currentUserOpenNavigationAmendments.fn({ args: {}, ctx: anonymousCtx });
    expect(lastQuery('amendment').calls).toContainEqual(['where', 'id', '__unauthorized__']);
    amendmentQueries.currentUserOpenNavigationAmendments.fn({ args: {}, ctx });
    expect(lastQuery('amendment').calls.some(call => typeof call[1] === 'function')).toBe(true);
  });
});
