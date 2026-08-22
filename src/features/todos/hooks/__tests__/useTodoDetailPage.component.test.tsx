/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTodoDetailPage } from '../useTodoDetailPage';

const mocks = vi.hoisted(() => ({
  state: { todo: undefined as any, assignments: undefined as any },
  user: undefined as any,
  canManage: vi.fn(),
  updateTodo: vi.fn(),
  archiveTodo: vi.fn(),
  unarchiveTodo: vi.fn(),
  checkAccess: vi.fn(() => true),
  deadlineToForm: vi.fn((value: unknown) => ({
    dueDate: value ? '2026-08-09' : '',
    dueTime: value ? '12:00' : '',
  })),
  resolveDeadline: vi.fn(() => 123),
  discussion: { comments: [] },
  waitForApply: vi.fn((promise: Promise<unknown>) => promise),
  report: vi.fn(),
}));

vi.mock('@/zero/todos/useTodoState', () => ({
  useTodoState: () => mocks.state,
}));
vi.mock('../useTodoMutations', () => ({
  useTodoMutations: () => ({ updateTodo: mocks.updateTodo }),
}));
vi.mock('@/zero/todos/useTodoActions', () => ({
  useTodoActions: () => ({
    archiveTodo: mocks.archiveTodo,
    unarchiveTodo: mocks.unarchiveTodo,
  }),
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock('@/features/auth/logic/checkEntityAccess', () => ({
  checkEntityAccess: mocks.checkAccess,
}));
vi.mock('@/features/todos/utils/todoFormatters', () => ({
  todoDeadlineToFormValues: mocks.deadlineToForm,
  resolveTodoDeadlineTimestamp: mocks.resolveDeadline,
}));
vi.mock('../useTodoDiscussion', () => ({
  useTodoDiscussion: () => mocks.discussion,
}));
vi.mock('../useTodoActivity', () => ({
  useTodoActivity: () => ({
    activities: [],
    canViewActivity: false,
    isLoading: false,
    severity: 'all',
    setSeverity: vi.fn(),
  }),
}));
vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ canManage: mocks.canManage }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForApply,
}));
vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: mocks.report,
}));

function todo(overrides: Record<string, any> = {}) {
  return {
    id: 'todo-1',
    title: 'Todo',
    description: 'Description',
    status: 'pending',
    priority: 'medium',
    due_date: null,
    visibility: 'private',
    creator_id: 'creator',
    group_id: null,
    tutorial_run_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.state.todo = undefined;
  mocks.state.assignments = undefined;
  mocks.user = undefined;
  mocks.canManage.mockReset();
  mocks.updateTodo.mockReset();
  mocks.archiveTodo.mockReset().mockReturnValue(Promise.resolve());
  mocks.unarchiveTodo.mockReset().mockReturnValue(Promise.resolve());
  mocks.checkAccess.mockReset().mockReturnValue(true);
  mocks.deadlineToForm.mockClear();
  mocks.resolveDeadline.mockReset().mockReturnValue(123);
  mocks.waitForApply.mockClear();
  mocks.report.mockClear();
});

