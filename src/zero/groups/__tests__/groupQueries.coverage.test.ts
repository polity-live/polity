import { describe, expect, it, vi } from 'vitest';

interface FakeQuery {
  calls: [string, ...unknown[]][];
}

interface FakeOperators {
  cmp: (...values: unknown[]) => unknown[];
  or: (...values: unknown[]) => unknown[];
  and: (...values: unknown[]) => unknown[];
  exists: (relation: string, fn: (child: FakeQuery) => unknown) => unknown;
}

const state = vi.hoisted(() => ({ calls: 0 }));

vi.mock('@rocicorp/zero', () => ({
  defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
}));

vi.mock('../../rbac/query-access', () => {
  const passThrough = (query: unknown) => query;
  return {
    applyAmendmentQueryAccess: passThrough,
    applyBlogQueryAccess: passThrough,
    applyDocumentQueryAccess: passThrough,
    applyEventManagerQueryAccess: passThrough,
    applyEventQueryAccess: passThrough,
    applyGroupQueryAccess: passThrough,
    applyGroupManagerQueryAccess: passThrough,
    applyGroupMembershipSelfOrManagerQueryAccess: passThrough,
    applyTodoQueryAccess: passThrough,
    requireRequestedViewer: passThrough,
  };
});

vi.mock('../../schema', () => {
  function createQuery(): FakeQuery {
    const target: FakeQuery = { calls: [] };
    const query = new Proxy(target, {
      get(object, property) {
        if (property === 'calls') return object.calls;
        return (...args: unknown[]) => {
          state.calls += 1;
          object.calls.push([String(property), ...args]);
          if (property === 'where' && typeof args[0] === 'function') {
            const operators: FakeOperators = {
              cmp: (...values: unknown[]) => values,
              or: (...values: unknown[]) => values,
              and: (...values: unknown[]) => values,
              exists: (_relation: string, fn: (child: FakeQuery) => unknown) => fn(createQuery()),
            };
            (args[0] as (operators: FakeOperators) => unknown)(operators);
          }
          if (
            (property === 'related' || property === 'whereExists') &&
            typeof args[1] === 'function'
          ) {
            (args[1] as (child: FakeQuery) => unknown)(createQuery());
          }
          return query;
        };
      },
    });
    return query;
  }

  return {
    zql: new Proxy({}, { get: () => createQuery() }),
  };
});

import { groupQueries } from '../queries';

const fullArgs = {
  id: 'id',
  groupId: 'group',
  groupIds: ['group'],
  userId: 'user',
  user_id: 'user',
  eventIds: ['event'],
  query: ' term ',
  status: 'active',
  statuses: ['active'],
  roleId: 'role',
  roleIds: ['role'],
  limit: 20,
  start: { id: 'cursor', created_at: 1 },
  dir: 'backward',
  archive: 'archived',
};

function run(name: keyof typeof groupQueries, args: any = fullArgs, userID: string | undefined = 'viewer') {
  return (groupQueries[name] as any).fn({
    args,
    ctx: { userID, email: userID ? 'viewer@example.com' : undefined },
  });
}

describe('group query contracts', () => {
  it('constructs every query and executes every nested relational callback', () => {
    for (const name of Object.keys(groupQueries) as (keyof typeof groupQueries)[]) {
      expect(() => run(name)).not.toThrow();
      expect(() => run(name, fullArgs, null as any)).not.toThrow();
    }
    expect(state.calls).toBeGreaterThan(500);
  });

  it('covers optional paging filters and both cursor directions', () => {
    const emptyPageArgs = {
      ...fullArgs,
      query: '   ',
      status: undefined,
      statuses: [],
      roleId: undefined,
      roleIds: [],
      start: null,
      dir: 'forward',
    };
    expect(() => run('membershipPage', emptyPageArgs)).not.toThrow();
    expect(() => run('guestAccessPage', emptyPageArgs)).not.toThrow();
    expect(() => run('membershipPageByUser', emptyPageArgs)).not.toThrow();
  });

  it('constructs active and archived todo queries plus all viewer variants', () => {
    expect(() => run('todosByGroup', { ...fullArgs, archive: 'active' })).not.toThrow();
    expect(() => run('todosByGroup', { ...fullArgs, archive: 'archived' })).not.toThrow();
    expect(() => run('allUsersLimited', fullArgs, undefined)).not.toThrow();
    expect(() => run('allUsersLimited', fullArgs, 'anon')).not.toThrow();
    expect(() => run('allUsersLimited', fullArgs, 'viewer')).not.toThrow();
  });
});
