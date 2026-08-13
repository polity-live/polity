import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryDefinition {
  fn: (input: { args: Record<string, any>; ctx: { userID?: string | null } }) => unknown;
}

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
});

async function loadQueries() {
  const harness = createAutoQueryHarness();
  const identity = (query: unknown) => query;
  vi.doMock('@rocicorp/zero', () => ({
    defineQuery: (validator: unknown, fn: QueryDefinition['fn']) => ({ validator, fn }),
  }));
  vi.doMock('../../schema', () => ({ zql: harness.zql }));
  vi.doMock('../../rbac/query-access', () => ({
    applyAgendaItemQueryAccess: identity,
    applyAmendmentQueryAccess: identity,
    applyBlogQueryAccess: identity,
    applyDocumentQueryAccess: identity,
    applyElectionQueryAccess: identity,
    applyEventManagerQueryAccess: identity,
    applyEventParticipantOrManagerQueryAccess: identity,
    applyEventQueryAccess: identity,
    applyGroupMembershipSelfOrManagerQueryAccess: identity,
    applyGroupQueryAccess: identity,
    applyStatementQueryAccess: identity,
    applyTodoQueryAccess: identity,
    applyUserQueryAccess: identity,
    isAuthenticatedUserId: (userID: unknown) => typeof userID === 'string' && userID.length > 0,
    requireQueryUser: identity,
    requireRequestedViewer: identity,
  }));
  const { commonQueries } = await import('../queries');
  return {
    harness,
    commonQueries: commonQueries as unknown as Record<string, QueryDefinition>,
  };
}

const broadArgs = {
  id: 'entity-1',
  user_id: 'user-2',
  userId: 'user-2',
  group_id: 'group-1',
  amendment_id: 'amendment-1',
  event_id: 'event-1',
  blog_id: 'blog-1',
  statement_id: 'statement-1',
  entity_type: 'group',
  entity_id: 'group-1',
  entity_ids: ['group-1'],
  entityIds: ['group-1'],
  content_types: ['group'],
  contentTypes: ['group'],
  subscriber_id: 'user-1',
  subscriberId: 'user-1',
  now: 1_700_000_000_000,
  limit: 20,
  start: { id: 'cursor-1', created_at: 100 },
  dir: 'backward',
};

describe('commonQueries branch coverage', () => {
  it('builds every query and all nested access/relation callbacks', async () => {
    const { harness, commonQueries } = await loadQueries();

    for (const query of Object.values(commonQueries)) {
      query.fn({ args: broadArgs, ctx: { userID: 'user-1' } });
    }

    expect(harness.touchedTables).toEqual(
      expect.arrayContaining(['subscriber', 'hashtag', 'link', 'timeline_event', 'reaction'])
    );
  });

  it('covers anonymous access and absent subscriber/link filters', async () => {
    const { commonQueries } = await loadQueries();

    commonQueries.subscribers.fn({ args: {}, ctx: { userID: undefined } });
    commonQueries.links.fn({ args: {}, ctx: { userID: null } });
    commonQueries.timelineByEntity.fn({
      args: { entity_type: 'group', entity_id: 'group-1', now: 1 },
      ctx: { userID: undefined },
    });
    commonQueries.reactions.fn({
      args: { entity_type: 'group', entity_id: 'group-1', now: 1 },
      ctx: { userID: null },
    });
    commonQueries.timelineEventsByEntityIds.fn({
      args: { entity_ids: [], now: 1 },
      ctx: { userID: undefined },
    });
  });

  it('covers both timeline-page and subscription-page cursor directions', async () => {
    const { commonQueries } = await loadQueries();

    commonQueries.timelineFeedPage.fn({
      args: {
        entityIds: [],
        contentTypes: [],
        now: 1,
        limit: 10,
        start: null,
        dir: 'forward',
      },
      ctx: { userID: undefined },
    });
    commonQueries.timelineFeedPage.fn({
      args: {
        entityIds: ['group-1'],
        contentTypes: ['group'],
        now: 1,
        limit: 10,
        start: { id: 'cursor-2', created_at: 2 },
        dir: 'backward',
      },
      ctx: { userID: 'user-1' },
    });
    commonQueries.subscriptionPage.fn({
      args: { subscriberId: 'user-1', limit: 10, start: null, dir: 'forward' },
      ctx: { userID: 'user-1' },
    });
    commonQueries.subscriptionPage.fn({
      args: {
        subscriberId: 'user-1',
        limit: 10,
        start: { id: 'cursor-3', created_at: 3 },
        dir: 'backward',
      },
      ctx: { userID: 'user-1' },
    });
  });
});
