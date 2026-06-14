'use client';

import { useRef, useState } from 'react';
import { useTodoActions } from '@/zero/todos/useTodoActions.ts';
import { toast } from 'sonner';
import { TodoDetailDialog } from './todo-detail-dialog.tsx';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import type { Todo, TodoStatus } from '../types/todo.types';
import { KanbanBoardView, type KanbanColumn } from './kanban-board-view';

interface KanbanBoardProps {
  canManageTodos?: boolean;
  todos: Todo[];
}

export function KanbanBoard({ canManageTodos = true, todos }: KanbanBoardProps) {
  const { t } = useTranslation();
  const { updateTodo } = useTodoActions();
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const dragClickSuppressionRef = useRef<string | null>(null);

  const columns: KanbanColumn[] = [
    {
      id: 'pending',
      title: t('features.todos.kanban.toDo'),
      todos: todos.filter(todo => todo.status === 'pending'),
      className: 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-black',
    },
    {
      id: 'in_progress',
      title: t('features.todos.kanban.inProgress'),
      todos: todos.filter(todo => todo.status === 'in_progress'),
      className: 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-black',
    },
    {
      id: 'completed',
      title: t('features.todos.kanban.completed'),
      todos: todos.filter(todo => todo.status === 'completed'),
      className: 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-black',
    },
    {
      id: 'cancelled',
      title: t('features.todos.kanban.cancelled'),
      todos: todos.filter(todo => todo.status === 'cancelled'),
      className: 'border border-slate-200 bg-white dark:border-slate-800 dark:bg-black',
    },
  ];

  const handleDragStart = (todoId: string) => {
    if (!canManageTodos) {
      return;
    }

    setDraggedTodoId(todoId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: TodoStatus) => {
    if (!canManageTodos || !draggedTodoId) return;

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

  const handleTodoClick = (todo: Todo) => {
    if (dragClickSuppressionRef.current === todo.id) {
      dragClickSuppressionRef.current = null;
      return;
    }

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

  const handleCardMouseDown = () => {
    dragClickSuppressionRef.current = null;
  };

  const handleCardDragStart = (todo: Todo) => {
    dragClickSuppressionRef.current = todo.id;
    handleDragStart(todo.id);
  };

  const handleCardDragEnd = () => {
    setDraggedTodoId(null);
  };

  return (
    <>
      <KanbanBoardView
        canManageTodos={canManageTodos}
        columns={columns}
        tasksLabel={t('features.todos.kanban.tasks')}
        draggedTodoId={draggedTodoId}
        onColumnDragOver={handleDragOver}
        onColumnDrop={handleDrop}
        onCardMouseDown={handleCardMouseDown}
        onCardDragStart={handleCardDragStart}
        onCardDragEnd={handleCardDragEnd}
        onCardClick={handleTodoClick}
        onToggleComplete={handleToggleComplete}
      />

      {selectedTodo && (
        <TodoDetailDialog
          canManageTodos={canManageTodos}
          todo={selectedTodo}
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
        />
      )}
    </>
  );
}
