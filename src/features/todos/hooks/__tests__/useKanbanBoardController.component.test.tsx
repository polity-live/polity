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

  it.each(['success', 'error'] as const)(
    'waits for a server %s before completing an optimistic tutorial drop',
    async type => {
      let settle!: (value: { type: 'success' | 'error' }) => void;
      mocks.updateTodo.mockReturnValue({
        client: Promise.resolve(),
        server: new Promise(resolve => {
          settle = resolve;
        }),
      });
      const todo = {
        id: 'assistant-todo',
        title: 'Die Welt zu einem besseren Ort machen',
        status: 'pending',
        tutorial_run_id: 'tutorial-run',
      };
      const { result } = renderHook(() =>
        useKanbanBoardController({ canManageTodos: true, todos: [todo] as never })
      );
      act(() => result.current.onCardDragStart(todo as never));
      let drop!: Promise<void>;
      await act(async () => {
        drop = result.current.onColumnDrop('in_progress');
        await Promise.resolve();
      });
      expect(mocks.reportAppTutorialAction).not.toHaveBeenCalled();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        await act(async () => {
          settle({ type });
          await drop;
        });
        expect(mocks.reportAppTutorialAction).toHaveBeenCalledTimes(type === 'success' ? 1 : 0);
        expect(result.current.draggedTodoId).toBeNull();
      } finally {
        consoleError.mockRestore();
      }
    }
  );
});
