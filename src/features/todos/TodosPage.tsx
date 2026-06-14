'use client';

import { useTodosPage } from '@/features/todos/hooks/useTodosPage';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { TodosPageView } from './TodosPageView';
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
    />
  );
}
