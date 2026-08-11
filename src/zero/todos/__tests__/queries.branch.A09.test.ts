import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  apply: vi.fn((query: unknown) => query),
  calls: [] as [string, ...unknown[]][],
}));

function builder(label: string): any {
  const q: any = {};
  for (const method of ['limit', 'one', 'orderBy', 'start']) {
    q[method] = (...args: unknown[]) => {
      h.calls.push([`${label}.${method}`, ...args]);
      return q;
    };
  }
  q.where = (...args: any[]) => {
    h.calls.push([`${label}.where`, ...args]);
    if (typeof args[0] === 'function') {
      const cmp = (...cmpArgs: unknown[]) => ({ cmp: cmpArgs });
      const exists = (_relation: string, callback: (nested: any) => unknown) =>
        callback(builder('exists'));
      const or = (...values: unknown[]) => values;
      args[0]({ cmp, exists, or });
    }
    return q;
  };
  q.whereExists = (_relation: string, callback: (nested: any) => unknown) => {
    h.calls.push([`${label}.whereExists`, _relation]);
    callback(builder('whereExists'));
    return q;
  };
  q.related = (relation: string, callback?: (nested: any) => unknown) => {
    h.calls.push([`${label}.related`, relation]);
    if (callback) callback(builder(`related:${relation}`));
    return q;
  };
  return q;
}

vi.mock('@rocicorp/zero', () => ({
  defineQuery: (_schema: unknown, fn: (...args: any[]) => unknown) => ({ fn }),
}));
vi.mock('../../rbac/query-access', () => ({ applyTodoQueryAccess: h.apply }));
vi.mock('../../schema', () => ({
  zql: {
    todo: builder('todo'),
    todo_assignment: builder('assignment'),
  },
}));
vi.mock('../../virtualization', async () => {
  const { z } = await import('zod');
  return { virtualPageLimitSchema: z.number() };
});

import { todoQueries } from '../queries';

function invoke(name: keyof typeof todoQueries, args: Record<string, unknown>, userID?: string) {
  return (todoQueries[name] as any).fn({ args, ctx: { userID } });
}

function page(overrides: Record<string, unknown> = {}) {
  return invoke(
    'page',
    {
      archive: 'active',
      assigneeId: undefined,
      creatorId: undefined,
      dir: 'forward',
      groupId: undefined,
      limit: 25,
      priority: undefined,
      query: '',
      sort: 'created',
      start: null,
      status: 'all',
      ...overrides,
    },
    'user'
  );
}

beforeEach(() => {
  h.calls.length = 0;
  h.apply.mockClear();
});

describe('todo queries', () => {
  it('builds the default active forward page', () => {
    page({ query: '   ' });
    expect(h.calls).toContainEqual(['todo.orderBy', 'created_at', 'desc']);
    expect(h.calls).toContainEqual(['todo.limit', 25]);
    expect(h.calls.some(([name]) => name === 'todo.start')).toBe(false);
  });

  it('builds a fully filtered archived backward page with a cursor', () => {
    page({
      archive: 'archived',
      assigneeId: 'assignee',
      creatorId: 'creator',
      dir: 'backward',
      groupId: 'group',
      priority: 'urgent',
      query: ' search ',
      sort: 'due',
      start: { id: 'todo' },
      status: 'pending',
    });
    expect(h.calls).toContainEqual(['todo.orderBy', 'archived_at', 'asc']);
    expect(h.calls).toContainEqual(['todo.start', { id: 'todo' }, { inclusive: false }]);
    expect(h.calls.some(([name]) => name === 'todo.whereExists')).toBe(true);
  });

  it('selects updated and due sort fields for active pages', () => {
    page({ sort: 'updated' });
    expect(h.calls).toContainEqual(['todo.orderBy', 'updated_at', 'desc']);
    h.calls.length = 0;
    page({ sort: 'due' });
    expect(h.calls).toContainEqual(['todo.orderBy', 'due_date', 'desc']);
  });

  it('builds compact user, group, id, and assignment queries', () => {
    invoke('byUser', {}, 'user');
    invoke('byGroup', { group_id: 'group' }, 'user');
    invoke('byId', { id: 'todo' }, 'user');
    invoke('assignments', { todo_id: 'todo' }, 'user');
    invoke('byGroupWithAssignments', { group_id: 'group' }, 'user');
    expect(h.apply).toHaveBeenCalledTimes(5);
    expect(h.calls).toContainEqual(['assignment.related', 'user']);
  });

  it('builds full relation graphs for authenticated and anonymous readers', () => {
    invoke('byIdWithRelations', { id: 'todo' }, 'user');
    invoke('byIdWithRelations', { id: 'todo' }, undefined);
    const voteFilters = h.calls.filter(
      ([name, field]) => name.endsWith('.where') && field === 'user_id'
    );
    expect(voteFilters.some(([, , value]) => value === 'user')).toBe(true);
    expect(voteFilters.some(([, , value]) => value === '__anon__')).toBe(true);
  });

  it('builds active and archived all-with-relations queries', () => {
    invoke('allWithRelations', { archive: 'active' }, 'user');
    expect(h.calls).toContainEqual(['todo.orderBy', 'created_at', 'desc']);
    h.calls.length = 0;
    invoke('allWithRelations', { archive: 'archived' }, 'user');
    expect(h.calls).toContainEqual(['todo.orderBy', 'archived_at', 'desc']);
  });

  it('builds active and archived group relation queries', () => {
    invoke('byGroupWithRelations', { archive: 'active', group_id: 'group' }, 'user');
    expect(h.calls).toContainEqual(['todo.orderBy', 'created_at', 'desc']);
    h.calls.length = 0;
    invoke('byGroupWithRelations', { archive: 'archived', group_id: 'group' }, 'user');
    expect(h.calls).toContainEqual(['todo.orderBy', 'archived_at', 'desc']);
  });
});
