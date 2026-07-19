'use client';

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
      setViewMode={setViewMode}
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
