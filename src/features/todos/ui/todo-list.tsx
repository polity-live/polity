import { TodoTimelineCard } from '@/features/timeline/ui/cards/TodoTimelineCard';
import type { Todo, TodoStatus } from '../types/todo.types';

function isTodoStatus(status: string | null | undefined): status is TodoStatus {
  return (
    status === 'pending' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'cancelled'
  );
}

interface TodoListProps {
  canManageTodos?: boolean;
  todos: Todo[];
  onToggleComplete: (todo: Todo) => void;
  onTodoClick?: (todo: Todo) => void;
}

export function TodoList({
  canManageTodos = true,
  todos,
  onToggleComplete,
  onTodoClick,
}: TodoListProps) {
  return (
    <div className="space-y-3">
      {todos.map(todo => (
        <TodoTimelineCard
          key={todo.id}
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
          onCardClick={() => onTodoClick?.(todo)}
          linkToDetail={false}
          showStatusAction={false}
        />
      ))}
    </div>
  );
}
