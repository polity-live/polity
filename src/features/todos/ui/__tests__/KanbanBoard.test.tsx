/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
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
  TodoTimelineCard: () => <div data-testid="todo-card" />,
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
  });
});
