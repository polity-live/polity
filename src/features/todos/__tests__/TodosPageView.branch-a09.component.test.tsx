// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TodosPageView, type TodosPageViewProps } from '../TodosPageView';

const mocks = vi.hoisted(() => ({
  kanbanProps: null as any,
  listProps: null as any,
  dialogProps: null as any,
  anchors: new Map<string, string | null>(),
  resolveFixture: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
vi.mock('@/features/todos/ui/TodosHeader', () => ({ TodosHeader: () => <div>header</div> }));
vi.mock('@/features/todos/ui/TodosFilters', () => ({
  TodosFilters: ({ actions }: any) => <div>{actions}</div>,
}));
vi.mock('@/features/todos/ui/TodosTabs', () => ({
  TodosTabs: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/todos/ui/kanban-board.tsx', () => ({
  KanbanBoard: (props: any) => {
    mocks.kanbanProps = props;
    return <div data-testid="kanban" />;
  },
}));
vi.mock('@/features/todos/ui/todo-list.tsx', () => ({
  TodoList: (props: any) => {
    mocks.listProps = props;
    return <div data-testid="list" />;
  },
}));
vi.mock('@/features/todos/ui/todo-detail-dialog.tsx', () => ({
  TodoDetailDialog: (props: any) => {
    mocks.dialogProps = props;
    return <button onClick={() => props.onOpenChange(false)}>dialog</button>;
  },
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../logic/tutorialTodoAnchor', () => ({
  getTodoTutorialAnchor: (todo: any) => mocks.anchors.get(todo.id) ?? null,
}));
vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: (...args: any[]) => mocks.resolveFixture(...args),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'de' }),
}));

function props(overrides: Partial<TodosPageViewProps> = {}): TodosPageViewProps {
  return {
    t: (key: string) => key,
    user: { id: 'user-1' },
    viewMode: 'list',
    setViewMode: vi.fn(),
    selectedTodo: null,
    isDetailDialogOpen: false,
    setIsDetailDialogOpen: vi.fn(),
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
    selectedTab: 'all',
    setSelectedTab: vi.fn(),
    filteredTodos: [],
    statusCounts: {},
    handleToggleComplete: vi.fn(),
    handleTodoClick: vi.fn(),
    tabSwipeHandlers: { onTouchStart: vi.fn(), onTouchEnd: vi.fn() } as any,
    ...overrides,
  };
}

