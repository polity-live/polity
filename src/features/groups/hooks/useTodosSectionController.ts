import { useState } from 'react';

import { useTodoFilters } from '@/features/todos/hooks/useTodoFilters';
import type { Todo } from '@/features/todos/types/todo.types';

interface UseTodosSectionControllerProps {
  groupId: string;
  storageKey: string;
  todos: Todo[];
}

export function useTodosSectionController({
  groupId,
  storageKey,
  todos,
}: UseTodosSectionControllerProps) {
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const filters = useTodoFilters(todos, undefined, {
    storageKey,
    groupId,
    includeStatusQuickFilter: true,
  });

  const handleTodoClick = (todo: Todo) => {
    setSelectedTodo(todo);
    setIsDetailDialogOpen(true);
  };

  return {
    ...filters,
    isDetailDialogOpen,
    selectedTodo,
    onDetailDialogOpenChange: setIsDetailDialogOpen,
    onTodoClick: handleTodoClick,
  };
}
