import { type PqlFieldDefinition, type PqlFilter } from '../logic/applyPqlFilter';
import type { PqlQuickFilterDefinition, PqlQuickFilterValues } from '../hooks/usePqlCollection';
import { usePqlToolbarController } from '../hooks/usePqlToolbarController';
import { PqlToolbarView } from './PqlToolbarView';
import type { SurfaceMode } from '@/features/shared/ui/layout/SurfaceDepthContext';

interface PqlToolbarProps<TItem, TFieldKey extends string> {
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchPlaceholder: string;
  quickFilters: readonly PqlQuickFilterDefinition<TFieldKey>[];
  quickFilterValues: PqlQuickFilterValues<TFieldKey>;
  onQuickFilterValuesChange: (fieldKey: TFieldKey, values: readonly string[]) => void;
  onQuickFilterToggle: (fieldKey: TFieldKey, value: string) => void;
  onQuickFilterClear: (fieldKey: TFieldKey) => void;
  savedFilters: readonly PqlFilter<TFieldKey>[];
  activeCustomFilterIds: readonly string[];
  onCustomFilterToggle: (filterId: string) => void;
  onCustomFilterDelete: (filterId: string) => void;
  onCustomFilterSave: (filter: PqlFilter<TFieldKey>) => void;
  surface?: SurfaceMode;
}

export function PqlToolbar<TItem, TFieldKey extends string>({
  fields,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
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
  surface = 'auto',
}: PqlToolbarProps<TItem, TFieldKey>) {
  return (
    <PqlToolbarView
      activeCustomFilterIds={activeCustomFilterIds}
      fields={fields}
      onCustomFilterDelete={onCustomFilterDelete}
      onCustomFilterSave={onCustomFilterSave}
      onCustomFilterToggle={onCustomFilterToggle}
      onQuickFilterClear={onQuickFilterClear}
      onQuickFilterToggle={onQuickFilterToggle}
      onQuickFilterValuesChange={onQuickFilterValuesChange}
      onSearchQueryChange={onSearchQueryChange}
      quickFilters={quickFilters}
      quickFilterValues={quickFilterValues}
      savedFilters={savedFilters}
      searchPlaceholder={searchPlaceholder}
      searchQuery={searchQuery}
      surface={surface}
      {...usePqlToolbarController({
        fields,
        quickFilters,
        quickFilterValues,
        onQuickFilterToggle,
        savedFilters,
        activeCustomFilterIds,
        onCustomFilterToggle,
      })}
    />
  );
}
