import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';

const canMock = vi.fn();

vi.mock('../../rbac/can', () => ({
  can: (...args: unknown[]) => canMock(...args),
}));

import { todoSharedMutators } from '../shared-mutators';

type TodoMutatorInput = Parameters<typeof todoSharedMutators.create.fn>[0];
type TodoMutatorTx = TodoMutatorInput['tx'];
type TodoMutatorCtx = TodoMutatorInput['ctx'];

function createTx(location: TodoMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      todo: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      todo_assignment: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function createCtx(): TodoMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

beforeEach(() => {
  canMock.mockReset();
});

describe('todoSharedMutators group RBAC', () => {
  it('rejects group todo creation without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupTodos', 'group:group-1');
    canMock.mockRejectedValueOnce(error);

    await expect(
      todoSharedMutators.create.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'todo-1',
          title: 'Todo One',
          description: '',
          status: 'pending',
          priority: 'medium',
          due_date: 0,
          completed_at: 0,
          tags: [],
          visibility: 'group',
          group_id: 'group-1',
          event_id: null,
          amendment_id: null,
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.todo.insert).not.toHaveBeenCalled();
  });

  it('rejects group todo updates without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupTodos', 'group:group-1');
    tx.run.mockResolvedValue({
      id: 'todo-1',
      group_id: 'group-1',
    });
    canMock.mockRejectedValueOnce(error);

    await expect(
      todoSharedMutators.update.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'todo-1',
          status: 'completed',
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.todo.update).not.toHaveBeenCalled();
  });

  it('rejects group todo assignment changes without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupTodos', 'group:group-1');
    tx.run.mockResolvedValue({
      id: 'todo-1',
      group_id: 'group-1',
    });
    canMock.mockRejectedValueOnce(error);

    await expect(
      todoSharedMutators.assign.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'assignment-1',
          todo_id: 'todo-1',
          user_id: 'user-2',
          role: 'assignee',
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.todo_assignment.insert).not.toHaveBeenCalled();
  });

  it('rejects group todo unassignment without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupTodos', 'group:group-1');
    tx.run
      .mockResolvedValueOnce({
        id: 'assignment-1',
        todo_id: 'todo-1',
      })
      .mockResolvedValueOnce({
        id: 'todo-1',
        group_id: 'group-1',
      });
    canMock.mockRejectedValueOnce(error);

    await expect(
      todoSharedMutators.unassign.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'assignment-1',
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.todo_assignment.delete).not.toHaveBeenCalled();
  });

  it('rejects group todo completion toggles without manage rights', async () => {
    const tx = createTx('server');
    const error = new PermissionError('manage', 'groupTodos', 'group:group-1');
    tx.run.mockResolvedValue({
      id: 'todo-1',
      group_id: 'group-1',
      status: 'pending',
    });
    canMock.mockRejectedValueOnce(error);

    await expect(
      todoSharedMutators.toggleComplete.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: {
          id: 'todo-1',
        },
      })
    ).rejects.toBe(error);

    expect(tx.mutate.todo.update).not.toHaveBeenCalled();
  });
});
