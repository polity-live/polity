/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  anchor: undefined as string | undefined,
  displayTodo: {} as any,
  headerProps: undefined as any,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ title }: { title: string }) => <span>Share:{title}</span>,
}));
vi.mock('../ui/TodoDetailHeader', () => ({
  TodoDetailHeader: (props: any) => {
    state.headerProps = props;
    return (
      <button type="button" onClick={props.onEdit}>
        Edit header
      </button>
    );
  },
}));
vi.mock('../ui/TodoDetailView', () => ({ TodoDetailView: () => <div>Detail view</div> }));
vi.mock('../ui/TodoDetailEdit', () => ({ TodoDetailEdit: () => <div>Edit view</div> }));
vi.mock('../ui/TodoArchiveAction', () => ({
  TodoArchiveAction: () => <span>Archive action</span>,
  TodoArchiveBadge: () => <span>Archived</span>,
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({ AccessDenied: () => <div>Denied</div> }));
vi.mock('@/features/shared/ui/comments', () => ({
  CommentThread: () => <div>Comments</div>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en' }),
}));
vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: () => state.displayTodo,
}));
vi.mock('../logic/tutorialTodoAnchor', () => ({
  getTodoTutorialAnchor: () => state.anchor,
}));

import { TodoDetailPageView } from '../TodoDetailPageView';

beforeEach(() => {
  state.anchor = undefined;
  state.displayTodo = { title: 'Displayed title' };
  state.headerProps = undefined;
});

afterEach(cleanup);

function props(overrides: Record<string, unknown> = {}) {
  return {
    todoId: 'todo-1',
    t: (key: string) => key,
    todo: { id: 'todo-1', title: 'Todo', status: 'pending', tutorial_run_id: null },
    canAccess: true,
    isEditing: false,
    isSaving: false,
    formData: { title: 'Form title' },
    setIsEditing: vi.fn(),
    handleSave: vi.fn(),
    handleCancel: vi.fn(),
    handleTitleChange: vi.fn(),
    handleFormUpdate: vi.fn(),
    discussion: {
      comments: [],
      currentUserId: 'user-1',
      onAddComment: vi.fn(),
      onVote: vi.fn(),
      isSubmitting: false,
    },
    canManageTodos: true,
    isArchiving: false,
    handleArchive: vi.fn(),
    handleUnarchive: vi.fn(),
    ...overrides,
  } as any;
}

describe('TodoDetailPageView remaining branches A09', () => {
  it('renders access denial after the missing-todo branch', () => {
    render(<TodoDetailPageView {...props({ canAccess: false })} />);
    expect(screen.getByText('Denied')).toBeTruthy();
  });

  it('uses title fallbacks, renders detail/comments, and invokes the header edit callback', () => {
    state.displayTodo = { title: '' };
    const setIsEditing = vi.fn();
    render(<TodoDetailPageView {...props({ setIsEditing })} />);
    expect(screen.getByText('Share:common.entities.todo')).toBeTruthy();
    expect(screen.getByText('Detail view')).toBeTruthy();
    expect(screen.getByText('Comments')).toBeTruthy();
    expect(state.headerProps.title).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Edit header' }));
    expect(setIsEditing).toHaveBeenCalledWith(true);
  });

  it('renders edit, archive, assistant tutorial, and help-link states', () => {
    state.anchor = 'tutorial-assistant-todo';
    state.displayTodo = { title: undefined };
    render(
      <TodoDetailPageView
        {...props({
          isEditing: true,
          todo: {
            id: 'todo-1',
            title: null,
            status: 'completed',
            archived_at: 1,
            tutorial_run_id: 'run',
            creator_id: 'creator',
          },
        })}
      />
    );
    expect(screen.getByText('Archived')).toBeTruthy();
    expect(screen.getByText('Edit view')).toBeTruthy();
    expect(screen.queryByText('Comments')).toBeNull();
    expect(document.querySelector('[data-tutorial-anchor="todo-status-in-progress"]')).toBeTruthy();
    expect(document.querySelector('[data-tutorial-anchor="tutorial-help-links"]')).toBeTruthy();
    expect(state.headerProps.title).toBe('');
  });

  it('uses the generic tutorial completion anchor when the task is not assistant-created', () => {
    state.anchor = 'tutorial-network-todo';
    render(<TodoDetailPageView {...props()} />);
    expect(document.querySelector('[data-tutorial-anchor="todo-complete"]')).toBeTruthy();
  });
});
