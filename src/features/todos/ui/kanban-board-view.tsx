import type { DragEventHandler } from 'react';

import { TodoTimelineCard } from '@/features/timeline/ui/cards/TodoTimelineCard';
import { cn } from '@/features/shared/utils/utils';
import type { Todo, TodoStatus } from '../types/todo.types';

interface KanbanColumn {
  id: TodoStatus;
  title: string;
  todos: Todo[];
  className?: string;
}

interface KanbanBoardViewProps {
  canManageTodos: boolean;
  columns: KanbanColumn[];
  tasksLabel: string;
  draggedTodoId: string | null;
  onColumnDragOver: DragEventHandler<HTMLDivElement>;
  onColumnDrop: (status: TodoStatus) => void;
  onCardMouseDown: (todo: Todo) => void;
  onCardDragStart: (todo: Todo) => void;
  onCardDragEnd: (todo: Todo) => void;
  onCardClick: (todo: Todo) => void;
  onToggleComplete: (todo: Todo) => void;
}

function isTodoStatus(status: string | null | undefined): status is TodoStatus {
  return (
    status === 'pending' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'cancelled'
  );
}

export function KanbanBoardView({
  canManageTodos,
  columns,
  tasksLabel,
  draggedTodoId,
  onColumnDragOver,
  onColumnDrop,
  onCardMouseDown,
  onCardDragStart,
  onCardDragEnd,
  onCardClick,
  onToggleComplete,
}: KanbanBoardViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {columns.map(column => (
        <div
          key={column.id}
          className={cn('min-h-125 rounded-lg p-4', column.className)}
          onDragOver={onColumnDragOver}
          onDrop={() => onColumnDrop(column.id)}
        >
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{column.title}</h3>
            <p className="text-muted-foreground text-sm">
              {column.todos.length} {tasksLabel}
            </p>
          </div>

          <div className="space-y-3">
            {column.todos.map(todo => (
              <TodoKanbanCardView
                key={todo.id}
                canManageTodos={canManageTodos}
                todo={todo}
                isDragging={draggedTodoId === todo.id}
                onMouseDown={onCardMouseDown}
                onDragStart={onCardDragStart}
                onDragEnd={onCardDragEnd}
                onClick={onCardClick}
                onToggleComplete={onToggleComplete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TodoKanbanCardViewProps {
  canManageTodos: boolean;
  todo: Todo;
  onMouseDown: (todo: Todo) => void;
  onDragStart: (todo: Todo) => void;
  onDragEnd: (todo: Todo) => void;
  onClick: (todo: Todo) => void;
  onToggleComplete: (todo: Todo) => void;
  isDragging: boolean;
}

export function TodoKanbanCardView({
  canManageTodos,
  todo,
  onMouseDown,
  onDragStart,
  onDragEnd,
  onClick,
  onToggleComplete,
  isDragging,
}: TodoKanbanCardViewProps) {
  return (
    <div
      draggable={canManageTodos}
      onMouseDown={() => onMouseDown(todo)}
      onDragStart={canManageTodos ? () => onDragStart(todo) : undefined}
      onDragEnd={() => onDragEnd(todo)}
      className={isDragging ? 'opacity-50' : undefined}
      data-swipe-lock
    >
      <TodoTimelineCard
        todo={{
          id: todo.id,
          title: todo.title ?? '',
          description: todo.description ?? undefined,
          isCompleted: todo.status === 'completed',
          dueDate: todo.due_date ?? undefined,
          assigneeCount: todo.assignments?.length,
          groupName: todo.group?.name ?? undefined,
          groupId: todo.group?.id ?? undefined,
          status: isTodoStatus(todo.status) ? todo.status : undefined,
          creatorId: todo.creator?.id ?? undefined,
        }}
        canManageTodos={canManageTodos}
        onToggle={canManageTodos ? () => onToggleComplete(todo) : undefined}
        onCardClick={() => onClick(todo)}
        linkToDetail={false}
        showStatusAction={false}
      />
    </div>
  );
}

export type { KanbanColumn, KanbanBoardViewProps };
