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
import { BookOpen, Bot, CheckSquare, Plus, RotateCcw } from 'lucide-react';
import { getTodoTutorialAnchor } from './logic/tutorialTodoAnchor';
import type { SwipeNavigationHandlers } from '@/features/shared/hooks/useSwipeNavigation';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { resolveAppTutorialFixtureValue } from '@/features/app-tutorial/fixture-copy';
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
  const { language } = useTranslation();
  if (!user) {
    return <PageSkeleton />;
  }

  const displayTodos = filteredTodos.map((todo: any) =>
    resolveAppTutorialFixtureValue(todo, {
      tutorialRunId: todo.tutorial_run_id,
      language,
    })
  );
  const hasTutorialAssistantTodo = filteredTodos.some(
    (todo: any) => getTodoTutorialAnchor(todo) === 'tutorial-assistant-todo'
  );
  const hasTutorialTodo = filteredTodos.some((todo: any) => Boolean(getTodoTutorialAnchor(todo)));

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
                <Button asChild data-action-id="todos.list.empty.create">
                  <Link to="/create/todo" data-action-id="todos.list.empty.create">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('features.todos.create.createFirstTodo')}
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : viewMode === 'kanban' && selectedTab !== 'archived' ? (
          <KanbanBoard
            todos={displayTodos}
            virtualQuery={
              !hasTutorialTodo &&
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
            todos={displayTodos}
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

      {hasTutorialAssistantTodo ? (
        <Card className="mt-6" data-tutorial-anchor="tutorial-help-links">
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
            <Link to="/messages" className="flex items-center gap-2 text-sm hover:underline">
              <Bot className="h-4 w-4" />
              {t('features.todos.helpLinks.assistant')}
            </Link>
            <Link
              to="/user/$id/settings"
              params={{ id: user.id }}
              className="flex items-center gap-2 text-sm hover:underline"
            >
              <RotateCcw className="h-4 w-4" />
              {t('features.todos.helpLinks.tutorial')}
            </Link>
            <Link to="/docs" className="flex items-center gap-2 text-sm hover:underline">
              <BookOpen className="h-4 w-4" />
              {t('features.todos.helpLinks.docs')}
            </Link>
          </CardContent>
        </Card>
      ) : null}

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
