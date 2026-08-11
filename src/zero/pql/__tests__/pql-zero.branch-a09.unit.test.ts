import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  can: vi.fn(),
  query: undefined as undefined | ((args: any) => unknown),
  requireAuthenticated: vi.fn(),
  requireOwner: vi.fn(),
}));

vi.mock('@rocicorp/zero', () => ({
  defineMutator: (_schema: unknown, fn: unknown) => ({ fn }),
  defineQuery: (_schema: unknown, fn: (args: any) => unknown) => {
    state.query = fn;
    return { fn };
  },
}));
vi.mock('../schema', () => ({
  createPqlFilterSchema: {},
  deletePqlFilterSchema: {},
  updatePqlFilterSchema: {},
}));
vi.mock('../../rbac/can', () => ({ can: (...args: unknown[]) => state.can(...args) }));
vi.mock('../../rbac/authorize', () => ({
  requireAuthenticated: (...args: unknown[]) => state.requireAuthenticated(...args),
  requireOwner: (...args: unknown[]) => state.requireOwner(...args),
}));
vi.mock('../../schema', () => {
  const chain: any = {};
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.one = vi.fn(() => chain);
  return { zql: { pql_filter: chain } };
});

import { pqlQueries } from '../queries';
import { pqlSharedMutators } from '../shared-mutators';

function tx(location: 'client' | 'server' = 'server', row?: unknown) {
  const insert = vi.fn();
  const update = vi.fn();
  const remove = vi.fn();
  return {
    value: {
      location,
      run: vi.fn(async () => row),
      mutate: { pql_filter: { insert, update, delete: remove } },
    },
    insert,
    update,
    remove,
  };
}

const ctx = { userID: 'user-1' };

beforeEach(() => vi.clearAllMocks());

describe('PQL Zero remaining branches A09', () => {
  it('queries group and personal scopes', () => {
    expect(pqlQueries.byScope).toBeTruthy();
    state.query!({ ctx, args: { storage_key: 'todos', group_id: 'group-1' } });
    state.query!({ ctx, args: { storage_key: 'todos', group_id: null } });
  });

  it('creates group and personal filters', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10);
    const grouped = tx();
    await pqlSharedMutators.create.fn({
      tx: grouped.value,
      ctx,
      args: {
        id: 'one',
        storage_key: 'todos',
        group_id: 'group-1',
        label: 'One',
        query: 'x',
        is_active: false,
      },
    } as never);
    expect(state.can).toHaveBeenCalled();
    expect(grouped.insert).toHaveBeenCalledWith(expect.objectContaining({ group_id: 'group-1' }));

    const personal = tx();
    await pqlSharedMutators.create.fn({
      tx: personal.value,
      ctx,
      args: {
        id: 'two',
        storage_key: 'todos',
        group_id: undefined,
        label: 'Two',
        query: 'x',
        is_active: false,
      },
    } as never);
    expect(personal.insert).toHaveBeenCalledWith(expect.objectContaining({ group_id: null }));
  });

  it('updates and deletes optimistically on clients and authorizes servers', async () => {
    const client = tx('client');
    await pqlSharedMutators.update.fn({
      tx: client.value,
      ctx,
      args: { id: 'one', label: 'Updated' },
    } as never);
    await pqlSharedMutators.delete.fn({ tx: client.value, ctx, args: { id: 'one' } } as never);
    expect(client.value.run).not.toHaveBeenCalled();

    const server = tx('server', { user_id: 'user-1' });
    await pqlSharedMutators.update.fn({
      tx: server.value,
      ctx,
      args: { id: 'one', query: 'y' },
    } as never);
    await pqlSharedMutators.delete.fn({ tx: server.value, ctx, args: { id: 'one' } } as never);
    expect(state.requireOwner).toHaveBeenCalledTimes(2);
  });
});
