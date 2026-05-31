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
            <CardTitle>Todos</CardTitle>
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
                    Add Task
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
                ? 'No tasks match the current search and filters.'
                : 'No tasks yet. Add the first task to get started.'}
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
