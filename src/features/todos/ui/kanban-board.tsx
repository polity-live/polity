'use client';

import { useKanbanBoardController } from '@/features/todos/hooks/useKanbanBoardController';

import type { Todo } from '../types/todo.types';
import { KanbanBoardView } from './kanban-board-view';
import { TodoDetailDialog } from './todo-detail-dialog.tsx';

interface KanbanBoardProps {
  canManageTodos?: boolean;
  todos: Todo[];
}

export function KanbanBoard({ canManageTodos = true, todos }: KanbanBoardProps) {
  const controller = useKanbanBoardController({ canManageTodos, todos });

  return (
    <>
      <KanbanBoardView
        canManageTodos={canManageTodos}
        columns={controller.columns}
        tasksLabel={controller.tasksLabel}
        draggedTodoId={controller.draggedTodoId}
        onColumnDragOver={controller.onColumnDragOver}
        onColumnDrop={controller.onColumnDrop}
        onCardMouseDown={controller.onCardMouseDown}
        onCardDragStart={controller.onCardDragStart}
        onCardDragEnd={controller.onCardDragEnd}
        onCardClick={controller.onCardClick}
        onToggleComplete={controller.onToggleComplete}
      />

      {controller.selectedTodo && (
        <TodoDetailDialog
          canManageTodos={canManageTodos}
          todo={controller.selectedTodo}
          open={controller.isDetailDialogOpen}
          onOpenChange={controller.onDetailDialogOpenChange}
        />
      )}
    </>
  );
}
