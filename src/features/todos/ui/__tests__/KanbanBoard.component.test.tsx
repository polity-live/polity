/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/zero/todos/useTodoActions.ts', () => ({
  useTodoActions: () => ({
    updateTodo: vi.fn(),
  }),
}));

vi.mock('../todo-detail-dialog.tsx', () => ({
  TodoDetailDialog: () => <div data-testid="todo-detail-dialog" />,
}));

vi.mock('@/features/timeline/ui/cards/TodoTimelineCard', () => ({
  TodoTimelineCard: ({ onCardClick }: { onCardClick?: () => void }) => (
    <button type="button" data-testid="todo-card" onClick={onCardClick}>
      Todo
    </button>
  ),
}));

vi.mock('@/features/shared/virtualization', () => ({
  PolityLocalListView: ({ items, renderItem }: any) => (
    <div>
      {items.map((item: any) => (
        <div key={item.id}>{renderItem(item)}</div>
      ))}
    </div>
  ),
  rowAttributes: () => ({}),
  usePolityZeroList: () => ({
    items: [
      {
        index: 0,
        key: 'todo-virtual',
        row: {
          id: 'todo-virtual',
          title: 'Virtual Todo',
          status: 'pending',
          priority: 'medium',
          assignments: [],
        },
      },
    ],
    spaceAfter: 0,
    spaceBefore: 0,
  }),
  ZeroVirtualSpacer: () => null,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { KanbanBoard } from '../kanban-board';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const todos = [
  {
    id: 'todo-1',
    title: 'Todo One',
    description: null,
    status: 'pending',
    priority: 'medium',
    due_date: null,
    completed_at: null,
    tags: [],
    visibility: 'group',
    group: { id: 'group-1', name: 'Group One' },
    assignments: [],
    creator: { id: 'user-1' },
  },
];

describe('KanbanBoard', () => {
  it('disables drag-and-drop without manage rights', () => {
    render(<KanbanBoard canManageTodos={false} todos={todos as never} />);

    const draggableWrapper = screen.getByTestId('todo-card').parentElement;
    expect(draggableWrapper?.getAttribute('draggable')).toBe('false');
    expect(draggableWrapper?.getAttribute('data-action-id')).toBe('todos.kanban.card.interact');
  });

  it('keeps virtualized cards under a distinct stable interaction intent', () => {
    render(
      <KanbanBoard canManageTodos={false} todos={todos as never} virtualQuery={{ query: '' }} />
    );

    expect(
      document.querySelector('[data-action-id="todos.kanban.card.virtual.interact"]')
    ).toBeTruthy();
  });

  it('exposes the tutorial task as a spotlight target in kanban view', () => {
    render(
      <KanbanBoard
        canManageTodos={false}
        todos={[{ ...todos[0], tutorial_run_id: 'tutorial-run-1' }] as never}
      />
    );

    const cardWrapper = screen.getByTestId('todo-card').parentElement;
    expect(cardWrapper?.getAttribute('data-tutorial-anchor')).toBe('tutorial-network-todo');
    expect(
      document.querySelector('[data-tutorial-anchor="tutorial-network-todo-board"]')
    ).toBeTruthy();
    expect(document.querySelector('[data-todo-status="completed"]')).toBeTruthy();
  });

  it('exposes the assistant-created tutorial task and all drop columns as one target', () => {
    render(
      <KanbanBoard
        canManageTodos
        todos={
          [
            {
              ...todos[0],
              title: 'Die Welt zu einem besseren Ort machen',
              tutorial_run_id: 'tutorial-run-1',
            },
          ] as never
        }
      />
    );

    const board = document.querySelector('[data-tutorial-anchor="tutorial-assistant-todo-board"]');
    expect(board).toBeTruthy();
    expect(board?.contains(document.querySelector('[data-todo-status="in_progress"]'))).toBe(true);
    expect(board?.contains(screen.getByTestId('todo-card'))).toBe(true);
  });
});
