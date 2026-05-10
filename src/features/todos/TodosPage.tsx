'use client';

import { Link } from '@tanstack/react-router';
import { useTodosPage } from '@/features/todos/hooks/useTodosPage';
import { TodosHeader } from '@/features/todos/ui/TodosHeader';
import { TodosFilters } from '@/features/todos/ui/TodosFilters';
import { TodosTabs } from '@/features/todos/ui/TodosTabs';
import { KanbanBoard } from '@/features/todos/ui/kanban-board.tsx';
import { TodoList } from '@/features/todos/ui/todo-list.tsx';
import { TodoDetailDialog } from '@/features/todos/ui/todo-detail-dialog.tsx';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { CheckSquare, Plus } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export function TodosPage() {
  const { t } = useTranslation();

  const {
    user,
    viewMode,
    setViewMode,
    selectedTodo,
    isDetailDialogOpen,
    setIsDetailDialogOpen,
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
    statusCounts,
    handleToggleComplete,
    handleTodoClick,
  } = useTodosPage();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t('features.todos.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <TodosHeader viewMode={viewMode} setViewMode={setViewMode} />

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

      <TodosTabs
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
        statusCounts={statusCounts}
      >
        {filteredTodos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckSquare className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">{t('features.todos.list.empty')}</h3>
              <p className="text-muted-foreground mb-4 text-center text-sm">
                {searchQuery
                  ? t('features.todos.list.noMatchingTodos')
                  : selectedTab === 'all'
                    ? t('features.todos.list.noTodosYet')
                    : t('features.todos.list.noStatusTodos', {
                        status: t(`features.todos.status.${selectedTab}`),
                      })}
              </p>
              <Link to="/create/todo">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('features.todos.create.createFirstTodo')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : viewMode === 'kanban' ? (
          <KanbanBoard todos={filteredTodos} />
        ) : (
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <TodoList
              todos={filteredTodos}
              onToggleComplete={handleToggleComplete}
              onTodoClick={handleTodoClick}
            />
          </ScrollArea>
        )}
      </TodosTabs>

      {selectedTodo && (
        <TodoDetailDialog
          todo={selectedTodo}
          open={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
        />
      )}
    </div>
  );
}
