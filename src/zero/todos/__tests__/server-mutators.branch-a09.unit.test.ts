import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  fire: vi.fn(),
  groupName: vi.fn(async () => 'Group name'),
  userName: vi.fn(async () => 'User name'),
  shared: {
    archive: { fn: vi.fn() },
    assign: { fn: vi.fn() },
    create: { fn: vi.fn() },
    delete: { fn: vi.fn() },
    toggleComplete: { fn: vi.fn() },
    unarchive: { fn: vi.fn() },
    update: { fn: vi.fn() },
  },
}));

vi.mock('@rocicorp/zero', () => ({
  defineMutator: (_schema: unknown, fn: (...args: any[]) => unknown) => ({ fn }),
}));
vi.mock('../../mutators', () => ({ mutators: { todos: h.shared } }));
vi.mock('../../server-notify', () => ({ fireNotification: h.fire }));
vi.mock('../../server-helpers', () => ({ groupName: h.groupName, userName: h.userName }));
vi.mock('../../schema', () => ({
  zql: {
    todo: { where: () => ({ one: () => ({ query: 'todo' }) }) },
    todo_assignment: { where: () => ({ query: 'assignments' }) },
  },
}));
vi.mock('../schema', () => ({
  archiveTodoSchema: {},
  createTodoAssignmentSchema: {},
  createTodoFullMutatorSchema: {},
  createTodoSchema: {},
  deleteTodoSchema: {},
  toggleCompleteTodoSchema: {},
  unarchiveTodoSchema: {},
  updateTodoSchema: {},
}));

import { todoServerMutators } from '../server-mutators';

const ctx = { userID: 'actor' } as any;

function tx() {
  return {
    mutate: { timeline_event: { insert: vi.fn() } },
    run: vi.fn(),
  } as any;
}