describe('useTodoDetailPage', () => {
  it('exposes safe defaults and no-op actions while the todo is unavailable', async () => {
    const { result } = renderHook(() => useTodoDetailPage('missing'));

    expect(result.current.todo).toBeUndefined();
    expect(result.current.formData).toEqual({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      dueDate: '',
      dueTime: '',
    });
    expect(result.current.canManageTodos).toBe(false);
    expect(mocks.checkAccess).toHaveBeenCalledWith(undefined, false, false);

    await act(async () => result.current.handleSave());
    act(() => result.current.handleCancel());
    await act(async () => result.current.handleArchive());
    await act(async () => result.current.handleUnarchive());
    expect(mocks.updateTodo).not.toHaveBeenCalled();
    expect(mocks.archiveTodo).not.toHaveBeenCalled();
    expect(mocks.unarchiveTodo).not.toHaveBeenCalled();
  });

  it('completes a personal tutorial todo and updates title/form state', async () => {
    mocks.state.todo = todo({
      title: null,
      description: null,
      status: null,
      priority: null,
      due_date: 10,
      tutorial_run_id: 'tutorial',
    });
    mocks.state.assignments = [];
    mocks.user = { id: 'creator' };
    mocks.updateTodo.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useTodoDetailPage('todo-1'));

    expect(result.current.canManageTodos).toBe(true);
    expect(result.current.canAccess).toBe(true);
    expect(result.current.formData).toMatchObject({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      dueDate: '2026-08-09',
    });
    act(() => result.current.handleCancel());

    act(() => {
      result.current.setIsEditing(true);
      result.current.handleTitleChange('Completed title');
      result.current.handleFormUpdate({ status: 'completed', priority: 'high' });
    });
    await act(async () => result.current.handleSave());

    expect(mocks.resolveDeadline).toHaveBeenCalledWith(10, '2026-08-09', '12:00');
    expect(mocks.updateTodo).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({
        title: 'Completed title',
        status: 'completed',
        priority: 'high',
        completed_at: expect.any(Number),
      })
    );
    expect(mocks.report).toHaveBeenCalledWith({ type: 'mutation', event: 'todo.completed' });
    expect(result.current.isEditing).toBe(false);
    expect(result.current.isSaving).toBe(false);

    await act(async () => result.current.handleArchive());
    expect(mocks.archiveTodo).not.toHaveBeenCalled();
    await act(async () => result.current.handleUnarchive());
    expect(mocks.unarchiveTodo).toHaveBeenCalledWith('todo-1');
  });

  it('moves a completed group todo back to in-progress and archives it', async () => {
    mocks.state.todo = todo({
      status: 'completed',
      group_id: 'group-1',
      tutorial_run_id: 'tutorial',
    });
    mocks.state.assignments = [{ user_id: 'member' }];
    mocks.user = { id: 'member' };
    mocks.canManage.mockReturnValue(true);
    mocks.updateTodo.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useTodoDetailPage('todo-1'));

    expect(mocks.canManage).toHaveBeenCalledWith('groupTodos');
    expect(result.current.canManageTodos).toBe(true);
    act(() => result.current.handleFormUpdate({ status: 'in_progress' }));
    await act(async () => result.current.handleSave());
    expect(mocks.updateTodo).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ status: 'in_progress', completed_at: null })
    );
    expect(mocks.report).toHaveBeenCalledWith({ type: 'mutation', event: 'todo.in-progress' });

    await act(async () => result.current.handleArchive());
    expect(mocks.archiveTodo).toHaveBeenCalledWith('todo-1');
    expect(result.current.isArchiving).toBe(false);
  });

  it('keeps editing after a failed save, restores source values on cancel, and enforces guards', async () => {
    mocks.state.todo = todo({ status: 'pending', priority: 'low' });
    mocks.state.assignments = [{ user_id: 'other' }];
    mocks.user = { id: 'viewer' };
    mocks.canManage.mockReturnValue(false);
    mocks.updateTodo.mockResolvedValue({ success: false });
    const { result } = renderHook(() => useTodoDetailPage('todo-1'));

    expect(result.current.canManageTodos).toBe(false);
    act(() => {
      result.current.setIsEditing(true);
      result.current.handleFormUpdate({ title: 'Changed', status: 'pending' });
    });
    await act(async () => result.current.handleSave());
    expect(result.current.isEditing).toBe(true);
    expect(mocks.updateTodo.mock.calls[0]?.[1]).not.toHaveProperty('completed_at');

    act(() => result.current.handleCancel());
    expect(result.current.formData).toMatchObject({ title: 'Todo', priority: 'low' });
    expect(result.current.isEditing).toBe(false);

    await act(async () => result.current.handleArchive());
    await act(async () => result.current.handleUnarchive());
    expect(mocks.archiveTodo).not.toHaveBeenCalled();
    expect(mocks.unarchiveTodo).not.toHaveBeenCalled();
  });

  it('always clears archiving state when an archive action rejects', async () => {
    mocks.state.todo = todo({ status: 'completed' });
    mocks.user = { id: 'creator' };
    mocks.archiveTodo.mockReturnValue(Promise.reject(new Error('archive failed')));
    const { result } = renderHook(() => useTodoDetailPage('todo-1'));

    await expect(act(async () => result.current.handleArchive())).rejects.toThrow('archive failed');
    expect(result.current.isArchiving).toBe(false);
  });
});
