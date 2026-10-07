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
import { getGroupAmendmentDisplayStatusForGroup } from '@/features/groups/logic/groupAmendmentStatus';

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

type QueryFixtureRow = Record<string, any>;

function relatedFixtureRows(row: QueryFixtureRow, relation: string): QueryFixtureRow[] {
  const related = row[relation];
  return related == null ? [] : Array.isArray(related) ? related : [related];
}

function matchesFixtureValue(row: QueryFixtureRow, args: readonly unknown[]): boolean {
  const [field, operatorOrValue, expected] = args;
  const value = row[String(field)];
  if (args.length === 2) return value === operatorOrValue;
  if (operatorOrValue === 'IS') return value == expected;
  if (operatorOrValue === 'IN') return (expected as unknown[]).includes(value);
  if (operatorOrValue === 'ILIKE')
    return String(value ?? '')
      .toLowerCase()
      .includes(String(expected).slice(1, -1).toLowerCase());
  throw new Error(`Unsupported fixture operator: ${String(operatorOrValue)}`);
}

function matchesFixturePredicate(row: QueryFixtureRow, predicate: unknown): boolean {
  const matchesRelated = (relation: string, cb: (q: any) => unknown) =>
    relatedFixtureRows(row, relation).some(relatedRow => {
      const clauses: boolean[] = [];
      const child = {
        where: (...args: unknown[]) => {
          clauses.push(matchesFixtureWhere(relatedRow, args));
          return child;
        },
        whereExists: (name: string, nested: (q: any) => unknown) => {
          clauses.push(
            matchesFixturePredicate(relatedRow, ({ exists }: any) => exists(name, nested))
          );
          return child;
        },
      };
      cb(child);
      return clauses.every(Boolean);
    });
  const expressions = {
    cmp: (...args: unknown[]) => matchesFixtureValue(row, args),
    exists: matchesRelated,
    or: (...values: boolean[]) => values.some(Boolean),
    and: (...values: boolean[]) => values.every(Boolean),
    not: (value: boolean) => !value,
  };
  return (predicate as (builder: any) => boolean)(expressions);
}

function matchesFixtureWhere(row: QueryFixtureRow, args: readonly unknown[]): boolean {
  return typeof args[0] === 'function'
    ? matchesFixturePredicate(row, args[0])
    : matchesFixtureValue(row, args);
}

function matchesFixtureQuery(query: FakeQuery, row: QueryFixtureRow): boolean {
  return query.calls.every(call => {
    if (call[0] === 'where') return matchesFixtureWhere(row, call.slice(1));
    if (call[0] === 'whereExists')
      return relatedFixtureRows(row, String(call[1])).some(relatedRow =>
        (call[2] as QueryCall[]).every(nested =>
          nested[0] === 'where' ? matchesFixtureWhere(relatedRow, nested.slice(1)) : true
        )
      );
    return true;
  });
}

beforeEach(() => {
  queryState.byTable = {};
});

