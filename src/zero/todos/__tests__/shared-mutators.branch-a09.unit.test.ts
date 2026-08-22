import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  can: vi.fn(),
  requireAuthenticated: vi.fn(),
  requireOwner: vi.fn(),
}));

vi.mock('@rocicorp/zero', () => ({
  defineMutator: (_schema: unknown, fn: (...args: any[]) => unknown) => ({ fn }),
}));
vi.mock('../../rbac/can', () => ({ can: h.can }));
vi.mock('../../rbac/authorize', () => ({
  requireAuthenticated: h.requireAuthenticated,
  requireOwner: h.requireOwner,
}));
vi.mock('../../schema', () => ({
  zql: {
    todo: { where: () => ({ one: () => ({ query: 'todo' }) }) },
    todo_assignment: {
      where: () => ({
        one: () => ({ query: 'assignment' }),
        where: () => ({ one: () => ({ query: 'assignment' }) }),
      }),
    },
  },
}));
vi.mock('../schema', () => ({
  archiveTodoSchema: {},
  createTodoAssignmentSchema: {},
  createTodoFullMutatorSchema: {},
  createTodoSchema: {},
  deleteTodoAssignmentSchema: {},
  deleteTodoSchema: {},
  toggleCompleteTodoSchema: {},
  unarchiveTodoSchema: {},
  updateTodoSchema: {},
}));

import { PermissionError } from '../../rbac/errors';
import { todoSharedMutators } from '../shared-mutators';

const ctx = { userID: 'actor' } as any;

function tx(location: 'client' | 'server' = 'server') {
  return {
    location,
    mutate: {
      thread: { insert: vi.fn() },
      todo: { delete: vi.fn(), insert: vi.fn(), update: vi.fn() },
      todo_activity: { insert: vi.fn() },
      todo_assignment: { delete: vi.fn(), insert: vi.fn() },
    },
    run: vi.fn(),
  } as any;
}

