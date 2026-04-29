import { TodoTimelineCard } from '@/features/timeline/ui/cards/TodoTimelineCard';
import type { Todo } from '../types/todo.types';

interface TodoListProps {
  todos: Todo[];
  onToggleComplete: (todo: Todo) => void;
  onTodoClick?: (todo: Todo) => void;
}

export function TodoList({ todos, onToggleComplete, onTodoClick }: TodoListProps) {
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
            status: todo.status ?? undefined,
            creatorId: todo.creator?.id ?? undefined,
          }}
          onToggle={() => onToggleComplete(todo)}
          onCardClick={() => onTodoClick?.(todo)}
          linkToDetail={false}
          showStatusAction={false}
        />
      ))}
    </div>
  );
}
