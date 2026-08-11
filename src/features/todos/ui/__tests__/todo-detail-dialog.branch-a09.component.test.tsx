// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TodoDetailDialog } from '../todo-detail-dialog';

const mocks = vi.hoisted(() => ({
  liveTodo: null as any,
  memberships: undefined as any,
  groupStateArgs: [] as any[],
  user: { id: 'current-user' } as any,
  canManage: vi.fn(),
  updateTodo: vi.fn(),
  assignUser: vi.fn(),
  unassignUser: vi.fn(),
  archiveTodo: vi.fn(),
  unarchiveTodo: vi.fn(),
  waitForClientApply: vi.fn(),
  resolveDeadline: vi.fn(),
  deadlineForm: vi.fn(),
  isOverdue: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  discussion: { comments: [] } as any,
  discussionArg: undefined as any,
  viewProps: null as any,
}));

vi.mock('@/zero/todos/useTodoState.ts', () => ({
  useTodoState: () => ({ todo: mocks.liveTodo }),
}));

vi.mock('@/zero/groups/useGroupState.ts', () => ({
  useGroupState: (args: any) => {
    mocks.groupStateArgs.push(args);
    return { membershipsWithUsers: mocks.memberships };
  },
}));

vi.mock('@/zero/todos/useTodoActions.ts', () => ({
  useTodoActions: () => ({
    updateTodo: mocks.updateTodo,
    assignUser: mocks.assignUser,
    unassignUser: mocks.unassignUser,
    archiveTodo: mocks.archiveTodo,
    unarchiveTodo: mocks.unarchiveTodo,
  }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: any) => mocks.waitForClientApply(value),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../utils/todoFormatters', () => ({
  isOverdue: (...args: any[]) => mocks.isOverdue(...args),
  resolveTodoDeadlineTimestamp: (...args: any[]) => mocks.resolveDeadline(...args),
  todoDeadlineToFormValues: (...args: any[]) => mocks.deadlineForm(...args),
}));

vi.mock('../../hooks/useTodoDiscussion', () => ({
  useTodoDiscussion: (todo: any) => {
    mocks.discussionArg = todo;
    return mocks.discussion;
  },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ canManage: mocks.canManage }),
}));

vi.mock('../TodoDetailDialogView', () => ({
  TodoDetailDialogView: (props: any) => {
    mocks.viewProps = props;
    return <div data-testid="todo-detail-dialog-view" />;
  },
}));

function todo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'todo-1',
    title: 'Todo title',
    description: 'Description',
    status: 'pending',
    priority: 'high',
    due_date: 'old-deadline',
    tags: ['tag'],
    visibility: 'public',
    creator_id: 'current-user',
    group_id: null,
    group: null,
    assignments: [{ id: 'assignment-current', user: { id: 'user-current' } }],
    ...overrides,
  } as any;
}

function renderDialog(todoValue = todo(), props: Record<string, unknown> = {}) {
  const onOpenChange = vi.fn();
  const result = render(
    <TodoDetailDialog todo={todoValue} open onOpenChange={onOpenChange} {...props} />
  );
  return { ...result, onOpenChange };
}

