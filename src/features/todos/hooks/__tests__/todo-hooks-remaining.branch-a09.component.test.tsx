/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  addComment: vi.fn(),
  allTodos: [] as any[],
  archivedTodos: [] as any[],
  deleteCommentVote: vi.fn(),
  filterModel: {} as any,
  report: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updateCommentVote: vi.fn(),
  updateTodoAction: vi.fn(),
  updateTodoMutation: vi.fn(),
  user: { id: 'user-1' } as any,
  voteComment: vi.fn(),
  wait: vi.fn(async (value: unknown) => value),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({
    addComment: state.addComment,
    deleteCommentVote: state.deleteCommentVote,
    updateCommentVote: state.updateCommentVote,
    voteComment: state.voteComment,
  }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => state.wait(value),
}));
vi.mock('@/zero/todos/useTodoActions.ts', () => ({
  useTodoActions: () => ({ updateTodo: state.updateTodoAction }),
}));
vi.mock('@/features/todos/hooks/useTodoMutations', () => ({
  useTodoMutations: () => ({ updateTodo: state.updateTodoMutation }),
}));
vi.mock('@/zero/todos/useTodoState', () => ({
  useTodoState: () => ({ allTodos: state.allTodos, archivedTodos: state.archivedTodos }),
}));
vi.mock('@/features/todos/hooks/useTodoFilters', () => ({
  useTodoFilters: () => state.filterModel,
}));
vi.mock('@/features/app-tutorial/events', () => ({ reportAppTutorialAction: state.report }));
vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: state.toastError, success: state.toastSuccess },
}));

import { useKanbanBoardController } from '../useKanbanBoardController';
import { useTodoDiscussion } from '../useTodoDiscussion';
import { useTodosPage } from '../useTodosPage';

const baseFilterModel = () => ({
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
  filteredTodos: [] as any[],
});

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: 'user-1' };
  state.allTodos = [];
  state.archivedTodos = [];
  state.filterModel = baseFilterModel();
  for (const action of [
    state.addComment,
    state.deleteCommentVote,
    state.updateCommentVote,
    state.updateTodoAction,
    state.voteComment,
  ]) {
    action.mockReturnValue({ client: Promise.resolve(), server: Promise.resolve() });
  }
  state.updateTodoMutation.mockResolvedValue(undefined);
  state.wait.mockImplementation(async value => value);
});

afterEach(() => vi.restoreAllMocks());

describe('todo discussion remaining branches A09', () => {
  it('maps missing content, names, handles, votes, users, counts, and nested defaults', () => {
    const todo = {
      threads: [
        {
          id: 'thread-1',
          comments: [
            {
              id: 'one',
              created_at: 1,
              user: { id: 'u1', first_name: '', last_name: '', handle: 'handle', avatar: null },
              votes: [{ id: 'v1', vote: null, user: null }],
            },
            {
              id: 'two',
              created_at: 2,
              user: { id: 'u2', first_name: null, last_name: null, handle: null },
              replies: [{ id: 'reply', created_at: 3 }],
            },
            { id: 'nested-only', parent_id: 'one', created_at: 4 },
          ],
        },
      ],
    };
    const { result } = renderHook(() => useTodoDiscussion(todo));
    expect(result.current.commentCount).toBe(3);
    expect(result.current.comments[0]).toMatchObject({
      text: '',
      parent_id: null,
      upvotes: 0,
      downvotes: 0,
      creator: { name: 'handle', handle: 'handle', avatar: undefined },
      votes: [{ vote: 0, user: undefined }],
      replies: [],
    });
    expect(result.current.comments[1].creator?.name).toBe('Unknown');
    expect(result.current.comments[1].replies?.[0].creator).toBeUndefined();
  });

  it('guards missing actors, threads, and blank comments and handles a top-level failure', async () => {
    const missingThread = renderHook(() => useTodoDiscussion(null));
    await act(() => missingThread.result.current.onAddComment('text'));
    await act(() => missingThread.result.current.onVote('comment', 1));
    expect(missingThread.result.current.currentUserId).toBeUndefined();
    expect(state.addComment).not.toHaveBeenCalled();
    missingThread.unmount();

    state.user = undefined;
    const noUser = renderHook(() =>
      useTodoDiscussion({ threads: [{ id: 'thread', comments: [] }] })
    );
    await act(() => noUser.result.current.onAddComment('text'));
    await act(() => noUser.result.current.onVote('comment', 1));
    noUser.unmount();

    state.user = { id: 'user-1' };
    const active = renderHook(() =>
      useTodoDiscussion({ threads: [{ id: 'thread', comments: [] }] })
    );
    await act(() => active.result.current.onAddComment('   '));
    state.wait.mockRejectedValueOnce(new Error('failed'));
    await act(async () => {
      await expect(active.result.current.onAddComment(' top level ')).rejects.toThrow('failed');
    });
    expect(state.addComment).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: null, content: 'top level' })
    );
    expect(active.result.current.isSubmitting).toBe(false);
  });
});

