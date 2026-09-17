'use client';

import { useEffect, useRef } from 'react';
import { useWorkspacePreferences } from '@/zero/preferences/useWorkspacePreferences';
import { toast } from '@/features/shared/ui/ui/sonner';
import type { ViewMode } from './ui/TodosHeader';
import { useTodosPage } from '@/features/todos/hooks/useTodosPage';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { TodosPageView } from './TodosPageView';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation';

const TODO_TAB_ORDER = [
  'all',
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'archived',
] as const;

export function TodosPage() {
  const { t } = useTranslation();
  const preference = useWorkspacePreferences();
  const initialized = useRef(false);

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
  useEffect(() => {
    if (initialized.current || preference.isLoading) return;
    initialized.current = true;
    if (preference.display.todoView && !filteredTodos.some(todo => todo.tutorial_run_id))
      setViewMode(preference.display.todoView);
  }, [preference.isLoading, preference.display.todoView, filteredTodos, setViewMode]);
  const changeView = (view: ViewMode) => {
    initialized.current = true;
    setViewMode(view);
    void preference
      .setDisplay({ todoView: view })
      .catch(() => toast.error(t('common.workspace.saveFailed')));
  };
  const selectedTabIndex = TODO_TAB_ORDER.indexOf(selectedTab);
  const { handlers: tabSwipeHandlers } = useSwipeNavigation({
    disabled: isDetailDialogOpen,
    canSwipePrev: selectedTabIndex > 0,
    canSwipeNext: selectedTabIndex >= 0 && selectedTabIndex < TODO_TAB_ORDER.length - 1,
    onSwipePrev: () => {
      const previousTab = TODO_TAB_ORDER[selectedTabIndex - 1];
      if (previousTab) {
        setSelectedTab(previousTab);
      }
    },
    onSwipeNext: () => {
      const nextTab = TODO_TAB_ORDER[selectedTabIndex + 1];
      if (nextTab) {
        setSelectedTab(nextTab);
      }
    },
    keyboardMode: 'global',
  });

  return (
    <TodosPageView
      t={t}
      user={user}
      viewMode={viewMode}
      setViewMode={changeView}
      selectedTodo={selectedTodo}
      isDetailDialogOpen={isDetailDialogOpen}
      setIsDetailDialogOpen={setIsDetailDialogOpen}
      fields={fields}
      quickFilters={quickFilters}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      quickFilterValues={quickFilterValues}
      setQuickFilterValues={setQuickFilterValues}
      toggleQuickFilterValue={toggleQuickFilterValue}
      clearQuickFilter={clearQuickFilter}
      savedFilters={savedFilters}
      saveCustomFilter={saveCustomFilter}
      deleteCustomFilter={deleteCustomFilter}
      activeCustomFilterIds={activeCustomFilterIds}
      toggleCustomFilter={toggleCustomFilter}
      selectedTab={selectedTab}
      setSelectedTab={setSelectedTab}
      filteredTodos={filteredTodos}
      statusCounts={statusCounts}
      handleToggleComplete={handleToggleComplete}
      handleTodoClick={handleTodoClick}
      tabSwipeHandlers={tabSwipeHandlers}
    />
  );
}
