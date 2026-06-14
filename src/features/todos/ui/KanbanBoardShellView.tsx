import { KanbanBoardView } from './kanban-board-view';
import { TodoDetailDialog } from './todo-detail-dialog.tsx';

export interface KanbanBoardShellViewProps {
  canManageTodos: boolean;
  controller: any;
}

export function KanbanBoardShellView({ canManageTodos, controller }: KanbanBoardShellViewProps) {
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
