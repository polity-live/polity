'use client';

import { useKanbanBoardController } from '@/features/todos/hooks/useKanbanBoardController';

import type { Todo } from '../types/todo.types';
import { KanbanBoardShellView } from './KanbanBoardShellView';

interface KanbanBoardProps {
  canManageTodos?: boolean;
  todos: Todo[];
}

export function KanbanBoard({ canManageTodos = true, todos }: KanbanBoardProps) {
  const controller = useKanbanBoardController({ canManageTodos, todos });
  return <KanbanBoardShellView canManageTodos={canManageTodos} controller={controller} />;
}
