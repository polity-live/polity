import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@rocicorp/zero/react';

import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';
import { usePermissions } from '@/zero/rbac';
import type { TodoActivityRow } from '@/zero/todos/queries';

export type TodoActivitySeverityFilter = 'all' | 'normal' | 'high';

export interface TodoActivityController {
  activities: readonly TodoActivityRow[];
  canViewActivity: boolean;
  isLoading: boolean;
  severity: TodoActivitySeverityFilter;
  setSeverity: (severity: TodoActivitySeverityFilter) => void;
}

export function useTodoActivity(todo: any, active = true): TodoActivityController {
  const { user } = useAuth();
  const { canManage } = usePermissions({ groupId: todo?.group_id ?? undefined });
  const [severity, setSeverity] = useState<TodoActivitySeverityFilter>('all');

  useEffect(() => {
    if (!active) setSeverity('all');
  }, [active]);

  useEffect(() => {
    setSeverity('all');
  }, [todo?.id]);

  const canViewActivity = useMemo(() => {
    if (!user?.id || !todo) return false;
    if (todo.creator_id === user.id) return true;
    if (todo.assignments?.some((assignment: any) => assignment.user_id === user.id)) return true;
    return Boolean(todo.group_id && canManage('groupTodos'));
  }, [canManage, todo, user?.id]);

  const [activities, result] = useQuery(
    active && canViewActivity && todo?.id
      ? queries.todos.activities({ todo_id: todo.id, severity })
      : undefined
  );

  return {
    activities: activities ?? [],
    canViewActivity,
    isLoading: active && canViewActivity && result.type === 'unknown',
    severity,
    setSeverity,
  };
}
