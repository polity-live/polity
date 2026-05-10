import { PqlToolbar } from '@/features/pql/ui/PqlToolbar';
import type {
  PqlQuickFilterValues,
  PqlQuickFilterDefinition,
} from '@/features/pql/hooks/usePqlCollection';
import type { PqlFieldDefinition, PqlFilter } from '@/features/pql/logic/applyPqlFilter';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { Todo } from '../types/todo.types';
import type { TodoFieldKey } from '../hooks/useTodoFilters';

interface TodosFiltersProps {
  fields: readonly PqlFieldDefinition<Todo, TodoFieldKey>[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  quickFilters: readonly PqlQuickFilterDefinition<TodoFieldKey>[];
  quickFilterValues: PqlQuickFilterValues<TodoFieldKey>;
  onQuickFilterValuesChange: (fieldKey: TodoFieldKey, values: readonly string[]) => void;
  onQuickFilterToggle: (fieldKey: TodoFieldKey, value: string) => void;
  onQuickFilterClear: (fieldKey: TodoFieldKey) => void;
  savedFilters: readonly PqlFilter<TodoFieldKey>[];
  activeCustomFilterIds: readonly string[];
  onCustomFilterToggle: (filterId: string) => void;
  onCustomFilterDelete: (filterId: string) => void;
  onCustomFilterSave: (filter: PqlFilter<TodoFieldKey>) => void;
}

export function TodosFilters({
  fields,
  searchQuery,
  setSearchQuery,
  quickFilters,
  quickFilterValues,
  onQuickFilterValuesChange,
  onQuickFilterToggle,
  onQuickFilterClear,
  savedFilters,
  activeCustomFilterIds,
  onCustomFilterToggle,
  onCustomFilterDelete,
  onCustomFilterSave,
}: TodosFiltersProps) {
  const { t } = useTranslation();

  return (
    <PqlToolbar
      fields={fields}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchPlaceholder={t('features.todos.search.placeholder')}
      quickFilters={quickFilters}
      quickFilterValues={quickFilterValues}
      onQuickFilterValuesChange={onQuickFilterValuesChange}
      onQuickFilterToggle={onQuickFilterToggle}
      onQuickFilterClear={onQuickFilterClear}
      savedFilters={savedFilters}
      activeCustomFilterIds={activeCustomFilterIds}
      onCustomFilterToggle={onCustomFilterToggle}
      onCustomFilterDelete={onCustomFilterDelete}
      onCustomFilterSave={onCustomFilterSave}
    />
  );
}
