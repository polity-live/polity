import { useMemo, useState } from 'react';

import { type PqlFieldDefinition, type PqlFilter } from '../logic/applyPqlFilter';
import type { PqlQuickFilterDefinition, PqlQuickFilterValues } from './usePqlCollection';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { ActivePqlFilterBadge } from '../ui/PqlToolbarView';

function getOptionLabel<TItem, TFieldKey extends string>(
  field: PqlFieldDefinition<TItem, TFieldKey> | undefined,
  value: string
): string {
  return field?.options?.find(option => option.value === value)?.label ?? value;
}

interface UsePqlToolbarControllerOptions<TItem, TFieldKey extends string> {
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
  quickFilters: readonly PqlQuickFilterDefinition<TFieldKey>[];
  quickFilterValues: PqlQuickFilterValues<TFieldKey>;
  onQuickFilterToggle: (fieldKey: TFieldKey, value: string) => void;
  savedFilters: readonly PqlFilter<TFieldKey>[];
  activeCustomFilterIds: readonly string[];
  onCustomFilterToggle: (filterId: string) => void;
}

export function usePqlToolbarController<TItem, TFieldKey extends string>({
  fields,
  quickFilters,
  quickFilterValues,
  onQuickFilterToggle,
  savedFilters,
  activeCustomFilterIds,
  onCustomFilterToggle,
}: UsePqlToolbarControllerOptions<TItem, TFieldKey>) {
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

  return {
    activeBadges: [...activeQuickBadges, ...activeCustomBadges],
    activeQuickBadgeCount: activeQuickBadges.length,
    builderOpen,
    customFiltersOpen,
    editingFilter,
    fieldFiltersOpen,
    onBuilderOpenChange: setBuilderOpen,
    onCustomFiltersOpenChange: setCustomFiltersOpen,
    onEditFilter: setEditingFilter,
    onFieldFiltersOpenChange: setFieldFiltersOpen,
  };
}
