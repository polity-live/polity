/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock('@/features/todos/hooks/useTodoFilters', () => ({
  useTodoFilters: () => ({
    fields: [],
    quickFilters: [],
    searchQuery: '',
    setSearchQuery: vi.fn(),
    quickFilterValues: {},
    setQuickFilterValues: vi.fn(),
    toggleQuickFilterValue: vi.fn(),
    clearQuickFilter: vi.fn(),
    savedFilters: [],
    saveCustomFilter: vi.fn(),
    deleteCustomFilter: vi.fn(),
    activeCustomFilterIds: [],
    toggleCustomFilter: vi.fn(),
    filteredTodos: [{ id: 'todo-1' }],
    hasActiveFilters: false,
  }),
}));

vi.mock('@/features/todos/ui/TodosFilters', () => ({
  TodosFilters: () => <div data-testid="todo-filters" />,
}));

vi.mock('@/features/todos/ui/kanban-board.tsx', () => ({
  KanbanBoard: () => <div data-testid="kanban-board" />,
}));

vi.mock('@/features/todos/ui/todo-list.tsx', () => ({
  TodoList: () => <div data-testid="todo-list" />,
}));

vi.mock('@/features/todos/ui/todo-detail-dialog.tsx', () => ({
  TodoDetailDialog: () => <div data-testid="todo-detail-dialog" />,
}));

import { TodosSection } from '../TodosSection';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseProps = {
  groupId: 'group-1',
  storageKey: 'todos-test',
  todos: [],
  viewMode: 'kanban' as const,
  onViewModeChange: vi.fn(),
  onToggleComplete: vi.fn(),
};

describe('TodosSection', () => {
  it('hides the add-task action without manage rights', () => {
    render(<TodosSection {...baseProps} canManageTodos={false} />);

    expect(screen.queryByText('Add Task')).toBeNull();
  });

  it('shows the add-task action with manage rights', () => {
    render(<TodosSection {...baseProps} canManageTodos />);

    expect(screen.queryByText('Add Task')).not.toBeNull();
  });

  it('switches the group archive to list view', () => {
    render(<TodosSection {...baseProps} canManageTodos />);

    expect(screen.queryByTestId('kanban-board')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show archive/ }));
    expect(screen.queryByTestId('todo-list')).not.toBeNull();
    expect(screen.queryByTestId('kanban-board')).toBeNull();
  });

  it('dispatches archive and view-mode changes through stable actions', () => {
    const onViewModeChange = vi.fn();
    const { container } = render(
      <TodosSection {...baseProps} onViewModeChange={onViewModeChange} canManageTodos />
    );

    const kanban = container.querySelector<HTMLElement>(
      '[data-action-id="groups.todos.select.kanban"]'
    )!;
    const list = container.querySelector<HTMLElement>(
      '[data-action-id="groups.todos.select.list"]'
    )!;
    kanban.focus();
    expect(document.activeElement).toBe(kanban);
    fireEvent.click(list);
    fireEvent.click(kanban);
    fireEvent.click(container.querySelector('[data-action-id="groups.todos.toggle.archive"]')!);

    expect(onViewModeChange.mock.calls).toEqual([['list'], ['kanban']]);
    expect(screen.queryByTestId('todo-list')).not.toBeNull();
  });
});
