import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { KanbanBoard } from '@/features/todos/ui/kanban-board.tsx';
import { TodoList } from '@/features/todos/ui/todo-list.tsx';
import { TodoDetailDialog } from '@/features/todos/ui/todo-detail-dialog.tsx';
import { TodosFilters } from '@/features/todos/ui/TodosFilters';
import { useTodoFilters } from '@/features/todos/hooks/useTodoFilters';
import type { TodoViewMode } from '../types/group.types';
import type { Todo } from '@/features/todos/types/todo.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

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
    filteredTodos,
    hasActiveFilters,
  } = useTodoFilters(todos, undefined, {
    storageKey,
    groupId,
    includeStatusQuickFilter: true,
  });

  const handleTodoClick = (todo: Todo) => {
    setSelectedTodo(todo);
    setIsDetailDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{translateText('generated.inline.0733_todos_a4114a83')}</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border">
                <Button
                  variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-r-none border-0"
                  onClick={() => onViewModeChange('kanban')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-l-none border-0"
                  onClick={() => onViewModeChange('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              {canManageTodos ? (
                <Button asChild size="sm">
                  <Link
                    to="/create/todo"
                    search={{
                      groupId,
                      returnSection: 'todos',
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    {translateText('generated.inline.0632_add_task_44e578a5')}
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TodosFilters
            fields={fields}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            quickFilters={quickFilters}
            quickFilterValues={quickFilterValues}
            onQuickFilterValuesChange={setQuickFilterValues}
            onQuickFilterToggle={toggleQuickFilterValue}
            onQuickFilterClear={clearQuickFilter}
            savedFilters={savedFilters}
            activeCustomFilterIds={activeCustomFilterIds}
            onCustomFilterToggle={toggleCustomFilter}
            onCustomFilterDelete={deleteCustomFilter}
            onCustomFilterSave={saveCustomFilter}
          />

          {filteredTodos.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              {hasActiveFilters
                ? translateText(
                    'generated.inline.0114_no_tasks_match_the_current_search_and_filters_48d73ae2'
                  )
                : translateText(
                    'generated.inline.0115_no_tasks_yet_add_the_first_task_to_get_starte_4ec568a6'
                  )}
            </p>
          ) : viewMode === 'kanban' ? (
            <KanbanBoard canManageTodos={canManageTodos} todos={filteredTodos} />
          ) : (
            <TodoList
              canManageTodos={canManageTodos}
              todos={filteredTodos}
              onToggleComplete={onToggleComplete}
              onTodoClick={handleTodoClick}
            />
          )}
        </CardContent>
      </Card>

      {selectedTodo ? (
        <TodoDetailDialog
          canManageTodos={canManageTodos}
          todo={selectedTodo}
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
        />
      ) : null}
    </>
  );
}
