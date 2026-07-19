import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { queries } from '../queries';

/**
 * Reactive state hook for todo data.
 * Returns all query-derived state — no mutations.
 */
export function useTodoState(args: {
  groupId?: string;
  todoId?: string;
  userId?: string;
  includeArchived?: boolean;
}) {
  // All todos with relations (for client-side user filtering)
  const [activeTodos, allTodosResult] = useQuery(
    queries.todos.allWithRelations({ archive: 'active' })
  );
  const [archivedTodos, archivedTodosResult] = useQuery(
    args.includeArchived ? queries.todos.allWithRelations({ archive: 'archived' }) : undefined
  );

  // Todos for a specific group with relations
  const [groupTodos, groupTodosResult] = useQuery(
    args.groupId
      ? queries.todos.byGroupWithRelations({ group_id: args.groupId, archive: 'active' })
      : undefined
  );

  // Single todo by ID with relations
  const [todo, todoResult] = useQuery(
    args.todoId ? queries.todos.byIdWithRelations({ id: args.todoId }) : undefined
  );

  // Assignments for a specific todo
  const [assignments] = useQuery(
    args.todoId ? queries.todos.assignments({ todo_id: args.todoId }) : undefined
  );

  // User-filtered todos
  const userTodos = useMemo(() => {
    if (!activeTodos || !args.userId) return activeTodos ?? [];
    return activeTodos.filter(
      t => t.creator?.id === args.userId || t.assignments?.some(a => a.user?.id === args.userId)
    );
  }, [activeTodos, args.userId]);

  // Derived status buckets
  const openTodos = useMemo(
    () => userTodos.filter(t => t.status === 'open' || t.status === 'pending'),
    [userTodos]
  );
  const completedTodos = useMemo(
    () => userTodos.filter(t => t.status === 'completed'),
    [userTodos]
  );
  const inProgressTodos = useMemo(
    () => userTodos.filter(t => t.status === 'in_progress'),
    [userTodos]
  );

  const isLoading =
    allTodosResult.type === 'unknown' ||
    (args.includeArchived ? archivedTodosResult.type === 'unknown' : false) ||
    (args.groupId ? groupTodosResult.type === 'unknown' : false) ||
    (args.todoId ? todoResult.type === 'unknown' : false);

  return {
    userTodos,
    allTodos: activeTodos ?? [],
    archivedTodos: archivedTodos ?? [],
    groupTodos,
    todo,
    assignments,
    openTodos,
    completedTodos,
    inProgressTodos,
    isLoading,
  };
}