describe('todos page remaining branches A09', () => {
  const normalTodo = (overrides: Record<string, unknown> = {}) => ({
    id: 'todo-1',
    title: 'Normal',
    status: 'pending',
    archived_at: null,
    creator: { id: 'user-1' },
    assignments: [],
    ...overrides,
  });

  it('combines active and archived data without forcing view state when no tutorial is visible', async () => {
    state.allTodos = [normalTodo()];
    state.archivedTodos = [normalTodo({ id: 'archived', archived_at: 1 })];
    state.filterModel.filteredTodos = [...state.allTodos, ...state.archivedTodos];
    const { result } = renderHook(() => useTodosPage());
    expect(result.current.filteredTodos).toHaveLength(2);
    act(() => result.current.setViewMode('list'));
    expect(result.current.viewMode).toBe('list');
    await act(() => result.current.handleToggleComplete(state.allTodos[0]));
    expect(state.updateTodoMutation).toHaveBeenCalledWith('todo-1', {
      status: 'completed',
      completed_at: expect.any(Number),
    });
    act(() => result.current.handleTodoClick(state.allTodos[0]));
    expect(result.current).toMatchObject({
      selectedTodo: state.allTodos[0],
      isDetailDialogOpen: true,
    });
  });

  it('keeps hidden active tutorial todos visible, omits archived ones, and resets archived/list state', async () => {
    const hiddenTutorial = normalTodo({
      id: 'tutorial',
      title: 'Network task',
      tutorial_run_id: 'run-1',
    });
    const hiddenArchivedTutorial = normalTodo({
      id: 'archived-tutorial',
      title: 'Archived task',
      tutorial_run_id: 'run-1',
      archived_at: 1,
    });
    state.allTodos = [hiddenTutorial, hiddenArchivedTutorial];
    state.filterModel = { ...baseFilterModel(), selectedTab: 'archived', filteredTodos: [] };
    const { result, unmount } = renderHook(() => useTodosPage());
    expect(result.current.filteredTodos).toEqual([hiddenTutorial]);
    expect(result.current.viewMode).toBe('kanban');
    expect(state.filterModel.setSelectedTab).toHaveBeenCalledWith('all');

    await act(() =>
      result.current.handleToggleComplete(normalTodo({ id: 'done', status: 'completed' }) as never)
    );
    expect(state.updateTodoMutation).toHaveBeenCalledWith('done', {
      status: 'pending',
      completed_at: null,
    });

    unmount();
    state.filterModel = { ...baseFilterModel(), selectedTab: 'all', filteredTodos: [] };
    renderHook(() => useTodosPage());
    expect(state.filterModel.setSelectedTab).not.toHaveBeenCalled();
  });
});

describe('kanban controller remaining branches A09', () => {
  const todo = (id: string, status = 'pending', title = 'Normal') =>
    ({ id, status, title, assignments: [] }) as never;

  it('builds all columns and guards unauthorized and empty drops', async () => {
    const todos = [
      todo('p', 'pending'),
      todo('i', 'in_progress'),
      todo('c', 'completed'),
      todo('x', 'cancelled'),
    ];
    const { result } = renderHook(() => useKanbanBoardController({ canManageTodos: false, todos }));
    expect(result.current.columns.map(column => column.todos.length)).toEqual([1, 1, 1, 1]);
    act(() => result.current.onCardDragStart(todos[0]));
    await act(() => result.current.onColumnDrop('completed'));
    expect(state.updateTodoAction).not.toHaveBeenCalled();

    const preventDefault = vi.fn();
    act(() => result.current.onColumnDragOver({ preventDefault } as never));
    expect(preventDefault).toHaveBeenCalled();
  });

  it('drops regular and missing todos, clears drag state, and reports mutation failures', async () => {
    const regular = todo('regular');
    const { result, rerender } = renderHook(
      ({ todos }) => useKanbanBoardController({ canManageTodos: true, todos }),
      { initialProps: { todos: [regular] } }
    );
    act(() => result.current.onCardDragStart(regular));
    await act(() => result.current.onColumnDrop('cancelled'));
    expect(state.updateTodoAction).toHaveBeenCalledWith({
      id: 'regular',
      status: 'cancelled',
      completed_at: null,
    });
    expect(result.current.draggedTodoId).toBeNull();

    act(() => result.current.onCardDragStart(regular));
    rerender({ todos: [] });
    await act(() => result.current.onColumnDrop('completed'));
    expect(state.report).not.toHaveBeenCalled();

    state.wait.mockRejectedValueOnce(new Error('drop failed'));
    act(() => result.current.onCardDragStart(regular));
    await act(() => result.current.onColumnDrop('pending'));
    expect(state.toastError).toHaveBeenCalled();
    expect(result.current.draggedTodoId).toBeNull();
  });

  it('suppresses drag clicks once, opens normal details, and exposes state setters', () => {
    const item = todo('one');
    const { result } = renderHook(() =>
      useKanbanBoardController({
        canManageTodos: true,
        todos: [item],
        virtualQuery: { query: 'x' },
      })
    );
    act(() => result.current.onCardMouseDown());
    act(() => result.current.onCardDragStart(item));
    act(() => result.current.onCardClick(item));
    expect(result.current.selectedTodo).toBeNull();
    act(() => result.current.onCardClick(item));
    expect(result.current.selectedTodo).toBe(item);
    act(() => result.current.onDetailDialogOpenChange(false));
    act(() => result.current.onCardDragEnd());
    expect(result.current).toMatchObject({ isDetailDialogOpen: false, draggedTodoId: null });
    expect(result.current.virtualQuery).toEqual({ query: 'x' });
  });

  it('toggles incomplete and complete todos and reports toggle errors', async () => {
    const pending = todo('pending');
    const completed = todo('completed', 'completed');
    const { result } = renderHook(() =>
      useKanbanBoardController({ canManageTodos: true, todos: [pending, completed] })
    );
    await act(() => result.current.onToggleComplete(pending));
    await act(() => result.current.onToggleComplete(completed));
    expect(state.updateTodoAction).toHaveBeenNthCalledWith(1, {
      id: 'pending',
      status: 'completed',
      completed_at: expect.any(Number),
    });
    expect(state.updateTodoAction).toHaveBeenNthCalledWith(2, {
      id: 'completed',
      status: 'pending',
      completed_at: null,
    });
    state.wait.mockRejectedValueOnce(new Error('toggle failed'));
    await act(() => result.current.onToggleComplete(pending));
    expect(state.toastError).toHaveBeenCalled();
  });
});
