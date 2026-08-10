/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TodoDetailPageView } from '../TodoDetailPageView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock('@/features/shared/ui/action-buttons/ShareButton.tsx', () => ({
  ShareButton: ({ 'data-action-id': actionId }: { 'data-action-id'?: string }) => (
    <button type="button" data-action-id={actionId}>
      Share
    </button>
  ),
}));
vi.mock('../ui/TodoDetailHeader', () => ({ TodoDetailHeader: () => null }));
vi.mock('../ui/TodoDetailView', () => ({ TodoDetailView: () => null }));
vi.mock('../ui/TodoDetailEdit', () => ({ TodoDetailEdit: () => null }));
vi.mock('../ui/TodoArchiveAction', () => ({
  TodoArchiveAction: () => null,
  TodoArchiveBadge: () => null,
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({ AccessDenied: () => <div>Denied</div> }));
vi.mock('@/features/shared/ui/comments', () => ({ CommentThread: () => null }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en' }),
}));

afterEach(cleanup);

function props(todo: any) {
  return {
    todoId: 'todo-1',
    t: (key: string) => key,
    todo,
    canAccess: true,
    isEditing: false,
    isSaving: false,
    formData: { title: 'Todo' },
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
  } as any;
}

describe('TodoDetailPageView action contracts', () => {
  it('returns from a missing todo through a stable navigation intent', () => {
    render(<TodoDetailPageView {...props(null)} />);
    expect(document.querySelector('[data-action-id="todos.detail.not-found.back"]')?.tagName).toBe(
      'A'
    );
  });

  it('exposes stable back and share actions for a persisted todo', () => {
    render(
      <TodoDetailPageView
        {...props({
          id: 'todo-1',
          title: 'Todo',
          status: 'pending',
          assignments: [],
          tutorial_run_id: null,
        })}
      />
    );
    expect(document.querySelector('[data-action-id="todos.detail.back"]')?.tagName).toBe('A');
    expect(document.querySelector('[data-action-id="todos.detail.share"]')).toBeTruthy();
  });
});
