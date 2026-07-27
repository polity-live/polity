import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useTodoState } from '@/zero/todos/useTodoState';
import { useTodoMutations } from '@/features/todos/hooks/useTodoMutations';
import { useTodoFilters } from '@/features/todos/hooks/useTodoFilters';
import { computeTodoStats } from '../logic/computeTodoStats';
import type { Todo } from '../types/todo.types';
import type { ViewMode } from '../ui/TodosHeader';
import { getTodoTutorialAnchor } from '../logic/tutorialTodoAnchor';

export function useTodosPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const { updateTodo } = useTodoMutations();
  const { allTodos, archivedTodos } = useTodoState({ includeArchived: true });

  const todosTyped = useMemo(() => [...allTodos, ...archivedTodos], [allTodos, archivedTodos]);

  const {
    fields,
    quickFilters,
    searchQuery,
    setSearchQuery,
    quickFilterValues,
    setQuickFilterValues,
    toggleQuickFilterValue,
    clearQuickFilter,
    savedFilters,
    saveCustomFilter,
    deleteCustomFilter,
    activeCustomFilterIds,
    toggleCustomFilter,
    selectedTab,
    setSelectedTab,
    filteredTodos,
  } = useTodoFilters(todosTyped, user?.id, { storageKey: 'todos-page' });

  const statusCounts = useMemo(
    () => computeTodoStats(todosTyped, user?.id),
    [todosTyped, user?.id]
  );
  const tutorialVisibleTodos = useMemo(() => {
    const visibleIds = new Set(filteredTodos.map(todo => todo.id));
    const hiddenTutorialTodos = todosTyped.filter(
      todo => !visibleIds.has(todo.id) && Boolean(getTodoTutorialAnchor(todo)) && !todo.archived_at
    );
    return [...filteredTodos, ...hiddenTutorialTodos];
  }, [filteredTodos, todosTyped]);
  const hasVisibleTutorialTodo = tutorialVisibleTodos.some(todo =>
    Boolean(getTodoTutorialAnchor(todo))
  );

  useEffect(() => {
    if (!hasVisibleTutorialTodo) return;
    setViewMode('kanban');
    if (selectedTab === 'archived') {
      setSelectedTab('all');
    }
  }, [hasVisibleTutorialTodo, selectedTab, setSelectedTab]);

  // ── Business logic ────────────────────────────────────────────────

  const handleToggleComplete = async (todo: Todo) => {
    const isCompleting = todo.status !== 'completed';
    await updateTodo(todo.id, {
      status: isCompleting ? 'completed' : 'pending',
      completed_at: isCompleting ? Date.now() : null,
    });
  };

  const handleTodoClick = (todo: Todo) => {
    setSelectedTodo(todo);
    setIsDetailDialogOpen(true);
  };

  return {
    // Auth
    user,

    // View mode
    viewMode,
    setViewMode,

    // Detail dialog
    selectedTodo,
    isDetailDialogOpen,
    setIsDetailDialogOpen,

    // Filters (pass-through from useTodoFilters)
    fields,
    quickFilters,
    searchQuery,
    setSearchQuery,
    quickFilterValues,
    setQuickFilterValues,
    toggleQuickFilterValue,
    clearQuickFilter,
    savedFilters,
    saveCustomFilter,
    deleteCustomFilter,
    activeCustomFilterIds,
    toggleCustomFilter,
    selectedTab,
    setSelectedTab,
    filteredTodos: tutorialVisibleTodos,

    // Derived data
    statusCounts,

    // Handlers
    handleToggleComplete,
    handleTodoClick,
  };
}
