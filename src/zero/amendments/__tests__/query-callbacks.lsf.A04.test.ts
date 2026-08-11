import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invokedCallbacks: 0 }));

vi.mock('@rocicorp/zero', () => ({
  defineQuery: (_schema: unknown, fn: (input: unknown) => unknown) => ({ fn }),
}));

vi.mock('../../rbac/query-access', () => {
  const identity = (query: unknown) => query;
  return {
    applyAgendaItemQueryAccess: identity,
    applyAmendmentQueryAccess: identity,
    applyChangeRequestVisibilityAccess: identity,
    applyDocumentQueryAccess: identity,
    applyEventQueryAccess: identity,
    applyGroupManagerQueryAccess: identity,
    applyGroupQueryAccess: identity,
    applyVoteManagerQueryAccess: identity,
    applyVoteQueryAccess: identity,
    applyVoteVoterOrManagerQueryAccess: identity,
    requireQueryUser: identity,
  };
});

vi.mock('../../schema', () => {
  const operators = {
    and: (...values: unknown[]) => values,
    cmp: (...values: unknown[]) => values,
    exists: (_relation: string, callback: (value: unknown) => unknown) => {
      mocks.invokedCallbacks += 1;
      callback(query);
      return true;
    },
    or: (...values: unknown[]) => values,
  };
  const query: Record<string, any> = new Proxy(
    {},
    {
      get: (_target, property: string) => {
        if (property === 'then') return undefined;
        return (...args: unknown[]) => {
          for (const arg of args) {
            if (typeof arg === 'function') {
              mocks.invokedCallbacks += 1;
              arg(property === 'where' ? operators : query);
            }
          }
          return query;
        };
      },
    }
  );
  return { zql: new Proxy({}, { get: () => query }) };
});

import { amendmentQueries } from '../queries';
import { appearanceThemeQueries } from '../../appearance-themes/queries';

const args = {
  id: '00000000-0000-4000-8000-000000000001',
  amendment_id: 'amendment-1',
  amendmentId: 'amendment-1',
  agenda_item_id: 'agenda-1',
  branchId: 'branch-1',
  commentId: 'comment-1',
  dir: 'backward',
  displayStatus: 'accepted',
  event_id: 'event-1',
  group_id: 'group-1',
  groupId: '00000000-0000-4000-8000-000000000002',
  hashtag: 'mobility',
  ids: ['user-1'],
  limit: 25,
  parentId: null,
  process_branch_id: 'branch-1',
  query: ' streets ',
  roleId: 'role-1',
  roleIds: ['role-1'],
  sort: 'votes',
  start: { id: 'start', created_at: 1, upvotes: 2, downvotes: 1 },
  status: 'active',
  statuses: ['active'],
  themeId: '00000000-0000-4000-8000-000000000003',
  threadId: 'thread-1',
  user_id: 'user-1',
  userId: 'user-1',
  vote_id: 'vote-1',
};

describe('A04 query callback contracts', () => {
  it('executes every amendment query builder and all nested relation predicates', () => {
    for (const query of Object.values(amendmentQueries) as { fn: (input: unknown) => unknown }[]) {
      query.fn({ args, ctx: { userID: 'user-1', email: 'user@example.test' } });
    }
    expect(mocks.invokedCallbacks).toBeGreaterThan(100);
  });

  it('executes every appearance-theme query builder and nested membership predicate', () => {
    for (const query of Object.values(appearanceThemeQueries) as {
      fn: (input: unknown) => unknown;
    }[]) {
      query.fn({ args, ctx: { userID: 'user-1', email: 'user@example.test' } });
    }
    expect(mocks.invokedCallbacks).toBeGreaterThan(110);
  });

  it('accepts omitted collaborator status and role arrays at the builder boundary', () => {
    amendmentQueries.collaboratorPage.fn({
      args: { ...args, statuses: undefined, roleIds: undefined } as any,
      ctx: { userID: 'user-1', email: 'user@example.test' },
    });
    amendmentQueries.collaborationPageByUser.fn({
      args: { ...args, statuses: undefined } as any,
      ctx: { userID: 'user-1', email: 'user@example.test' },
    });
  });
});
