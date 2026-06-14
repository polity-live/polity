import { useMemo, useState } from 'react';

import { type PqlFieldDefinition, type PqlFilter } from '../logic/applyPqlFilter';
import type { PqlQuickFilterDefinition, PqlQuickFilterValues } from '../hooks/usePqlCollection';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

import { PqlToolbarView, type ActivePqlFilterBadge } from './PqlToolbarView';

function getOptionLabel<TItem, TFieldKey extends string>(
  field: PqlFieldDefinition<TItem, TFieldKey> | undefined,
  value: string
): string {
  return field?.options?.find(option => option.value === value)?.label ?? value;
}

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
}: PqlToolbarProps<TItem, TFieldKey>) {
  const [fieldFiltersOpen, setFieldFiltersOpen] = useState(false);
  const [customFiltersOpen, setCustomFiltersOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<PqlFilter<TFieldKey> | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const fieldMap = useMemo(() => new Map(fields.map(field => [field.key, field])), [fields]);

  const activeQuickBadges = useMemo<ActivePqlFilterBadge[]>(
    () =>
      quickFilters.flatMap(quickFilter => {
        const field = fieldMap.get(quickFilter.fieldKey);
        const values = quickFilterValues[quickFilter.fieldKey] ?? [];
        return values.map(value => ({
          id: `${quickFilter.fieldKey}-${value}`,
          label: translateText('generated.inline.0484_fieldkey_valueb7f0_786b99ae', {
            fieldKey: quickFilter.label ?? field?.label ?? quickFilter.fieldKey,
            valueb7f0: getOptionLabel(field, value),
          }),
          onClear: () => onQuickFilterToggle(quickFilter.fieldKey, value),
        }));
      }),
    [fieldMap, onQuickFilterToggle, quickFilterValues, quickFilters]
  );

  const activeCustomBadges = useMemo<ActivePqlFilterBadge[]>(
    () =>
      savedFilters
        .filter(filter => activeCustomFilterIds.includes(filter.id))
        .map(filter => ({
          id: filter.id,
          label: filter.label,
          onClear: () => onCustomFilterToggle(filter.id),
        })),
    [activeCustomFilterIds, onCustomFilterToggle, savedFilters]
  );

  return (
    <PqlToolbarView
      activeBadges={[...activeQuickBadges, ...activeCustomBadges]}
      activeCustomFilterIds={activeCustomFilterIds}
      activeQuickBadgeCount={activeQuickBadges.length}
      builderOpen={builderOpen}
      customFiltersOpen={customFiltersOpen}
      editingFilter={editingFilter}
      fieldFiltersOpen={fieldFiltersOpen}
      fields={fields}
      onBuilderOpenChange={setBuilderOpen}
      onCustomFilterDelete={onCustomFilterDelete}
      onCustomFilterSave={onCustomFilterSave}
      onCustomFilterToggle={onCustomFilterToggle}
      onCustomFiltersOpenChange={setCustomFiltersOpen}
      onEditFilter={setEditingFilter}
      onFieldFiltersOpenChange={setFieldFiltersOpen}
      onQuickFilterClear={onQuickFilterClear}
      onQuickFilterToggle={onQuickFilterToggle}
      onQuickFilterValuesChange={onQuickFilterValuesChange}
      onSearchQueryChange={onSearchQueryChange}
      quickFilters={quickFilters}
      quickFilterValues={quickFilterValues}
      savedFilters={savedFilters}
      searchPlaceholder={searchPlaceholder}
      searchQuery={searchQuery}
    />
  );
}