async function call(name: keyof typeof todoSharedMutators, transaction: any, args: any) {
  return todoSharedMutators[name].fn({ args, ctx, tx: transaction } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('todo shared mutators', () => {
  it('creates standalone server and optimistic client todos', async () => {
    const server = tx();
    await call('create', server, { group_id: null, id: 'server' });
    expect(h.requireAuthenticated).toHaveBeenCalled();
    expect(server.mutate.thread.insert).not.toHaveBeenCalled();
    expect(server.mutate.todo_activity.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'created', id: 'server', severity: 'high' })
    );

    const client = tx('client');
    await call('create', client, { group_id: undefined, id: 'client' });
    expect(client.mutate.thread.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'client', todo_id: 'client' })
    );
    expect(client.mutate.todo_activity.insert).not.toHaveBeenCalled();
  });

  it('authorizes group creation and delegates createFull', async () => {
    const transaction = tx();
    await call('create', transaction, { group_id: 'group', id: 'todo' });
    expect(h.can).toHaveBeenCalledWith(
      transaction,
      ctx,
      expect.objectContaining({ groupId: 'group' })
    );
    await call('createFull', transaction, { todo: { group_id: null, id: 'full' } });
    expect(transaction.mutate.todo.insert).toHaveBeenCalledTimes(2);
  });

  it('fails when an update cannot load its todo', async () => {
    const transaction = tx('client');
    transaction.run.mockResolvedValueOnce(undefined);
    await expect(call('update', transaction, { id: 'missing' })).rejects.toThrow('Todo not found');
  });

  it('updates client todos and clears archives for active statuses', async () => {
    const transaction = tx('client');
    transaction.run.mockResolvedValueOnce({ archived_at: 1, id: 'todo' });
    await call('update', transaction, { id: 'todo', status: 'pending' });
    expect(transaction.mutate.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({ archived_at: null, id: 'todo', status: 'pending' })
    );
  });

  it('authorizes grouped and standalone server updates without clearing valid archives', async () => {
    const grouped = tx();
    grouped.run
      .mockResolvedValueOnce({ group_id: 'group', id: 'todo' })
      .mockResolvedValueOnce({ archived_at: 1, id: 'todo' });
    await call('update', grouped, { id: 'todo', status: 'completed' });
    expect(h.can).toHaveBeenCalled();
    expect(grouped.mutate.todo.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ archived_at: null })
    );

    const standalone = tx();
    standalone.run
      .mockResolvedValueOnce({ creator_id: 'creator', group_id: null, id: 'todo' })
      .mockResolvedValueOnce({ archived_at: 0, id: 'todo' });
    await call('update', standalone, { id: 'todo' });
    expect(h.requireOwner).toHaveBeenCalledWith(
      standalone,
      ctx,
      'creator',
      expect.objectContaining({ action: 'update' })
    );
    expect(standalone.mutate.todo_activity.insert).not.toHaveBeenCalled();
  });

  it('records grouped field changes once and raises status changes to high severity', async () => {
    const transaction = tx();
    transaction.run
      .mockResolvedValueOnce({ creator_id: 'actor', group_id: null, id: 'todo' })
      .mockResolvedValueOnce({
        archived_at: null,
        description: 'Before',
        id: 'todo',
        priority: 'normal',
        status: 'pending',
        title: 'Before',
      });

    await call('update', transaction, {
      description: 'After',
      id: 'todo',
      priority: 'high',
      status: 'completed',
      title: 'After',
    });

    expect(transaction.mutate.todo_activity.insert).toHaveBeenCalledTimes(1);
    expect(transaction.mutate.todo_activity.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'updated',
        changes: expect.arrayContaining([
          { field: 'title', from: 'Before', to: 'After' },
          { field: 'status', from: 'pending', to: 'completed' },
        ]),
        severity: 'high',
      })
    );
  });

  it('records normal metadata edits and skips no-op updates', async () => {
    const changed = tx();
    changed.run
      .mockResolvedValueOnce({ creator_id: 'actor', group_id: null, id: 'todo' })
      .mockResolvedValueOnce({ archived_at: null, id: 'todo', priority: 'low' });
    await call('update', changed, { id: 'todo', priority: 'medium' });
    expect(changed.mutate.todo_activity.insert).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'normal' })
    );

    const unchanged = tx();
    unchanged.run
      .mockResolvedValueOnce({ creator_id: 'actor', group_id: null, id: 'todo' })
      .mockResolvedValueOnce({ archived_at: null, id: 'todo', priority: 'medium' });
    await call('update', unchanged, { id: 'todo', priority: 'medium' });
    expect(unchanged.mutate.todo_activity.insert).not.toHaveBeenCalled();
  });

  it('rejects incomplete archives and keeps archive idempotent', async () => {
    const incomplete = tx('client');
    incomplete.run
      .mockResolvedValueOnce({ archived_at: null, id: 'todo', status: 'pending' })
      .mockResolvedValueOnce({ archived_at: null, id: 'todo', status: 'pending' });
    await expect(call('archive', incomplete, { id: 'todo' })).rejects.toThrow(
      'Only completed todos can be archived'
    );

    const archived = tx('client');
    archived.run
      .mockResolvedValueOnce({ archived_at: 1, id: 'todo', status: 'completed' })
      .mockResolvedValueOnce({ archived_at: 1, id: 'todo', status: 'completed' });
    await call('archive', archived, { id: 'todo' });
    expect(archived.mutate.todo.update).not.toHaveBeenCalled();
  });

  it('archives completed todos and handles both unarchive states', async () => {
    const active = tx('client');
    active.run
      .mockResolvedValueOnce({ archived_at: null, id: 'todo', status: 'completed' })
      .mockResolvedValueOnce({ archived_at: null, id: 'todo', status: 'completed' });
    await call('archive', active, { id: 'todo' });
    expect(active.mutate.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({ archived_at: expect.any(Number) })
    );

    const notArchived = tx('client');
    notArchived.run
      .mockResolvedValueOnce({ archived_at: null, id: 'todo' })
      .mockResolvedValueOnce({ archived_at: null, id: 'todo' });
    await call('unarchive', notArchived, { id: 'todo' });
    expect(notArchived.mutate.todo.update).not.toHaveBeenCalled();

    const archived = tx('client');
    archived.run
      .mockResolvedValueOnce({ archived_at: 1, id: 'todo' })
      .mockResolvedValueOnce({ archived_at: 1, id: 'todo' });
    await call('unarchive', archived, { id: 'todo' });
    expect(archived.mutate.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({ archived_at: null })
    );
  });

  it('deletes and assigns client todos', async () => {
    const transaction = tx('client');
    await call('delete', transaction, { id: 'todo' });
    await call('assign', transaction, { id: 'assignment', todo_id: 'todo', user_id: 'user' });
    expect(transaction.mutate.todo.delete).toHaveBeenCalledWith({ id: 'todo' });
    expect(transaction.mutate.todo_assignment.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_at: expect.any(Number), id: 'assignment' })
    );
  });

  it('records server assignment changes from the current assignee list', async () => {
    const transaction = tx();
    transaction.run
      .mockResolvedValueOnce({ creator_id: 'actor', group_id: null, id: 'todo' })
      .mockResolvedValueOnce([{ user_id: 'old-user' }, { user_id: null }]);
    await call('assign', transaction, {
      id: 'assignment',
      todo_id: 'todo',
      user_id: 'new-user',
    });
    expect(transaction.mutate.todo_assignment.insert).toHaveBeenCalled();
    expect(transaction.mutate.todo_activity.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'assigned', subject_user_id: 'new-user' })
    );
  });

  it('unassigns optimistically, rejects missing server assignments, and authorizes existing ones', async () => {
    const client = tx('client');
    await call('unassign', client, { id: 'assignment' });
    expect(client.mutate.todo_assignment.delete).toHaveBeenCalled();

    const missing = tx();
    missing.run.mockResolvedValueOnce(undefined);
    await expect(call('unassign', missing, { id: 'missing' })).rejects.toThrow(
      'Todo assignment not found'
    );

    const existing = tx();
    existing.run
      .mockResolvedValueOnce({ todo_id: 'todo', user_id: 'removed-user' })
      .mockResolvedValueOnce({ creator_id: 'actor', group_id: null, id: 'todo' })
      .mockResolvedValueOnce([{ user_id: 'removed-user' }, { user_id: 'kept-user' }]);
    await call('unassign', existing, { id: 'assignment' });
    expect(h.requireOwner).toHaveBeenCalled();
    expect(existing.mutate.todo_activity.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'unassigned',
        changes: [
          {
            field: 'assignees',
            from: ['kept-user', 'removed-user'],
            to: ['kept-user'],
          },
        ],
      })
    );
  });

  it('rejects missing completion targets and toggles client completion both ways', async () => {
    const missing = tx();
    missing.run.mockResolvedValueOnce(undefined);
    await expect(call('toggleComplete', missing, { id: 'missing' })).rejects.toThrow(
      'Todo not found'
    );

    const completing = tx('client');
    completing.run.mockResolvedValueOnce({ id: 'todo', status: 'pending' });
    await call('toggleComplete', completing, { id: 'todo' });
    expect(completing.mutate.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({ completed_at: expect.any(Number), status: 'completed' })
    );

    const reopening = tx('client');
    reopening.run.mockResolvedValueOnce({ id: 'todo', status: 'completed' });
    await call('toggleComplete', reopening, { id: 'todo' });
    expect(reopening.mutate.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({ completed_at: 0, status: 'open' })
    );
  });

  it('authorizes group, creator, and assigned-user completion', async () => {
    const grouped = tx();
    grouped.run.mockResolvedValueOnce({ group_id: 'group', id: 'todo', status: 'pending' });
    await call('toggleComplete', grouped, { id: 'todo' });
    expect(h.can).toHaveBeenCalled();

    const creator = tx();
    creator.run.mockResolvedValueOnce({
      creator_id: 'actor',
      group_id: null,
      id: 'todo',
      status: 'pending',
    });
    await call('toggleComplete', creator, { id: 'todo' });

    const assigned = tx();
    assigned.run
      .mockResolvedValueOnce({
        creator_id: 'creator',
        group_id: null,
        id: 'todo',
        status: 'pending',
      })
      .mockResolvedValueOnce({ id: 'assignment' });
    await call('toggleComplete', assigned, { id: 'todo' });
    expect(h.requireAuthenticated).toHaveBeenCalled();
  });

  it('rejects unassigned users completing standalone todos', async () => {
    const transaction = tx();
    transaction.run
      .mockResolvedValueOnce({
        creator_id: 'creator',
        group_id: null,
        id: 'todo',
        status: 'pending',
      })
      .mockResolvedValueOnce(undefined);
    await expect(call('toggleComplete', transaction, { id: 'todo' })).rejects.toBeInstanceOf(
      PermissionError
    );
  });
});
