/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTodoTimelineCardController } from '../useTodoTimelineCardController';

const mocks = vi.hoisted(() => ({
  assignUser: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updateTodo: vi.fn(),
  waitForClientApply: vi.fn(),
}));

let authUser: { id?: string; email?: string | null } | null;
let assignments: any;
let mutationLoading = false;

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock('@/features/todos/hooks/useTodoMutations', () => ({
  useTodoMutations: () => ({ updateTodo: mocks.updateTodo, isLoading: mutationLoading }),
}));
vi.mock('@/zero/todos/useTodoActions', () => ({
  useTodoActions: () => ({ assignUser: mocks.assignUser }),
}));
vi.mock('@/zero/todos/useTodoState', () => ({
  useTodoState: () => ({ assignments }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 9, 12));
  authUser = { id: 'user-1', email: 'person@example.test' };
  assignments = [];
  mutationLoading = false;
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.assignUser.mockReturnValue({ client: Promise.resolve() });
  mocks.waitForClientApply.mockResolvedValue(undefined);
  mocks.updateTodo.mockResolvedValue(undefined);
  vi.stubGlobal('crypto', { randomUUID: () => 'assignment-1' });
});

afterEach(() => vi.useRealTimers());

function todo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'todo-1',
    title: 'Todo',
    creatorId: 'creator-1',
    visibility: 'public',
    ...overrides,
  } as any;
}

describe('useTodoTimelineCardController', () => {
  it.each([
    ['overdue', new Date(2026, 7, 8, 10)],
    ['today', new Date(2026, 7, 9, 18)],
    ['soon', new Date(2026, 7, 11, 18)],
    ['week', new Date(2026, 7, 14, 18)],
    ['later', new Date(2026, 7, 20, 23, 59, 59, 999)],
  ])('derives %s urgency', (_label, dueDate) => {
    const { result } = renderHook(() =>
      useTodoTimelineCardController({ todo: todo({ dueDate }), linkToDetail: true })
    );
    expect(result.current.urgency).not.toBeNull();
    expect(result.current.detailHref).toBe('/todos/todo-1');
  });

  it('omits the time suffix for an end-of-day deadline', () => {
    const { result } = renderHook(() =>
      useTodoTimelineCardController({
        todo: todo({ dueDate: new Date(2026, 7, 20, 23, 59, 59, 999) }),
        linkToDetail: true,
      })
    );

    expect(result.current.urgency?.label).not.toContain(' · ');
  });

  it('derives progress, assignment, status, loading, and link fallbacks', () => {
    assignments = [{ user: { id: 'user-1' } }, { user: null }];
    mutationLoading = true;
    let hook = renderHook(() =>
      useTodoTimelineCardController({
        todo: todo({ currentValue: 2, targetValue: 4, isCompleted: true }),
        linkToDetail: false,
      })
    );
    expect(hook.result.current).toMatchObject({
      progress: 50,
      assignmentsCount: 2,
      isAssignedToMe: true,
      currentStatus: 'completed',
      detailHref: undefined,
      isStatusUpdating: true,
      urgency: null,
    });
    hook.unmount();

    assignments = null;
    authUser = null;
    hook = renderHook(() =>
      useTodoTimelineCardController({
        todo: todo({ progress: 0, currentValue: 0, targetValue: 0, isCompleted: false }),
        linkToDetail: true,
      })
    );
    expect(hook.result.current).toMatchObject({
      progress: 0,
      assignmentsCount: 0,
      isAssignedToMe: false,
      currentStatus: 'pending',
    });
  });

  it('updates status with sender fallbacks and closes the selector', async () => {
    const hook = renderHook(() =>
      useTodoTimelineCardController({ todo: todo({ status: 'pending' }), linkToDetail: true })
    );
    act(() => hook.result.current.setStatusOpen(true));
    await act(async () => hook.result.current.handleStatusUpdate('completed'));
    expect(mocks.updateTodo).toHaveBeenCalledWith(
      'todo-1',
      { status: 'completed' },
      expect.objectContaining({ senderId: 'user-1', senderName: 'person' })
    );
    expect(hook.result.current.statusOpen).toBe(false);

    authUser = { id: 'user-2', email: null };
    const fallback = renderHook(() =>
      useTodoTimelineCardController({ todo: todo(), linkToDetail: true })
    );
    await act(async () => fallback.result.current.handleStatusUpdate('in_progress'));
    expect(mocks.updateTodo).toHaveBeenLastCalledWith(
      'todo-1',
      { status: 'in_progress' },
      expect.objectContaining({ senderName: 'features.messages.fallbacks.someone' })
    );

    const archived = renderHook(() =>
      useTodoTimelineCardController({ todo: todo({ archived: true }), linkToDetail: true })
    );
    await act(async () => archived.result.current.handleStatusUpdate('completed'));
    expect(mocks.updateTodo).toHaveBeenCalledTimes(2);
  });

  it('handles assignment guards, success, and normalized failure cleanup', async () => {
    const archived = renderHook(() =>
      useTodoTimelineCardController({ todo: todo({ archived: true }), linkToDetail: true })
    );
    await act(async () => archived.result.current.handleAssignToMe());
    expect(mocks.assignUser).not.toHaveBeenCalled();
    archived.unmount();

    authUser = null;
    const anonymous = renderHook(() =>
      useTodoTimelineCardController({ todo: todo(), linkToDetail: true })
    );
    await act(async () => anonymous.result.current.handleAssignToMe());
    expect(mocks.toastError).toHaveBeenCalledWith('features.todos.kanban.updateFailed');
    anonymous.unmount();

    authUser = { id: 'user-1', email: 'person@example.test' };
    assignments = [{ user: { id: 'user-1' } }];
    const assigned = renderHook(() =>
      useTodoTimelineCardController({ todo: todo(), linkToDetail: true })
    );
    await act(async () => assigned.result.current.handleAssignToMe());
    expect(mocks.toastSuccess).toHaveBeenCalledWith('features.todos.assignee.assignedToMe');
    assigned.unmount();

    assignments = [];
    const success = renderHook(() =>
      useTodoTimelineCardController({ todo: todo(), linkToDetail: true })
    );
    await act(async () => success.result.current.handleAssignToMe());
    expect(mocks.assignUser).toHaveBeenCalledWith({
      id: 'assignment-1',
      todo_id: 'todo-1',
      user_id: 'user-1',
      role: 'assignee',
    });
    expect(success.result.current.assigning).toBe(false);

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => success.result.current.handleAssignToMe());
    expect(errorSpy).toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('features.todos.kanban.updateFailed');
    expect(success.result.current.assigning).toBe(false);
  });
});
