/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  model: {} as any,
  swipe: undefined as any,
  view: undefined as any,
}));
vi.mock('@/features/todos/hooks/useTodosPage', () => ({ useTodosPage: () => state.model }));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: (options: any) => {
    state.swipe = options;
    return { handlers: { onTouchStart: vi.fn() } };
  },
}));
vi.mock('./TodosPageView', () => ({
  TodosPageView: (props: any) => {
    state.view = props;
    return null;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../ui/kanban-board-view', () => ({ KanbanBoardView: () => <div>Kanban</div> }));
vi.mock('../ui/todo-detail-dialog.tsx', () => ({
  TodoDetailDialog: () => <div>Todo Details</div>,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import { TodosPage } from '../TodosPage';
import { KanbanBoardShellView } from '../ui/KanbanBoardShellView';
import { TodoDetailEdit } from '../ui/TodoDetailEdit';
import { TodosHeader } from '../ui/TodosHeader';
import { TodoStatusIcon } from '../ui/TodoStatusIcon';

afterEach(cleanup);

const model = (selectedTab: string) => ({
  user: null,
  viewMode: 'kanban',
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
  selectedTab,
  setSelectedTab: vi.fn(),
  filteredTodos: [],
  statusCounts: {},
  handleToggleComplete: vi.fn(),
  handleTodoClick: vi.fn(),
});

it('covers todos-page swipe boundaries and valid neighbors', () => {
  state.model = model('all');
  const view = render(<TodosPage />);
  expect(state.swipe).toMatchObject({ canSwipePrev: false, canSwipeNext: true });
  state.swipe.onSwipePrev();
  state.swipe.onSwipeNext();
  expect(state.model.setSelectedTab).toHaveBeenCalledWith('pending');

  state.model = model('archived');
  view.rerender(<TodosPage />);
  expect(state.swipe).toMatchObject({ canSwipePrev: true, canSwipeNext: false });
  state.swipe.onSwipeNext();
  state.swipe.onSwipePrev();
  expect(state.model.setSelectedTab).toHaveBeenCalledWith('cancelled');

  state.model = model('unknown');
  view.rerender(<TodosPage />);
  expect(state.swipe).toMatchObject({ canSwipePrev: false, canSwipeNext: false });
  state.swipe.onSwipePrev();
  state.swipe.onSwipeNext();
});

it('renders kanban shell with and without a selected todo', () => {
  const controller = {
    columns: [],
    virtualQuery: undefined,
    tasksLabel: 'tasks',
    draggedTodoId: null,
    onColumnDragOver: vi.fn(),
    onColumnDrop: vi.fn(),
    onCardMouseDown: vi.fn(),
    onCardDragStart: vi.fn(),
    onCardDragEnd: vi.fn(),
    onCardClick: vi.fn(),
    onToggleComplete: vi.fn(),
    selectedTodo: null,
    isDetailDialogOpen: false,
    onDetailDialogOpenChange: vi.fn(),
  };
  const view = render(<KanbanBoardShellView canManageTodos controller={controller} />);
  expect(document.body.textContent).not.toContain('Todo Details');
  view.rerender(
    <KanbanBoardShellView
      canManageTodos
      controller={{ ...controller, selectedTodo: { id: 'one' } }}
    />
  );
});

it('renders every status icon', () => {
  for (const status of ['pending', 'in_progress', 'completed', 'cancelled'] as const) {
    const view = render(<TodoStatusIcon status={status} />);
    expect(view.container.querySelector('svg')).toBeTruthy();
    view.unmount();
  }
});

it('updates tutorial detail description and both header modes', () => {
  const onUpdate = vi.fn();
  const formData = {
    title: 'Todo',
    description: '',
    status: 'pending',
    priority: 'low',
    dueDate: '',
    dueTime: '',
  } as const;
  const edit = render(<TodoDetailEdit formData={formData} onUpdate={onUpdate} isTutorialTodo />);
  fireEvent.change(edit.container.querySelector('textarea')!, { target: { value: 'Description' } });
  expect(onUpdate).toHaveBeenCalledWith({ description: 'Description' });
  edit.unmount();

  const setViewMode = vi.fn();
  const header = render(<TodosHeader viewMode="kanban" setViewMode={setViewMode} />);
  fireEvent.click(screen.getByLabelText('features.todos.view.list'));
  header.rerender(<TodosHeader viewMode="list" setViewMode={setViewMode} />);
  fireEvent.click(screen.getByLabelText('features.todos.view.kanban'));
  expect(setViewMode).toHaveBeenCalledWith('list');
  expect(setViewMode).toHaveBeenCalledWith('kanban');
});