async function call(name: keyof typeof todoServerMutators, transaction: any, args: any) {
  return todoServerMutators[name].fn({ args, ctx, tx: transaction } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('todo server mutators', () => {
  it('delegates create, archive and unarchive', async () => {
    const transaction = tx();
    await call('create', transaction, { id: 'todo' });
    await call('archive', transaction, { id: 'todo' });
    await call('unarchive', transaction, { id: 'todo' });
    expect(h.shared.create.fn).toHaveBeenCalledOnce();
    expect(h.shared.archive.fn).toHaveBeenCalledOnce();
    expect(h.shared.unarchive.fn).toHaveBeenCalledOnce();
  });

  it('creates full todos with and without optional records', async () => {
    const transaction = tx();
    await call('createFull', transaction, {
      assignment: { id: 'assignment', todo_id: 'todo', user_id: 'other' },
      timeline_event: { id: 'event' },
      todo: { id: 'todo' },
    });
    expect(transaction.mutate.timeline_event.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'event', created_at: expect.any(Number) })
    );
    await call('createFull', transaction, { todo: { id: 'second' } });
    expect(transaction.mutate.timeline_event.insert).toHaveBeenCalledOnce();
  });

  it('returns after updating a missing todo', async () => {
    const transaction = tx();
    transaction.run.mockResolvedValueOnce(undefined);
    await call('update', transaction, { id: 'todo' });
    expect(h.fire).not.toHaveBeenCalled();
  });

  it('notifies group assignees and the creator after completion', async () => {
    const transaction = tx();
    transaction.run
      .mockResolvedValueOnce({
        creator_id: 'creator',
        group_id: 'group',
        id: 'todo',
        status: 'pending',
        title: 'Old title',
      })
      .mockResolvedValueOnce([{ user_id: null }, { user_id: 'actor' }, { user_id: 'assignee' }]);
    await call('update', transaction, { id: 'todo', status: 'completed', title: 'New title' });
    expect(h.fire).toHaveBeenCalledWith(
      'notifyTodoUpdated',
      expect.objectContaining({ recipientUserId: 'assignee', todoTitle: 'New title' })
    );
    expect(h.fire).toHaveBeenCalledWith(
      'notifyTodoCompleted',
      expect.objectContaining({ recipientUserId: 'creator' })
    );
  });

  it('covers update title fallbacks and notification guards', async () => {
    const oldTitle = tx();
    oldTitle.run
      .mockResolvedValueOnce({
        creator_id: 'actor',
        group_id: null,
        id: 'todo',
        status: 'completed',
        title: 'Existing',
      })
      .mockResolvedValueOnce([{ user_id: 'other' }]);
    await call('update', oldTitle, { id: 'todo', status: 'completed' });

    const defaultTitle = tx();
    defaultTitle.run
      .mockResolvedValueOnce({
        creator_id: 'actor',
        group_id: 'group',
        id: 'todo',
        status: 'pending',
        title: null,
      })
      .mockResolvedValueOnce([]);
    await call('update', defaultTitle, { id: 'todo', status: 'open' });
    expect(h.fire).not.toHaveBeenCalled();
  });

  it('returns when deleting missing todos or todos without other assignees', async () => {
    const missing = tx();
    missing.run.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]);
    await call('delete', missing, { id: 'todo' });

    const unassigned = tx();
    unassigned.run
      .mockResolvedValueOnce({ id: 'todo', title: 'Title' })
      .mockResolvedValueOnce([{ user_id: null }, { user_id: 'actor' }]);
    await call('delete', unassigned, { id: 'todo' });
    expect(h.fire).not.toHaveBeenCalled();
  });

  it('notifies group and standalone assignees when deleting', async () => {
    const grouped = tx();
    grouped.run
      .mockResolvedValueOnce({ group_id: 'group', id: 'todo', title: null })
      .mockResolvedValueOnce([{ user_id: 'assignee' }]);
    await call('delete', grouped, { id: 'todo' });
    expect(h.fire).toHaveBeenCalledWith(
      'notifyTodoDeleted',
      expect.objectContaining({ recipientUserId: 'assignee', todoTitle: 'Task' })
    );

    const standalone = tx();
    standalone.run
      .mockResolvedValueOnce({ group_id: null, id: 'todo', title: 'Standalone' })
      .mockResolvedValueOnce([{ user_id: 'assignee' }]);
    await call('delete', standalone, { id: 'todo' });
    expect(h.fire).toHaveBeenCalledWith(
      'notifyStandaloneTodoDeleted',
      expect.objectContaining({ todoTitle: 'Standalone' })
    );
  });

  it('handles missing, claimed, group and standalone assignments', async () => {
    const missing = tx();
    missing.run.mockResolvedValueOnce(undefined);
    await call('assign', missing, { todo_id: 'todo', user_id: 'other' });

    const claimed = tx();
    claimed.run.mockResolvedValueOnce({ creator_id: 'creator', id: 'todo', title: null });
    await call('assign', claimed, { todo_id: 'todo', user_id: 'actor' });
    expect(h.fire).toHaveBeenCalledWith(
      'notifyTodoClaimed',
      expect.objectContaining({ recipientUserId: 'creator', todoTitle: 'Task' })
    );

    const selfCreated = tx();
    selfCreated.run.mockResolvedValueOnce({ creator_id: 'actor', id: 'todo', title: 'Self' });
    await call('assign', selfCreated, { todo_id: 'todo', user_id: 'actor' });

    const creatorMissing = tx();
    creatorMissing.run.mockResolvedValueOnce({ creator_id: null, id: 'todo', title: 'No creator' });
    await call('assign', creatorMissing, { todo_id: 'todo', user_id: 'actor' });

    const grouped = tx();
    grouped.run.mockResolvedValueOnce({ group_id: 'group', id: 'todo', title: 'Group todo' });
    await call('assign', grouped, { todo_id: 'todo', user_id: 'other' });
    expect(h.fire).toHaveBeenCalledWith('notifyTodoAssigned', expect.anything());

    const standalone = tx();
    standalone.run.mockResolvedValueOnce({ group_id: null, id: 'todo', title: 'Solo' });
    await call('assign', standalone, { todo_id: 'todo', user_id: 'other' });
    expect(h.fire).toHaveBeenCalledWith('notifyStandaloneTodoAssigned', expect.anything());
  });

  it('returns when toggling a missing todo', async () => {
    const transaction = tx();
    transaction.run.mockResolvedValueOnce(undefined);
    await call('toggleComplete', transaction, { id: 'todo' });
    expect(h.fire).not.toHaveBeenCalled();
  });

  it('notifies group assignees and creator when toggling to complete', async () => {
    const transaction = tx();
    transaction.run
      .mockResolvedValueOnce({
        creator_id: 'creator',
        group_id: 'group',
        id: 'todo',
        status: 'pending',
        title: null,
      })
      .mockResolvedValueOnce([{ user_id: null }, { user_id: 'actor' }, { user_id: 'assignee' }]);
    await call('toggleComplete', transaction, { id: 'todo' });
    expect(h.fire).toHaveBeenCalledWith('notifyTodoUpdated', expect.anything());
    expect(h.fire).toHaveBeenCalledWith('notifyTodoCompleted', expect.anything());
  });

  it('does not notify when reopening a standalone todo created by the actor', async () => {
    const transaction = tx();
    transaction.run
      .mockResolvedValueOnce({
        creator_id: 'actor',
        group_id: null,
        id: 'todo',
        status: 'completed',
        title: 'Title',
      })
      .mockResolvedValueOnce([{ user_id: 'other' }]);
    await call('toggleComplete', transaction, { id: 'todo' });
    expect(h.fire).not.toHaveBeenCalled();
  });
});