describe('amendment query nested authorization', () => {
  it('fail-closes anonymous activity and supports an unfiltered activity feed', () => {
    amendmentQueries.activities.fn({
      args: { entityId: 'amendment-1', severity: 'all', cursor: null, limit: 20 },
      ctx: anonymousCtx,
    });

    expect(lastQuery('amendment_activity.amendment').calls).toContainEqual([
      'where',
      'id',
      '__unauthorized__',
    ]);
  });

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
        ['where', 'roles', 'scope', 'amendment'],
        ['whereExists', 'roles', 'amendment_collaborators'],
        ['where', 'roles.amendment_collaborators', 'user_id', ctx.userID],
        [
          'where',
          'roles.amendment_collaborators',
          'status',
          'IN',
          ['active', 'collaborator', 'member', 'admin'],
        ],
        ['whereExists', 'roles', 'amendment_action_rights'],
        ['where', 'roles.amendment_action_rights', 'resource', 'amendments'],
        ['where', 'roles.amendment_action_rights', 'action', 'manage'],
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
        ['where', 'roles', 'scope', 'amendment'],
        ['whereExists', 'roles', 'amendment_collaborators'],
        ['where', 'roles.amendment_collaborators', 'user_id', ctx.userID],
        [
          'where',
          'roles.amendment_collaborators',
          'status',
          'IN',
          ['active', 'collaborator', 'member', 'admin'],
        ],
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
        ['where', 'roles', 'scope', 'amendment'],
        ['whereExists', 'roles', 'amendment_collaborators'],
        ['where', 'roles.amendment_collaborators', 'user_id', ctx.userID],
        ['whereExists', 'roles', 'amendment_action_rights'],
        ['where', 'roles.amendment_action_rights', 'resource', 'amendments'],
        ['where', 'roles.amendment_action_rights', 'action', 'manage'],
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
        ids: ['amendment-1'],
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
    expect(filtered).toContainEqual(['where', 'id', 'IN', ['amendment-1']]);

    amendmentQueries.groupAmendmentPage.fn({
      args: {
        groupId: 'group-1',
        query: ' ',
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx,
    });
    expect(lastQuery('amendment').calls).toContainEqual(['orderBy', 'created_at', 'desc']);
  });

  it('lists current process endpoints and stations before an event in both page and count', () => {
    const amendment = {
      id: 'amendment-1',
      visibility: 'public',
      tutorial_run_id: null,
      group_id: null,
      event: null,
      group_decisions: [],
      current_process_run: {
        selected_source_group_id: 'start',
        selected_target_group_id: 'target',
        step_runs: [
          {
            source_group_id: 'start',
            target_group_id: 'station',
            status: 'pending_event',
            decision_status: 'previous_decision_outstanding',
            event: null,
          },
          {
            source_group_id: 'source-only',
            target_group_id: 'station',
            status: 'pending_event',
            decision_status: null,
            event: null,
          },
        ],
        compatibility_paths: [{ segments: [{ group_id: 'path-only' }] }],
      },
      process_runs: [
        { selected_source_group_id: 'historical', selected_target_group_id: 'historical' },
      ],
    };

    for (const groupId of ['start', 'target', 'station', 'source-only', 'path-only']) {
      amendmentQueries.groupAmendmentPage.fn({
        args: {
          groupId,
          ids: [amendment.id],
          query: '',
          limit: 20,
          start: null,
          dir: 'forward',
        },
        ctx: anonymousCtx,
      });
      expect(matchesFixtureQuery(lastQuery('amendment'), amendment)).toBe(true);

      amendmentQueries.groupAmendmentCountRows.fn({
        args: { groupId, query: '' },
        ctx: anonymousCtx,
      });
      expect(matchesFixtureQuery(lastQuery('amendment'), amendment)).toBe(true);
      expect(getGroupAmendmentDisplayStatusForGroup(amendment, groupId)).toBe('pending');
    }

    for (const groupId of ['historical', 'unrelated']) {
      amendmentQueries.groupAmendmentPage.fn({
        args: {
          groupId,
          ids: [amendment.id],
          query: '',
          limit: 20,
          start: null,
          dir: 'forward',
        },
        ctx: anonymousCtx,
      });
      expect(matchesFixtureQuery(lastQuery('amendment'), amendment)).toBe(false);
    }
  });

  it('keeps decisions and event statuses ahead of the pending fallback and enforces visibility', () => {
    const base = {
      id: 'amendment-1',
      visibility: 'public',
      tutorial_run_id: null,
      group_id: null,
      event: null,
      group_decisions: [],
      current_process_run: {
        selected_source_group_id: 'group-1',
        selected_target_group_id: 'group-2',
        step_runs: [],
        compatibility_paths: [],
      },
    };
    const decision = {
      ...base,
      group_decisions: [{ group_id: 'group-1', status: 'accepted' }],
    };
    const scheduled = {
      ...base,
      current_process_run: {
        ...base.current_process_run,
        step_runs: [
          {
            source_group_id: 'group-1',
            target_group_id: 'group-2',
            status: 'scheduled',
            decision_status: 'approved',
            event: { group_id: 'group-2' },
          },
        ],
      },
    };

    expect(getGroupAmendmentDisplayStatusForGroup(decision, 'group-1')).toBe('accepted');
    expect(getGroupAmendmentDisplayStatusForGroup(scheduled, 'group-2')).toBe('accepted');
    expect(getGroupAmendmentDisplayStatusForGroup(scheduled, 'group-1')).toBe('pending');

    amendmentQueries.groupAmendmentCountRows.fn({
      args: { groupId: 'group-2', query: '' },
      ctx: anonymousCtx,
    });
    const countRows = lastQuery('amendment').calls;
    expect(relatedCalls(countRows, 'group_decisions')).toContainEqual([
      'where',
      'group_id',
      'group-2',
    ]);
    expect(
      relatedCalls(
        relatedCalls(relatedCalls(countRows, 'current_process_run'), 'step_runs'),
        'event'
      )
    ).toBeDefined();

    amendmentQueries.groupAmendmentPage.fn({
      args: {
        groupId: 'group-1',
        ids: [base.id],
        query: '',
        limit: 20,
        start: null,
        dir: 'forward',
      },
      ctx: anonymousCtx,
    });
    expect(matchesFixtureQuery(lastQuery('amendment'), { ...base, visibility: 'private' })).toBe(
      false
    );
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
