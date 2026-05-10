import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { LayoutGrid, List } from 'lucide-react';
import { KanbanBoard } from '@/features/todos/ui/kanban-board.tsx';
import { TodoList } from '@/features/todos/ui/todo-list.tsx';
import { TodoDetailDialog } from '@/features/todos/ui/todo-detail-dialog.tsx';
import { TodosFilters } from '@/features/todos/ui/TodosFilters';
import { useTodoFilters } from '@/features/todos/hooks/useTodoFilters';
import { AddTodoDialog } from './AddTodoDialog';
import type { TodoViewMode } from '../types/group.types';
import type { Todo } from '@/features/todos/types/todo.types';

interface TodosSectionProps {
  storageKey: string;
  todos: Todo[];
  viewMode: TodoViewMode;
  onViewModeChange: (mode: TodoViewMode) => void;
  dialogOpen: boolean;
  onDialogChange: (open: boolean) => void;
  onAddTodo: (data: {
    title: string;
    description: string;
    priority: string;
    dueDate: string;
  }) => void;
  onToggleComplete: (todo: Todo) => void;
}

export function TodosSection({
  storageKey,
  todos,
  viewMode,
  onViewModeChange,
  dialogOpen,
  onDialogChange,
  onAddTodo,
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
              <AddTodoDialog open={dialogOpen} onOpenChange={onDialogChange} onSubmit={onAddTodo} />
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
            <KanbanBoard todos={filteredTodos} />
          ) : (
            <TodoList
              todos={filteredTodos}
              onToggleComplete={onToggleComplete}
              onTodoClick={handleTodoClick}
            />
          )}
        </CardContent>
      </Card>

      {selectedTodo ? (
        <TodoDetailDialog
          todo={selectedTodo}
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
        />
      ) : null}
    </>
  );
}
