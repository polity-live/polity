/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompactTodoRow } from '../CompactTodoRow';
import type { Todo } from '../../types/todo.types';

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), canManage: vi.fn(() => true) }));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/zero/mutators', () => ({
  mutators: {
    todos: {
      update: (args: unknown) => args,
      assign: (args: unknown) => ({ assign: args }),
      unassign: (args: unknown) => ({ unassign: args }),
    },
  },
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/zero/rbac', () => ({ usePermissions: () => ({ canManage: mocks.canManage }) }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/ui/preview/WorkspacePreview', () => ({
  PreviewButton: () => <button>Preview</button>,
}));
vi.mock('../../hooks/useTodoAssigneeOptions', () => ({
  useTodoAssigneeOptions: () => ({ allowedUserIds: ['me'], isLoading: false }),
}));

vi.mock('@/features/create/ui/inputs/UserSearchInput', () => ({
  UserSearchInput: ({ onChange, disabled }: any) => (
    <button disabled={disabled} onClick={() => onChange(['new-user'])}>
      Assign new user
    </button>
  ),
}));
vi.mock('@/features/create/ui/inputs/TodoDeadlineInput', () => ({
  TodoDeadlineInput: ({ onChange }: any) => (
    <button onClick={() => onChange({ dueDate: '2026-10-01', dueTime: '12:00' })}>
      Choose deadline
    </button>
  ),
}));

const todo = {
  id: 'task',
  title: 'Prepare agenda',
  creator_id: 'me',
  group_id: 'group',
  status: 'pending',
  assignments: [],
  due_date: null,
} as unknown as Todo;
beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.canManage.mockReturnValue(true);
});
afterEach(cleanup);
describe('compact todo editing', () => {
  it('waits for confirmation and prevents duplicate status writes while pending', async () => {
    let confirm!: (value: { type: 'success' }) => void;
    mocks.mutate.mockReturnValue({
      server: new Promise(resolve => {
        confirm = resolve;
      }),
    });
    render(<CompactTodoRow todo={todo} />);
    const status = screen.getByRole('combobox');
    fireEvent.change(status, { target: { value: 'in_progress' } });
    fireEvent.change(status, { target: { value: 'completed' } });
    expect(mocks.mutate).toHaveBeenCalledOnce();
    expect(mocks.mutate).toHaveBeenCalledWith({
      id: 'task',
      status: 'in_progress',
      completed_at: null,
    });
    expect((status as HTMLSelectElement).disabled).toBe(true);
    await act(async () => {
      confirm({ type: 'success' });
    });
    expect((status as HTMLSelectElement).disabled).toBe(false);
  });

  it('edits assignees and deadlines with pending guards and restores the edit context after rejection', async () => {
    mocks.mutate.mockReturnValue({ server: Promise.resolve({ type: 'success' }) });
    const onTodoClick = vi.fn();
    render(
      <CompactTodoRow
        todo={
          {
            ...todo,
            assignments: [
              {
                id: 'old-assignment',
                user_id: 'old-user',
                todo_id: 'task',
                role: 'assignee',
                assigned_at: 1,
                user: undefined,
              },
            ],
          } as Todo
        }
        onTodoClick={onTodoClick}
      />
    );
    const assignmentTrigger = screen.getByRole('button', { name: 'features.todos.assignee.title' });
    assignmentTrigger.focus();
    fireEvent.click(assignmentTrigger);
    fireEvent.click(await screen.findByRole('button', { name: 'Assign new user' }));
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith({
        assign: expect.objectContaining({ todo_id: 'task', user_id: 'new-user', role: 'assignee' }),
      })
    );
    expect(mocks.mutate).toHaveBeenCalledWith({ unassign: { id: 'old-assignment' } });
    await act(() => Promise.resolve());
    cleanup();
    render(<CompactTodoRow todo={todo} onTodoClick={onTodoClick} />);
    const dateTrigger = screen.getByRole('button', { name: 'features.todos.dueDate.title' });
    dateTrigger.focus();
    fireEvent.click(dateTrigger);
    fireEvent.click(await screen.findByRole('button', { name: 'Choose deadline' }));
    mocks.mutate.mockReturnValueOnce({
      server: Promise.resolve({ type: 'error', error: { type: 'app', message: 'Rejected' } }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.actions.save' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose deadline' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'common.actions.save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.mutate).toHaveBeenLastCalledWith({
      id: 'task',
      due_date: new Date('2026-10-01T12:00').getTime(),
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.actions.edit' }));
    expect(onTodoClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'task' }));
  });

  it('keeps the row available after server failure and respects group permissions', async () => {
    mocks.mutate.mockReturnValue({
      server: Promise.resolve({ type: 'error', error: { type: 'app', message: 'Rejected' } }),
    });
    const { rerender } = render(<CompactTodoRow todo={todo} />);
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'completed' } });
    });
    expect(screen.getByRole('alert').textContent).toBe('common.workspace.saveFailed');
    expect(screen.getByRole('link', { name: 'Prepare agenda' }).getAttribute('href')).toBe(
      '/todos/task'
    );
    mocks.canManage.mockReturnValue(false);
    rerender(<CompactTodoRow todo={todo} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'features.todos.dueDate.title' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
