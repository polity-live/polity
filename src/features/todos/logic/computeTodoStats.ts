import type { Todo } from '../types/todo.types';

export interface TodoStatusCounts {
  all: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  archived: number;
}

/**
 * Pure function that computes status counts from a list of todos,
 * filtered to those owned by or assigned to the given user.
 *
 * Extracted from the former `useTodoStats` hook so it can be called
 * inside a `useMemo` (or elsewhere) without carrying a React dependency.
 */
export function computeTodoStats(
  todos: Todo[] | undefined,
  userId: string | undefined
): TodoStatusCounts {
  if (!todos) {
    return { all: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0, archived: 0 };
  }

  const userTodos = todos.filter(
    todo => todo.creator?.id === userId || todo.assignments?.some(a => a.user?.id === userId)
  );

  const activeTodos = userTodos.filter(todo => !todo.archived_at);

  return {
    all: activeTodos.length,
    pending: activeTodos.filter(t => t.status === 'pending').length,
    in_progress: activeTodos.filter(t => t.status === 'in_progress').length,
    completed: activeTodos.filter(t => t.status === 'completed').length,
    cancelled: activeTodos.filter(t => t.status === 'cancelled').length,
    archived: userTodos.filter(todo => Boolean(todo.archived_at)).length,
  };
}
