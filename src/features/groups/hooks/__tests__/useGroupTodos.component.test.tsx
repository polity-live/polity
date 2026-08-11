/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  todos: [] as any[],
  archived: [] as any[],
  querying: false,
  wait: vi.fn(async (v: any) => v),
  actions: {
    createTodo: vi.fn((x: any) => x),
    updateTodo: vi.fn((x: any) => x),
    deleteTodo: vi.fn((x: any) => x),
    assignUser: vi.fn((x: any) => x),
  },
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupTodos: () => ({
    todos: mocks.todos,
    archivedTodos: mocks.archived,
    isLoading: mocks.querying,
  }),
}));
vi.mock('@/zero/todos/useTodoActions', () => ({ useTodoActions: () => mocks.actions }));
vi.mock('@/zero/mutate-with-server-check', () => ({ waitForClientApply: mocks.wait }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/shared/logic/localDateTime', () => ({ toLocalDeadlineTimestamp: () => 123 }));

import { useGroupTodos } from '../useGroupTodos';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.todos = [{ id: 'active' }];
  mocks.archived = [{ id: 'archived' }];
  mocks.querying = false;
  mocks.wait.mockImplementation(async v => v);
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid' as any);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useGroupTodos', () => {
  it('requires authentication and merges active/archived loading state', async () => {
    mocks.querying = true;
    const { result } = renderHook(() => useGroupTodos('g'));
    expect(result.current.todos).toHaveLength(2);
    expect(result.current.isLoading).toBe(true);
    await expect(
      result.current.addTodo({
        title: 'T',
        description: '',
        priority: 'high',
        dueDate: '',
        dueTime: '',
      })
    ).resolves.toEqual({ success: false });
  });

  it('adds, updates both completion states, toggles both ways, and deletes', async () => {
    const { result } = renderHook(() => useGroupTodos('g', 'u'));
    await expect(
      result.current.addTodo({
        title: 'T',
        description: 'D',
        priority: 'high',
        dueDate: 'd',
        dueTime: 't',
      })
    ).resolves.toMatchObject({ success: true, todoId: 'uuid' });
    await expect(result.current.updateTodoStatus('t', 'completed')).resolves.toMatchObject({
      success: true,
    });
    expect(mocks.actions.updateTodo).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed_at: expect.any(Number) })
    );
    await result.current.updateTodoStatus('t', 'pending');
    expect(mocks.actions.updateTodo).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed_at: undefined })
    );
    await result.current.toggleTodoComplete({ id: 't', status: 'completed' });
    await result.current.toggleTodoComplete({ id: 't', status: null });
    await expect(result.current.deleteTodo('t')).resolves.toMatchObject({ success: true });
  });

  it('returns failures for add, update, and delete catches', async () => {
    const { result } = renderHook(() => useGroupTodos('g', 'u'));
    const calls = [
      () =>
        result.current.addTodo({
          title: 'T',
          description: '',
          priority: '',
          dueDate: '',
          dueTime: '',
        }),
      () => result.current.updateTodoStatus('t', 'pending'),
      () => result.current.deleteTodo('t'),
    ];
    for (const call of calls) {
      mocks.wait.mockRejectedValueOnce(new Error('failed'));
      await expect(call()).resolves.toMatchObject({ success: false });
    }
  });
});
