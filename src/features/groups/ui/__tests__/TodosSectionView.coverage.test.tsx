/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ listProps: undefined as any, transformId: false }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: any) => <a>{children}</a> }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ language: 'en' }),
}));
vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: (todo: any) =>
    mocks.transformId ? { ...todo, id: `display-${todo.id}` } : todo,
}));
vi.mock('@/features/todos/ui/kanban-board.tsx', () => ({
  KanbanBoard: ({ todos }: any) => <div>kanban {todos.length}</div>,
}));
vi.mock('@/features/todos/ui/todo-list.tsx', () => ({
  TodoList: (props: any) => {
    mocks.listProps = props;
    return <div>list</div>;
  },
}));
vi.mock('@/features/todos/ui/todo-detail-dialog.tsx', () => ({
  TodoDetailDialog: ({ todo }: any) => <div>detail {todo.id}</div>,
}));
vi.mock('@/features/todos/ui/TodosFilters', () => ({ TodosFilters: () => <div>filters</div> }));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, asChild: _asChild, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <header>{children}</header>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));

import { TodosSectionView } from '../TodosSectionView';

beforeEach(() => {
  mocks.listProps = undefined;
  mocks.transformId = false;
});
afterEach(cleanup);
const todo = { id: 'todo', tutorial_run_id: null, title: 'Todo' } as any;
const base = {
  canManageTodos: false,
  groupId: 'g',
  viewMode: 'kanban' as const,
  onViewModeChange: vi.fn(),
  onToggleComplete: vi.fn(),
  fields: [],
  fieldRegistry: {},
  quickFilters: [],
  searchQuery: '',
  setSearchQuery: vi.fn(),
  quickFilterValues: {},
  setQuickFilterValues: vi.fn(),
  toggleQuickFilterValue: vi.fn(),
  clearQuickFilter: vi.fn(),
  clearAllFilters: vi.fn(),
  savedFilters: [],
  saveCustomFilter: vi.fn(),
  deleteCustomFilter: vi.fn(),
  activeCustomFilterIds: [],
  toggleCustomFilter: vi.fn(),
  filteredTodos: [],
  filteredItems: [],
  hasActiveFilters: false,
  selectedTab: 'all',
  setSelectedTab: vi.fn(),
  isDetailDialogOpen: false,
  selectedTodo: null,
  onDetailDialogOpenChange: vi.fn(),
  onTodoClick: vi.fn(),
  archiveMode: 'active' as const,
  setArchiveMode: vi.fn(),
  archivedCount: 2,
} as any;

describe('TodosSectionView branches', () => {
  it('covers every empty message and archive/view/manage toggle', () => {
    const view = render(<TodosSectionView {...base} />);
    fireEvent.click(
      view.container.querySelector('[data-action-id="groups.todos.toggle.archive"]')!
    );
    fireEvent.click(view.container.querySelector('[data-action-id="groups.todos.select.kanban"]')!);
    fireEvent.click(view.container.querySelector('[data-action-id="groups.todos.select.list"]')!);
    view.rerender(<TodosSectionView {...base} hasActiveFilters />);
    view.rerender(<TodosSectionView {...base} archiveMode="archived" />);
    fireEvent.click(
      view.container.querySelector('[data-action-id="groups.todos.toggle.archive"]')!
    );
    view.rerender(
      <TodosSectionView {...base} archiveMode="archived" hasActiveFilters canManageTodos />
    );
    expect(view.container.textContent).toContain('generated.inline.0114');
  });

  it('covers kanban, list, selected detail, and raw/display todo lookup fallbacks', () => {
    const toggle = vi.fn(),
      click = vi.fn();
    const view = render(
      <TodosSectionView
        {...base}
        filteredTodos={[todo]}
        onToggleComplete={toggle}
        onTodoClick={click}
        selectedTodo={todo}
      />
    );
    expect(view.container.textContent).toContain('kanban');
    view.rerender(
      <TodosSectionView
        {...base}
        filteredTodos={[todo]}
        viewMode="list"
        onToggleComplete={toggle}
        onTodoClick={click}
        selectedTodo={todo}
      />
    );
    act(() => {
      mocks.listProps.onToggleComplete(todo);
      mocks.listProps.onTodoClick(todo);
    });
    expect(toggle).toHaveBeenCalledWith(todo);
    expect(click).toHaveBeenCalledWith(todo);
    mocks.transformId = true;
    view.rerender(
      <TodosSectionView
        {...base}
        filteredTodos={[todo]}
        archiveMode="archived"
        onToggleComplete={toggle}
        onTodoClick={click}
      />
    );
    act(() => {
      mocks.listProps.onToggleComplete({ ...todo, id: 'display-todo' });
      mocks.listProps.onTodoClick({ ...todo, id: 'display-todo' });
    });
    expect(toggle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'display-todo' }));
  });
});
