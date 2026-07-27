import { useRef, useState } from 'react';

import { featureThemeClassName } from '@/features/shared/theme';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useTodoActions } from '@/zero/todos/useTodoActions.ts';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { reportAppTutorialAction } from '@/features/app-tutorial/events';

import type { Todo, TodoStatus } from '../types/todo.types';
import { getTodoTutorialAnchor } from '../logic/tutorialTodoAnchor';
import type { KanbanColumn } from '../ui/kanban-board-view';

interface UseKanbanBoardControllerProps {
  canManageTodos: boolean;
  todos: Todo[];
  virtualQuery?: { query: string };
}

export function useKanbanBoardController({
  canManageTodos,
  todos,
  virtualQuery,
}: UseKanbanBoardControllerProps) {
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
      className: featureThemeClassName('todoUseKanbanBoardNeutralContrastSurface'),
    },
    {
      id: 'in_progress',
      title: t('features.todos.kanban.inProgress'),
      todos: todos.filter(todo => todo.status === 'in_progress'),
      className: featureThemeClassName('todoUseKanbanBoardNeutralContrastSurface'),
    },
    {
      id: 'completed',
      title: t('features.todos.kanban.completed'),
      todos: todos.filter(todo => todo.status === 'completed'),
      className: featureThemeClassName('todoUseKanbanBoardNeutralContrastSurface'),
    },
    {
      id: 'cancelled',
      title: t('features.todos.kanban.cancelled'),
      todos: todos.filter(todo => todo.status === 'cancelled'),
      className: featureThemeClassName('todoUseKanbanBoardNeutralContrastSurface'),
    },
  ];

  const handleDragStart = (todoId: string) => {
    if (!canManageTodos) {
      return;
    }

    setDraggedTodoId(todoId);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = async (status: TodoStatus) => {
    if (!canManageTodos || !draggedTodoId) return;

    try {
      const draggedTodo = todos.find(todo => todo.id === draggedTodoId);
      const updates: Parameters<typeof updateTodo>[0] = {
        id: draggedTodoId,
        status,
        completed_at: status === 'completed' ? Date.now() : null,
      };

      await waitForClientApply(updateTodo(updates));
      if (
        status === 'completed' &&
        draggedTodo &&
        getTodoTutorialAnchor(draggedTodo) === 'tutorial-network-todo'
      ) {
        reportAppTutorialAction({ type: 'drop', event: 'todo.completed' });
      }
      if (
        status === 'in_progress' &&
        draggedTodo &&
        getTodoTutorialAnchor(draggedTodo) === 'tutorial-assistant-todo'
      ) {
        reportAppTutorialAction({ type: 'mutation', event: 'todo.in-progress' });
      }
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
      await waitForClientApply(
        updateTodo({
          id: todo.id,
          status: isCompleting ? 'completed' : 'pending',
          completed_at: isCompleting ? Date.now() : null,
        })
      );
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

  return {
    columns,
    virtualQuery,
    draggedTodoId,
    isDetailDialogOpen,
    selectedTodo,
    tasksLabel: t('features.todos.kanban.tasks'),
    onCardClick: handleTodoClick,
    onCardDragEnd: () => setDraggedTodoId(null),
    onCardDragStart: handleCardDragStart,
    onCardMouseDown: handleCardMouseDown,
    onColumnDragOver: handleDragOver,
    onColumnDrop: handleDrop,
    onDetailDialogOpenChange: setIsDetailDialogOpen,
    onToggleComplete: handleToggleComplete,
  };
}
