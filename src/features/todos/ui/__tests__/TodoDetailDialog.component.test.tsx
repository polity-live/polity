// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TodoDetailDialog } from '../todo-detail-dialog';

const mocks = vi.hoisted(() => ({
  liveTodo: null as any,
  updateTodo: vi.fn(),
  assignUser: vi.fn(),
  unassignUser: vi.fn(),
  archiveTodo: vi.fn(),
  unarchiveTodo: vi.fn(),
}));

vi.mock('@/zero/todos/useTodoState.ts', () => ({
  useTodoState: () => ({ todo: mocks.liveTodo }),
}));

vi.mock('@/zero/groups/useGroupState.ts', () => ({
  useGroupState: () => ({ membershipsWithUsers: [] }),
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

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-current' } }),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: () => ({ canManage: () => false }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: () => Promise.resolve(),
}));

vi.mock('../../hooks/useTodoDiscussion', () => ({
  useTodoDiscussion: () => ({
    comments: [],
    commentCount: 0,
    currentUserId: 'user-current',
    isSubmitting: false,
    onAddComment: vi.fn(),
    onVote: vi.fn(),
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../TodoDetailDialogView', () => ({
  TodoDetailDialogView: (props: any) => (
    <div>
      <span data-testid="dialog-open">{String(props.open)}</span>
      <span data-testid="is-editing">{String(props.isEditing)}</span>
      <span data-testid="todo-title">{props.todo.title}</span>
      <span data-testid="todo-status">{props.todo.status}</span>
      <span data-testid="form-title">{props.formData.title}</span>
      <span data-testid="selected-users">{props.selectedUserIds.join(',')}</span>
      <button type="button" onClick={() => props.setIsEditing(true)}>
        edit
      </button>
      <button
        type="button"
        onClick={() => props.setFormData((current: any) => ({ ...current, title: 'Draft title' }))}
      >
        change title
      </button>
      <button type="button" onClick={props.handleCancel}>
        cancel
      </button>
      <button type="button" onClick={props.handleSave}>
        save
      </button>
    </div>
  ),
}));

function createTodo({
  title,
  status = 'pending',
  assigneeIds = [],
}: {
  title: string;
  status?: string;
  assigneeIds?: string[];
}) {
  return {
    id: 'todo-1',
    title,
    description: '',
    status,
    priority: 'medium',
    due_date: null,
    completed_at: null,
    tags: [],
    visibility: 'private',
    creator_id: 'user-current',
    group_id: null,
    assignments: assigneeIds.map((id, index) => ({
      id: `assignment-${index}`,
      user: { id },
    })),
    group: null,
  } as any;
}

describe('TodoDetailDialog', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.liveTodo = null;
    mocks.updateTodo.mockReset();
    mocks.assignUser.mockReset();
    mocks.unassignUser.mockReset();
    mocks.archiveTodo.mockReset();
    mocks.unarchiveTodo.mockReset();
  });

  it('shows the saved values immediately while the dialog remains open', async () => {
    const initialTodo = createTodo({ title: 'Original title' });
    mocks.liveTodo = initialTodo;

    const { rerender } = render(
      <TodoDetailDialog todo={initialTodo} open onOpenChange={vi.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'change title' }));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => {
      expect(mocks.updateTodo).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'todo-1', title: 'Draft title' })
      );
      expect(screen.getByTestId('is-editing').textContent).toBe('false');
    });

    mocks.liveTodo = createTodo({ title: 'Draft title' });
    rerender(<TodoDetailDialog todo={initialTodo} open onOpenChange={vi.fn()} />);

    expect(screen.getByTestId('dialog-open').textContent).toBe('true');
    expect(screen.getByTestId('todo-title').textContent).toBe('Draft title');
  });

  it('shows reactive todo updates while open without overwriting an active draft', () => {
    const initialTodo = createTodo({ title: 'Stale title', assigneeIds: ['user-1'] });
    mocks.liveTodo = createTodo({ title: 'Saved title', assigneeIds: ['user-2'] });

    const { rerender } = render(
      <TodoDetailDialog todo={initialTodo} open onOpenChange={vi.fn()} />
    );

    expect(screen.getByTestId('dialog-open').textContent).toBe('true');
    expect(screen.getByTestId('todo-title').textContent).toBe('Saved title');
    expect(screen.getByTestId('form-title').textContent).toBe('Saved title');
    expect(screen.getByTestId('selected-users').textContent).toBe('user-2');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'change title' }));

    mocks.liveTodo = createTodo({
      title: 'Newest saved title',
      status: 'completed',
      assigneeIds: ['user-3'],
    });
    rerender(<TodoDetailDialog todo={initialTodo} open onOpenChange={vi.fn()} />);

    expect(screen.getByTestId('dialog-open').textContent).toBe('true');
    expect(screen.getByTestId('todo-title').textContent).toBe('Newest saved title');
    expect(screen.getByTestId('todo-status').textContent).toBe('completed');
    expect(screen.getByTestId('form-title').textContent).toBe('Draft title');
    expect(screen.getByTestId('selected-users').textContent).toBe('user-2');

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(screen.getByTestId('form-title').textContent).toBe('Newest saved title');
    expect(screen.getByTestId('selected-users').textContent).toBe('user-3');
  });
});
