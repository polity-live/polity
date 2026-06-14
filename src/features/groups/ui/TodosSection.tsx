import { useTodosSectionController } from '../hooks/useTodosSectionController';
import type { TodoViewMode } from '../types/group.types';
import type { Todo } from '@/features/todos/types/todo.types';
import { TodosSectionView } from './TodosSectionView';

interface TodosSectionProps {
  canManageTodos?: boolean;
  groupId: string;
  storageKey: string;
  todos: Todo[];
  viewMode: TodoViewMode;
  onViewModeChange: (mode: TodoViewMode) => void;
  onToggleComplete: (todo: Todo) => void;
}

export function TodosSection({
  canManageTodos = true,
  groupId,
  storageKey,
  todos,
  viewMode,
  onViewModeChange,
  onToggleComplete,
}: TodosSectionProps) {
  return (
    <TodosSectionView
      canManageTodos={canManageTodos}
      groupId={groupId}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      onToggleComplete={onToggleComplete}
      {...useTodosSectionController({ groupId, storageKey, todos })}
    />
  );
}
