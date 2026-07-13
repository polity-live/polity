'use client';

import { useKanbanBoardController } from '@/features/todos/hooks/useKanbanBoardController';

import type { Todo } from '../types/todo.types';
import { KanbanBoardShellView } from './KanbanBoardShellView';

interface KanbanBoardProps {
  canManageTodos?: boolean;
  todos: Todo[];
  virtualQuery?: { query: string };
}

export function KanbanBoard({ canManageTodos = true, todos, virtualQuery }: KanbanBoardProps) {
  const controller = useKanbanBoardController({ canManageTodos, todos, virtualQuery });
  return <KanbanBoardShellView canManageTodos={canManageTodos} controller={controller} />;
}
