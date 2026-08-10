/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TodosPageView } from '../TodosPageView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock('@/features/todos/ui/TodosFilters', () => ({
  TodosFilters: ({ actions }: { actions: ReactNode }) => <div>{actions}</div>,
}));
vi.mock('@/features/todos/ui/TodosTabs', () => ({
  TodosTabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/todos/ui/kanban-board.tsx', () => ({ KanbanBoard: () => null }));
vi.mock('@/features/todos/ui/todo-list.tsx', () => ({ TodoList: () => null }));
vi.mock('@/features/todos/ui/todo-detail-dialog.tsx', () => ({ TodoDetailDialog: () => null }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
});

describe('TodosPageView loading state', () => {
  it('renders a page skeleton while the user context loads', () => {
    render(
      <TodosPageView
        {...({
          t: (key: string) => (key === 'features.todos.loading' ? 'Loading todos' : key),
          user: null,
        } as any)}
      />
    );

    expect(document.querySelector('[data-slot="entity-page-skeleton"]')).toBeTruthy();
    expect(screen.queryByText('Loading todos')).toBeNull();
  });

  it('links an authenticated empty state to todo creation with a stable intent', () => {
    render(
      <TodosPageView
        {...({
          t: (key: string) => key,
          user: { id: 'user-1' },
          viewMode: 'list',
          setViewMode: () => undefined,
          fields: [],
          quickFilters: [],
          searchQuery: '',
          setSearchQuery: () => undefined,
          quickFilterValues: {},
          setQuickFilterValues: () => undefined,
          toggleQuickFilterValue: () => undefined,
          clearQuickFilter: () => undefined,
          savedFilters: [],
          saveCustomFilter: () => undefined,
          deleteCustomFilter: () => undefined,
          activeCustomFilterIds: [],
          toggleCustomFilter: () => undefined,
          selectedTab: 'all',
          setSelectedTab: () => undefined,
          filteredTodos: [],
          statusCounts: {
            all: 0,
            pending: 0,
            in_progress: 0,
            completed: 0,
            cancelled: 0,
            archived: 0,
          },
          tabSwipeHandlers: {},
        } as any)}
      />
    );

    const create = document.querySelector('[data-action-id="todos.list.empty.create"]');
    expect(create?.tagName).toBe('A');
  });

  it('does not offer creation from the archived empty state', () => {
    render(
      <TodosPageView
        {...({
          t: (key: string) => key,
          user: { id: 'user-1' },
          viewMode: 'list',
          fields: [],
          quickFilters: [],
          searchQuery: '',
          quickFilterValues: {},
          savedFilters: [],
          activeCustomFilterIds: [],
          selectedTab: 'archived',
          filteredTodos: [],
          statusCounts: {},
          tabSwipeHandlers: {},
        } as any)}
      />
    );

    expect(document.querySelector('[data-action-id="todos.list.empty.create"]')).toBeNull();
  });
});
