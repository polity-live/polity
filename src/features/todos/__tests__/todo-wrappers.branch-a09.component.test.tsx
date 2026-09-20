/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  model: {} as any,
  swipe: undefined as any,
  view: undefined as any,
  loading: false,
  display: {} as Record<string, unknown>,
  save: vi.fn().mockResolvedValue(undefined),
  error: vi.fn(),
}));
vi.mock('@/features/todos/hooks/useTodosPage', () => ({ useTodosPage: () => state.model }));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: (options: any) => {
    state.swipe = options;
    return { handlers: { onTouchStart: vi.fn() } };
  },
}));
vi.mock('../TodosPageView', () => ({
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
beforeEach(() => {
  state.loading = false;
  state.display = {};
  state.save.mockReset().mockResolvedValue(undefined);
  state.error.mockClear();
});

it('loads the saved todo view once and retains a manually selected view when saving fails', async () => {
  state.model = model('all');
  state.loading = true;
  state.display = { todoView: 'list' };
  const view = render(<TodosPage />);
  expect(state.model.setViewMode).not.toHaveBeenCalled();
  state.loading = false;
  view.rerender(<TodosPage />);
  expect(state.model.setViewMode).toHaveBeenCalledExactlyOnceWith('list');
  view.rerender(<TodosPage />);
  expect(state.model.setViewMode).toHaveBeenCalledTimes(1);
  state.save.mockRejectedValueOnce(new Error('offline'));
  state.view.setViewMode('kanban');
  await waitFor(() => expect(state.error).toHaveBeenCalledWith('common.workspace.saveFailed'));
  expect(state.model.setViewMode).toHaveBeenLastCalledWith('kanban');
  view.unmount();
  state.model = { ...model('all'), filteredTodos: [{ tutorial_run_id: 'tutorial' }] };
  render(<TodosPage />);
  expect(state.model.setViewMode).not.toHaveBeenCalled();
});

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

vi.mock('@/zero/preferences/useWorkspacePreferences', () => ({
  useWorkspacePreferences: () => ({
    isLoading: state.loading,
    display: state.display,
    setDisplay: state.save,
  }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: state.error } }));
