/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useKanbanBoardController } from '../useKanbanBoardController';

const mocks = vi.hoisted(() => ({
  reportAppTutorialAction: vi.fn(),
  updateTodo: vi.fn(),
}));

vi.mock('@/features/app-tutorial/events', () => ({
  reportAppTutorialAction: mocks.reportAppTutorialAction,
}));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/zero/todos/useTodoActions.ts', () => ({
  useTodoActions: () => ({
    updateTodo: mocks.updateTodo,
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('useKanbanBoardController', () => {
  it('completes the tutorial network task through a kanban drop', async () => {
    mocks.updateTodo.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({ type: 'success' }),
    });
    const todo = {
      id: 'network-todo',
      title: 'Münchner Klimarat verknüpfen',
      status: 'pending',
      tutorial_run_id: 'tutorial-run',
    };
    const { result } = renderHook(() =>
      useKanbanBoardController({
        canManageTodos: true,
        todos: [todo] as never,
      })
    );

    act(() => {
      result.current.onCardDragStart(todo as never);
    });
    await act(async () => {
      await result.current.onColumnDrop('completed');
    });

    expect(mocks.updateTodo).toHaveBeenCalledWith({
      id: 'network-todo',
      status: 'completed',
      completed_at: expect.any(Number),
    });
    expect(mocks.reportAppTutorialAction).toHaveBeenCalledWith({
      type: 'drop',
      event: 'todo.completed',
    });
  });

  it('starts the assistant-created tutorial task through a kanban drop', async () => {
    mocks.updateTodo.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({ type: 'success' }),
    });
    const todo = {
      id: 'assistant-todo',
      title: 'Die Welt zu einem besseren Ort machen',
      status: 'pending',
      tutorial_run_id: 'tutorial-run',
    };
    const { result } = renderHook(() =>
      useKanbanBoardController({
        canManageTodos: true,
        todos: [todo] as never,
      })
    );

    act(() => {
      result.current.onCardDragStart(todo as never);
    });
    await act(async () => {
      await result.current.onColumnDrop('in_progress');
    });

    expect(mocks.updateTodo).toHaveBeenCalledWith({
      id: 'assistant-todo',
      status: 'in_progress',
      completed_at: null,
    });
    expect(mocks.reportAppTutorialAction).toHaveBeenCalledWith({
      type: 'mutation',
      event: 'todo.in-progress',
    });
  });
});
