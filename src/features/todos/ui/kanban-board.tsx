'use client';

import { useState } from 'react';
import { useTodoActions } from '@/zero/todos/useTodoActions.ts';
import { toast } from 'sonner';
import { TodoDetailDialog } from './todo-detail-dialog.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { TodoTimelineCard } from '@/features/timeline/ui/cards/TodoTimelineCard';
import type { Todo, TodoStatus } from '../types/todo.types';

interface KanbanBoardProps {
  todos: Todo[];
}

function isTodoStatus(status: string | null | undefined): status is TodoStatus {
  return (
    status === 'pending' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'cancelled'
  );
}

export function KanbanBoard({ todos }: KanbanBoardProps) {
  const { t } = useTranslation();
  const { updateTodo } = useTodoActions();
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const COLUMNS: { id: TodoStatus; titleKey: string; color: string }[] = [
    {
      id: 'pending',
      titleKey: 'features.todos.kanban.toDo',
      color: 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-black',
    },
    {
      id: 'in_progress',
      titleKey: 'features.todos.kanban.inProgress',
      color: 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-black',
    },
    {
      id: 'completed',
      titleKey: 'features.todos.kanban.completed',
      color: 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-black',
    },
    {
      id: 'cancelled',
      titleKey: 'features.todos.kanban.cancelled',
      color: 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-black',
    },
  ];

  const handleDragStart = (todoId: string) => {
    setDraggedTodoId(todoId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: TodoStatus) => {
    if (!draggedTodoId) return;

    try {
      const updates: Parameters<typeof updateTodo>[0] = {
        id: draggedTodoId,
        status,
        completed_at: status === 'completed' ? Date.now() : null,
      };

      await updateTodo(updates);
      toast.success(t('features.todos.kanban.statusUpdated'));
    } catch (error) {
      console.error('Failed to update todo:', error);
      toast.error(t('features.todos.kanban.updateFailed'));
    } finally {
      setDraggedTodoId(null);
    }
  };

  const getTodosByStatus = (status: TodoStatus) => {
    return todos.filter(todo => todo.status === status);
  };

  const handleTodoClick = (todo: Todo) => {
    setSelectedTodo(todo);
    setIsDetailDialogOpen(true);
  };

  const handleToggleComplete = async (todo: Todo) => {
    try {
      const isCompleting = todo.status !== 'completed';
      await updateTodo({
        id: todo.id,
        status: isCompleting ? 'completed' : 'pending',
        completed_at: isCompleting ? Date.now() : null,
      });
      toast.success(t('features.todos.kanban.statusUpdated'));
    } catch (error) {
      console.error('Failed to toggle todo completion:', error);
      toast.error(t('features.todos.kanban.updateFailed'));
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map(column => {
          const columnTodos = getTodosByStatus(column.id);

          return (
            <div
              key={column.id}
              className={`rounded-lg ${column.color} min-h-125 p-4`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{t(column.titleKey)}</h3>
                <p className="text-muted-foreground text-sm">
                  {columnTodos.length} {t('features.todos.kanban.tasks')}
                </p>
              </div>

              <div className="space-y-3">
                {columnTodos.map(todo => (
                  <TodoKanbanTimelineCard
                    key={todo.id}
                    todo={todo}
                    onDragStart={handleDragStart}
                    onClick={handleTodoClick}
                    onToggleComplete={handleToggleComplete}
                    isDragging={draggedTodoId === todo.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTodo && (
        <TodoDetailDialog
          todo={selectedTodo}
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
        />
      )}
    </>
  );
}

interface TodoKanbanTimelineCardProps {
  todo: Todo;
  onDragStart: (todoId: string) => void;
  onClick: (todo: Todo) => void;
  onToggleComplete: (todo: Todo) => void;
  isDragging: boolean;
}

function TodoKanbanTimelineCard({
  todo,
  onDragStart,
  onClick,
  onToggleComplete,
  isDragging,
}: TodoKanbanTimelineCardProps) {
  const [isDraggingCard, setIsDraggingCard] = useState(false);

  const handleMouseDown = () => {
    setIsDraggingCard(false);
  };

  const handleDragStart = () => {
    setIsDraggingCard(true);
    onDragStart(todo.id);
  };

  const handleClick = () => {
    // Only trigger click if we didn't drag
    if (!isDraggingCard) {
      onClick(todo);
    }
    setIsDraggingCard(false);
  };

  return (
    <div
      draggable
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDraggingCard(false)}
      className={isDragging ? 'opacity-50' : undefined}
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
        onToggle={() => onToggleComplete(todo)}
        onCardClick={handleClick}
        linkToDetail={false}
        showStatusAction={false}
      />
    </div>
  );
}