describe('TodoDetailDialog branch coverage', () => {
  beforeEach(() => {
    mocks.liveTodo = null;
    mocks.memberships = undefined;
    mocks.groupStateArgs = [];
    mocks.user = { id: 'current-user' };
    mocks.canManage.mockReset().mockReturnValue(false);
    mocks.updateTodo.mockReset().mockReturnValue('update-result');
    mocks.assignUser.mockReset().mockReturnValue('assign-result');
    mocks.unassignUser.mockReset().mockReturnValue('unassign-result');
    mocks.archiveTodo.mockReset().mockReturnValue('archive-result');
    mocks.unarchiveTodo.mockReset().mockReturnValue('unarchive-result');
    mocks.waitForClientApply.mockReset().mockResolvedValue(undefined);
    mocks.resolveDeadline.mockReset().mockReturnValue('resolved-deadline');
    mocks.deadlineForm.mockReset().mockReturnValue({ dueDate: '', dueTime: '' });
    mocks.isOverdue.mockReset().mockReturnValue(false);
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.discussionArg = undefined;
    mocks.viewProps = null;
    vi.stubGlobal('crypto', { randomUUID: () => 'assignment-new' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('derives fallback form data, assignees, ownership, and the no-group query', () => {
    renderDialog(
      todo({
        title: '',
        description: '',
        status: null,
        priority: null,
        due_date: null,
        tags: null,
        visibility: null,
        assignments: [
          { id: 'valid', user: { id: 'kept' } },
          { id: 'missing', user: null },
        ],
      })
    );

    expect(mocks.viewProps.canManageTodos).toBe(true);
    expect(mocks.viewProps.formData).toEqual({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      dueDate: '',
      dueTime: '',
      tags: [],
      visibility: 'private',
    });
    expect(mocks.viewProps.selectedUserIds).toEqual(['kept']);
    expect(mocks.viewProps.members).toEqual([]);
    expect(mocks.groupStateArgs.at(-1)).toEqual({});
    expect(mocks.isOverdue).toHaveBeenCalledWith(undefined, '');
    expect(mocks.discussionArg).toBeNull();
  });

  it('prefers live data and covers explicit, absent-user, group, and creator permissions', () => {
    const initial = todo({ id: 'initial' });
    mocks.liveTodo = todo({ id: 'live', group_id: 'group-1', group: { id: 'group-1' } });
    mocks.canManage.mockReturnValue(true);
    const first = renderDialog(initial, { canManageTodos: false });
    expect(mocks.viewProps.todo.id).toBe('live');
    expect(mocks.viewProps.canManageTodos).toBe(false);
    expect(mocks.groupStateArgs.at(-1)).toEqual({
      groupId: 'group-1',
      includeMembershipsWithUsers: true,
    });
    expect(mocks.discussionArg.id).toBe('live');
    first.unmount();

    renderDialog(initial, { canManageTodos: true }).unmount();
    expect(mocks.viewProps.canManageTodos).toBe(true);

    mocks.liveTodo = null;
    mocks.user = null;
    renderDialog(todo({ creator_id: 'someone-else' })).unmount();
    expect(mocks.viewProps.canManageTodos).toBe(false);

    mocks.user = { id: 'current-user' };
    renderDialog(todo({ creator_id: 'someone-else' })).unmount();
    expect(mocks.viewProps.canManageTodos).toBe(false);

    mocks.canManage.mockReturnValue(true);
    renderDialog(todo({ group_id: 'group-only', group: null })).unmount();
    expect(mocks.viewProps.canManageTodos).toBe(true);
    expect(mocks.canManage).toHaveBeenCalledWith('groupTodos');
  });

  it('filters group members by display name, handle, and email while rejecting invalid users', async () => {
    mocks.memberships = [
      { id: 'invalid-missing-user' },
      { id: 'invalid-missing-id', user: { first_name: 'No', last_name: 'Id' } },
      { id: 'name', user: { id: 'one', first_name: 'Ada', last_name: 'Lovelace' } },
      { id: 'handle', user: { id: 'two', handle: 'gracehopper' } },
      { id: 'email', user: { id: 'three', email: 'linus@example.test' } },
      { id: 'empty', user: { id: 'four', first_name: null, last_name: null } },
    ];
    renderDialog(todo({ group: { id: 'group-1' }, group_id: 'group-1' }));

    expect(mocks.viewProps.filteredMembers).toHaveLength(4);
    await act(async () => mocks.viewProps.setSearchQuery('ada love'));
    expect(mocks.viewProps.filteredMembers.map((item: any) => item.id)).toEqual(['name']);
    await act(async () => mocks.viewProps.setSearchQuery('grace'));
    expect(mocks.viewProps.filteredMembers.map((item: any) => item.id)).toEqual(['handle']);
    await act(async () => mocks.viewProps.setSearchQuery('linus@'));
    expect(mocks.viewProps.filteredMembers.map((item: any) => item.id)).toEqual(['email']);
  });

  it('keeps live updates out of an active draft and resets on cancel or close', async () => {
    const initial = todo({ title: 'Initial' });
    mocks.liveTodo = todo({ title: 'Live one' });
    const { rerender, onOpenChange } = renderDialog(initial);

    await act(async () => mocks.viewProps.setIsEditing(true));
    await act(async () =>
      mocks.viewProps.setFormData((current: any) => ({ ...current, title: 'Draft' }))
    );
    mocks.liveTodo = todo({ title: 'Live two', assignments: undefined });
    rerender(<TodoDetailDialog todo={initial} open onOpenChange={onOpenChange} />);
    expect(mocks.viewProps.formData.title).toBe('Draft');

    await act(async () => mocks.viewProps.handleCancel());
    expect(mocks.viewProps.formData.title).toBe('Live two');
    expect(mocks.viewProps.selectedUserIds).toEqual([]);

    await act(async () => mocks.viewProps.handleDialogOpenChange(true));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    await act(async () => mocks.viewProps.handleDialogOpenChange(false));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('guards save and persists completion plus assignment additions and removals', async () => {
    const value = todo({
      assignments: [
        { id: 'keep', user: { id: 'kept' } },
        { id: 'remove', user: { id: 'removed' } },
        { id: 'missing', user: null },
      ],
    });
    const { unmount } = renderDialog(value, { canManageTodos: false });
    await act(async () => mocks.viewProps.handleSave());
    expect(mocks.updateTodo).not.toHaveBeenCalled();
    unmount();

    renderDialog(value, { canManageTodos: true });
    await act(async () => mocks.viewProps.setSelectedUserIds(['kept', 'added']));
    await act(async () =>
      mocks.viewProps.setFormData((current: any) => ({
        ...current,
        title: 'Updated',
        status: 'completed',
      }))
    );
    await act(async () => mocks.viewProps.handleSave());

    expect(mocks.updateTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'todo-1',
        title: 'Updated',
        status: 'completed',
        completed_at: expect.any(Number),
        due_date: 'resolved-deadline',
      })
    );
    expect(mocks.unassignUser).toHaveBeenCalledWith('remove');
    expect(mocks.assignUser).toHaveBeenCalledWith({
      id: 'assignment-new',
      todo_id: 'todo-1',
      user_id: 'added',
      role: 'assignee',
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('features.todos.notifications.todoUpdated');
    expect(mocks.viewProps.isSaving).toBe(false);
  });

  it('handles reopen, unchanged states, missing assignments, and update failures', async () => {
    renderDialog(todo({ status: 'completed', assignments: undefined }), {
      canManageTodos: true,
    });
    await act(async () =>
      mocks.viewProps.setFormData((current: any) => ({ ...current, status: 'pending' }))
    );
    await act(async () => mocks.viewProps.handleSave());
    expect(mocks.updateTodo).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed_at: null })
    );
    cleanup();

    renderDialog(todo({ status: 'pending' }), { canManageTodos: true });
    await act(async () => mocks.viewProps.handleSave());
    expect(mocks.updateTodo.mock.calls.at(-1)?.[0]).not.toHaveProperty('completed_at');
    cleanup();

    renderDialog(todo({ status: 'completed' }), { canManageTodos: true });
    await act(async () => mocks.viewProps.handleSave());
    expect(mocks.updateTodo.mock.calls.at(-1)?.[0]).not.toHaveProperty('completed_at');
    cleanup();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('update failed'));
    renderDialog(todo(), { canManageTodos: true });
    await act(async () => mocks.viewProps.handleSave());
    expect(mocks.toastError).toHaveBeenCalledWith('features.todos.notifications.todoUpdateFailed');
    expect(mocks.viewProps.isSaving).toBe(false);
  });

  it('archives only completed manageable todos and always clears pending state', async () => {
    renderDialog(todo({ status: 'completed' }), { canManageTodos: false });
    await act(async () => mocks.viewProps.handleArchive());
    expect(mocks.archiveTodo).not.toHaveBeenCalled();
    cleanup();

    renderDialog(todo({ status: 'pending' }), { canManageTodos: true });
    await act(async () => mocks.viewProps.handleArchive());
    expect(mocks.archiveTodo).not.toHaveBeenCalled();
    cleanup();

    renderDialog(todo({ status: 'completed' }), { canManageTodos: true });
    await act(async () => mocks.viewProps.handleArchive());
    expect(mocks.archiveTodo).toHaveBeenCalledWith('todo-1');
    expect(mocks.viewProps.isArchiving).toBe(false);
    cleanup();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('archive failed'));
    renderDialog(todo({ status: 'completed' }), { canManageTodos: true });
    await expect(
      act(async () => {
        await mocks.viewProps.handleArchive();
      })
    ).rejects.toThrow('archive failed');
    expect(mocks.viewProps.isArchiving).toBe(false);
  });

  it('guards and executes unarchive and mutates the selected-assignee state', async () => {
    renderDialog(todo(), { canManageTodos: false });
    await act(async () => mocks.viewProps.handleUnarchive());
    expect(mocks.unarchiveTodo).not.toHaveBeenCalled();
    cleanup();

    renderDialog(todo(), { canManageTodos: true });
    await act(async () => mocks.viewProps.handleUnarchive());
    expect(mocks.unarchiveTodo).toHaveBeenCalledWith('todo-1');
    expect(mocks.viewProps.isArchiving).toBe(false);

    await act(async () => mocks.viewProps.handleRemoveAssignee('user-current'));
    expect(mocks.viewProps.selectedUserIds).toEqual([]);
    await act(async () => mocks.viewProps.handleAddAssignee('new-user'));
    expect(mocks.viewProps.selectedUserIds).toEqual(['new-user']);
    await act(async () => mocks.viewProps.handleAddAssignee('new-user'));
    expect(mocks.viewProps.selectedUserIds).toEqual(['new-user']);
    expect(mocks.viewProps.popoverOpen).toBe(false);
    expect(mocks.viewProps.searchQuery).toBe('');
    cleanup();

    mocks.waitForClientApply.mockRejectedValueOnce(new Error('unarchive failed'));
    renderDialog(todo(), { canManageTodos: true });
    await expect(
      act(async () => {
        await mocks.viewProps.handleUnarchive();
      })
    ).rejects.toThrow('unarchive failed');
    expect(mocks.viewProps.isArchiving).toBe(false);
  });
});
