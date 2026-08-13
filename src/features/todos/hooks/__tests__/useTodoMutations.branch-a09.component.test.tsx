/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  todo: {
    createFullTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
  },
  common: { createTimelineEvent: vi.fn() },
  wait: vi.fn(async (value: unknown) => value),
  confirmed: vi.fn(async (value: unknown) => value),
}));

vi.mock('@/zero/todos/useTodoActions', () => ({ useTodoActions: () => mocks.todo }));
vi.mock('@/zero/common', () => ({ useCommonActions: () => mocks.common }));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => mocks.wait(value),
  serverConfirmed: (value: unknown) => mocks.confirmed(value),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

import { useTodoMutations } from '../useTodoMutations';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.todo.createFullTodo.mockReturnValue({
    client: Promise.resolve(),
    server: Promise.resolve(),
  });
  mocks.todo.updateTodo.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
  mocks.todo.deleteTodo.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
  mocks.common.createTimelineEvent.mockReturnValue({
    client: Promise.resolve(),
    server: Promise.resolve(),
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
    .mockReturnValue('00000000-0000-4000-8000-000000000003');
});

describe('useTodoMutations branch contract', () => {
  it('creates a minimal private todo through all defaults', async () => {
    const { result } = renderHook(() => useTodoMutations());
    let outcome: any;
    await act(async () => {
      outcome = await result.current.createTodo({ title: 'Task', ownerId: 'owner' });
    });

    expect(outcome).toMatchObject({
      success: true,
      todoId: '00000000-0000-4000-8000-000000000001',
      payload: {
        todo: {
          description: '',
          status: 'open',
          priority: 'medium',
          due_date: null,
          completed_at: null,
          tags: [],
          visibility: 'private',
          group_id: null,
          event_id: null,
          amendment_id: null,
        },
        assignment: null,
        timeline_event: null,
      },
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('creates a fully linked completed public todo with assignment and timeline', async () => {
    const { result } = renderHook(() => useTodoMutations());
    const options = { notificationMode: 'silent' } as any;
    let outcome: any;
    await act(async () => {
      outcome = await result.current.createTodo(
        {
          id: 'todo-explicit',
          title: 'Public task',
          description: 'Description'.repeat(20),
          ownerId: 'owner',
          assigneeId: 'assignee',
          status: 'completed',
          priority: 'urgent',
          dueDate: 123,
          tags: ['one'],
          visibility: 'public',
          groupId: 'group',
          eventId: 'event',
          amendmentId: 'amendment',
        },
        options
      );
    });

    expect(outcome.payload).toEqual(
      expect.objectContaining({
        assignment: expect.objectContaining({ user_id: 'assignee' }),
        timeline_event: expect.objectContaining({
          entity_id: 'todo-explicit',
          group_id: 'group',
          event_id: 'event',
          amendment_id: 'amendment',
        }),
      })
    );
    expect(outcome.payload.todo.completed_at).toBeTypeOf('number');
    expect(mocks.todo.createFullTodo).toHaveBeenCalledWith(expect.any(Object), options);
  });

  it('uses empty public timeline fallbacks and reports create failures', async () => {
    const { result } = renderHook(() => useTodoMutations());
    await act(async () => {
      const outcome = await result.current.createTodo({
        title: 'Public',
        ownerId: 'owner',
        visibility: 'public',
      });
      expect(outcome.success).toBe(true);
      expect((outcome as any).payload.timeline_event).toMatchObject({
        description: '',
        group_id: '',
        event_id: '',
        amendment_id: '',
      });
    });

    mocks.todo.createFullTodo.mockImplementationOnce(() => {
      throw new Error('create failed');
    });
    await act(async () => {
      await expect(
        result.current.createTodo({ title: 'Fail', ownerId: 'owner' })
      ).resolves.toMatchObject({ success: false, error: expect.any(Error) });
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('updates without a timeline and confirms client and server application', async () => {
    const { result } = renderHook(() => useTodoMutations());
    await act(async () => {
      await expect(result.current.updateTodo('todo', { title: 'Updated' })).resolves.toEqual({
        success: true,
      });
    });
    expect(mocks.wait).toHaveBeenCalled();
    expect(mocks.confirmed).toHaveBeenCalled();
    expect(mocks.common.createTimelineEvent).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: 'open' }, { visibility: 'public', senderId: 'sender' }],
    [{ status: 'completed' }, { visibility: 'private', senderId: 'sender' }],
    [{ status: 'completed' }, { visibility: 'public' }],
  ])('does not publish completion timeline for incomplete conditions', async (updates, options) => {
    const { result } = renderHook(() => useTodoMutations());
    await act(async () => {
      await result.current.updateTodo('todo', updates as any, options as any);
    });
    expect(mocks.common.createTimelineEvent).not.toHaveBeenCalled();
  });

  it('publishes completed public todos with explicit and fallback titles', async () => {
    const { result } = renderHook(() => useTodoMutations());
    await act(async () => {
      await result.current.updateTodo(
        'todo',
        { status: 'completed' },
        { visibility: 'public', senderId: 'sender', todoTitle: 'Named task' }
      );
      await result.current.updateTodo(
        'todo-2',
        { status: 'completed' },
        { visibility: 'public', senderId: 'sender' }
      );
    });
    expect(mocks.common.createTimelineEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: expect.stringContaining('Named task') })
    );
    expect(mocks.common.createTimelineEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: expect.stringContaining('Task') })
    );
  });

  it('reports update and delete failures while restoring loading state', async () => {
    const { result } = renderHook(() => useTodoMutations());
    mocks.todo.updateTodo.mockImplementationOnce(() => {
      throw new Error('update failed');
    });
    await act(async () => {
      await expect(result.current.updateTodo('todo', {})).resolves.toMatchObject({
        success: false,
      });
    });

    mocks.wait.mockRejectedValueOnce(new Error('delete failed'));
    await act(async () => {
      await expect(
        result.current.deleteTodo('todo', { senderId: 'ignored' })
      ).resolves.toMatchObject({ success: false });
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('deletes successfully without optional parameters', async () => {
    const { result } = renderHook(() => useTodoMutations());
    await act(async () => {
      await expect(result.current.deleteTodo('todo')).resolves.toEqual({ success: true });
    });
    expect(mocks.todo.deleteTodo).toHaveBeenCalledWith('todo');
  });
});
