'use client';

import { Link } from '@tanstack/react-router';
import { TodosHeader } from '@/features/todos/ui/TodosHeader';
import { TodosFilters } from '@/features/todos/ui/TodosFilters';
import { TodosTabs } from '@/features/todos/ui/TodosTabs';
import { KanbanBoard } from '@/features/todos/ui/kanban-board.tsx';
import { TodoList } from '@/features/todos/ui/todo-list.tsx';
import { TodoDetailDialog } from '@/features/todos/ui/todo-detail-dialog.tsx';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { CheckSquare, Plus } from 'lucide-react';
import type { SwipeNavigationHandlers } from '@/features/shared/hooks/useSwipeNavigation';
export interface TodosPageViewProps {
  t: any;
  user: any;
  viewMode: any;
  setViewMode: any;
  selectedTodo: any;
  isDetailDialogOpen: any;
  setIsDetailDialogOpen: any;
  fields: any;
  quickFilters: any;
  searchQuery: any;
  setSearchQuery: any;
  quickFilterValues: any;
  setQuickFilterValues: any;
  toggleQuickFilterValue: any;
  clearQuickFilter: any;
  savedFilters: any;
  saveCustomFilter: any;
  deleteCustomFilter: any;
  activeCustomFilterIds: any;
  toggleCustomFilter: any;
  selectedTab: any;
  setSelectedTab: any;
  filteredTodos: any;
  statusCounts: any;
  handleToggleComplete: any;
  handleTodoClick: any;
  tabSwipeHandlers: SwipeNavigationHandlers;
}

export function TodosPageView({
  t,
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
  tabSwipeHandlers,
}: TodosPageViewProps) {
  if (!user) {
    return <PageSkeleton />;
  }

  return (
    <div style={{ touchAction: 'pan-y' }} {...tabSwipeHandlers}>
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
        actions={<TodosHeader viewMode={viewMode} setViewMode={setViewMode} />}
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
                  : selectedTab === 'archived'
                    ? t('features.todos.archive.empty')
                    : selectedTab === 'all'
                      ? t('features.todos.list.noTodosYet')
                      : t('features.todos.list.noStatusTodos', {
                          status: t(`features.todos.status.${selectedTab}`),
                        })}
              </p>
              {selectedTab !== 'archived' ? (
                <Link to="/create/todo">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('features.todos.create.createFirstTodo')}
                  </Button>
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : viewMode === 'kanban' && selectedTab !== 'archived' ? (
          <KanbanBoard
            todos={filteredTodos}
            virtualQuery={
              selectedTab !== 'archived' &&
              activeCustomFilterIds.length === 0 &&
              Object.values(quickFilterValues ?? {}).every(value =>
                Array.isArray(value) ? value.length === 0 : !value
              )
                ? { query: searchQuery }
                : undefined
            }
          />
        ) : (
          <TodoList
            todos={filteredTodos}
            onToggleComplete={handleToggleComplete}
            onTodoClick={handleTodoClick}
            virtualQuery={
              activeCustomFilterIds.length === 0 &&
              Object.values(quickFilterValues ?? {}).every(value =>
                Array.isArray(value) ? value.length === 0 : !value
              )
                ? {
                    status: selectedTab === 'archived' ? 'all' : selectedTab,
                    archive: selectedTab === 'archived' ? 'archived' : 'active',
                    query: searchQuery,
                  }
                : undefined
            }
          />
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