describe('TodosPageView branch coverage', () => {
  beforeEach(() => {
    mocks.kanbanProps = null;
    mocks.listProps = null;
    mocks.dialogProps = null;
    mocks.anchors = new Map();
    mocks.resolveFixture.mockReset().mockImplementation(todo => ({ ...todo, localized: true }));
  });
  afterEach(cleanup);

  it('renders loading and all empty-state messages plus archived create visibility', () => {
    const rendered = render(<TodosPageView {...props({ user: null })} />);
    expect(screen.getByTestId('page-skeleton')).toBeTruthy();

    rendered.rerender(
      <TodosPageView {...props({ searchQuery: 'find', selectedTab: 'pending' })} />
    );
    expect(document.body.textContent).toContain('features.todos.list.noMatchingTodos');
    expect(document.body.textContent).toContain('features.todos.create.createFirstTodo');

    rendered.rerender(<TodosPageView {...props({ selectedTab: 'archived' })} />);
    expect(document.body.textContent).toContain('features.todos.archive.empty');
    expect(document.body.textContent).not.toContain('features.todos.create.createFirstTodo');

    rendered.rerender(<TodosPageView {...props({ selectedTab: 'all' })} />);
    expect(document.body.textContent).toContain('features.todos.list.noTodosYet');

    rendered.rerender(<TodosPageView {...props({ selectedTab: 'pending' })} />);
    expect(document.body.textContent).toContain('features.todos.list.noStatusTodos');
  });

  it('builds the unfiltered kanban query and localizes displayed todos', () => {
    const todo = { id: 'one', tutorial_run_id: 'run' };
    render(
      <TodosPageView
        {...props({ filteredTodos: [todo], viewMode: 'kanban', selectedTab: 'pending' })}
      />
    );
    expect(mocks.resolveFixture).toHaveBeenCalledWith(todo, {
      tutorialRunId: 'run',
      language: 'de',
    });
    expect(mocks.kanbanProps.todos[0].localized).toBe(true);
    expect(mocks.kanbanProps.virtualQuery).toEqual({ query: '' });
  });

  it('disables kanban virtualization for tutorial, custom, and quick-filter states', () => {
    const todo = { id: 'tutorial' };
    mocks.anchors.set('tutorial', 'some-anchor');
    const rendered = render(
      <TodosPageView {...props({ filteredTodos: [todo], viewMode: 'kanban' })} />
    );
    expect(mocks.kanbanProps.virtualQuery).toBeUndefined();

    mocks.anchors.clear();
    rendered.rerender(
      <TodosPageView
        {...props({ filteredTodos: [todo], viewMode: 'kanban', activeCustomFilterIds: ['f'] })}
      />
    );
    expect(mocks.kanbanProps.virtualQuery).toBeUndefined();

    rendered.rerender(
      <TodosPageView
        {...props({
          filteredTodos: [todo],
          viewMode: 'kanban',
          quickFilterValues: { tags: ['tag'] },
        })}
      />
    );
    expect(mocks.kanbanProps.virtualQuery).toBeUndefined();

    rendered.rerender(
      <TodosPageView
        {...props({
          filteredTodos: [todo],
          viewMode: 'kanban',
          quickFilterValues: { flag: true },
        })}
      />
    );
    expect(mocks.kanbanProps.virtualQuery).toBeUndefined();

    rendered.rerender(
      <TodosPageView
        {...props({ filteredTodos: [todo], viewMode: 'kanban', quickFilterValues: null })}
      />
    );
    expect(mocks.kanbanProps.virtualQuery).toEqual({ query: '' });
  });

  it('builds active and archived list queries or disables them for filters', () => {
    const todo = { id: 'one' };
    const rendered = render(<TodosPageView {...props({ filteredTodos: [todo] })} />);
    expect(mocks.listProps.virtualQuery).toEqual({ status: 'all', archive: 'active', query: '' });

    rendered.rerender(
      <TodosPageView
        {...props({ filteredTodos: [todo], selectedTab: 'archived', viewMode: 'kanban' })}
      />
    );
    expect(mocks.listProps.virtualQuery).toEqual({
      status: 'all',
      archive: 'archived',
      query: '',
    });

    rendered.rerender(
      <TodosPageView
        {...props({ filteredTodos: [todo], selectedTab: 'completed', quickFilterValues: null })}
      />
    );
    expect(mocks.listProps.virtualQuery).toEqual({
      status: 'completed',
      archive: 'active',
      query: '',
    });

    rendered.rerender(
      <TodosPageView
        {...props({
          filteredTodos: [todo],
          selectedTab: 'completed',
          quickFilterValues: { empty: [], disabled: false },
        })}
      />
    );
    expect(mocks.listProps.virtualQuery).toEqual({
      status: 'completed',
      archive: 'active',
      query: '',
    });

    rendered.rerender(
      <TodosPageView {...props({ filteredTodos: [todo], activeCustomFilterIds: ['custom'] })} />
    );
    expect(mocks.listProps.virtualQuery).toBeUndefined();
  });

  it('renders tutorial help and the selected detail dialog', () => {
    const todo = { id: 'assistant' };
    mocks.anchors.set('assistant', 'tutorial-assistant-todo');
    const setOpen = vi.fn();
    render(
      <TodosPageView
        {...props({
          filteredTodos: [todo],
          selectedTodo: todo,
          isDetailDialogOpen: true,
          setIsDetailDialogOpen: setOpen,
        })}
      />
    );
    expect(document.body.textContent).toContain('features.todos.helpLinks.assistant');
    expect(mocks.dialogProps).toEqual(expect.objectContaining({ todo, open: true }));
    fireEvent.click(screen.getByRole('button', { name: 'dialog' }));
    expect(setOpen).toHaveBeenCalledWith(false);
  });
});
