import { useEffect, useMemo, useRef, useState } from 'react';
import { usePqlFilterActions } from '@/zero/pql/usePqlFilterActions';
import { usePqlFilterState } from '@/zero/pql/usePqlFilterState';
import {
  applyPqlFilter,
  createPqlCondition,
  createPqlFieldRegistry,
  getPqlFilterExpression,
  matchesPqlFilter,
  serializePqlFilter,
  type PqlFieldDefinition,
  type PqlFilter,
  type PqlOperator,
  type PqlRule,
} from '../logic/applyPqlFilter';
import { parsePqlExpression } from '../logic/pqlQueryLanguage';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

type PqlSearchValue = string | readonly string[] | null | undefined;

interface PqlPersistedState<TFieldKey extends string> {
  savedFilters: PqlFilter<TFieldKey>[];
  activeCustomFilterIds: string[];
}

export type PqlQuickFilterValues<TFieldKey extends string> = Partial<Record<TFieldKey, string[]>>;

export interface PqlQuickFilterDefinition<TFieldKey extends string> {
  fieldKey: TFieldKey;
  label?: string;
  operator?: Extract<PqlOperator, 'eq' | 'in'>;
  multiple?: boolean;
  inputKind?: 'buttons' | 'typeahead' | 'hashtag' | 'date';
  placeholder?: string;
  typeaheadItems?: readonly TypeaheadItem[];
  serializeValue?: (values: readonly string[]) => PqlRule<TFieldKey>['value'];
}

export interface UsePqlCollectionOptions<TItem, TFieldKey extends string> {
  items: readonly TItem[];
  fields: readonly PqlFieldDefinition<TItem, TFieldKey>[];
  searchValues?: readonly ((item: TItem) => PqlSearchValue)[];
  quickFilters?: readonly PqlQuickFilterDefinition<TFieldKey>[];
  storageKey?: string;
  groupId?: string;
  sortItems?: (items: TItem[]) => TItem[];
}

function normalizeSearchValue(value: PqlSearchValue): readonly string[] {
  if (typeof value === 'string') {
    return value ? [value.trim().toLowerCase()] : [];
  }

  if (Array.isArray(value)) {
    return value.map(entry => entry.trim().toLowerCase()).filter(Boolean);
  }

  return [];
}

function readPersistedState<TFieldKey extends string>(
  storageKey: string
): PqlPersistedState<TFieldKey> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as PqlPersistedState<TFieldKey>;
    return {
      savedFilters: parsedValue.savedFilters ?? [],
      activeCustomFilterIds: parsedValue.activeCustomFilterIds ?? [],
    };
  } catch {
    return null;
  }
}

function clearPersistedState(storageKey: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(storageKey);
}

export function usePqlCollection<TItem, TFieldKey extends string>({
  items,
  fields,
  searchValues = [],
  quickFilters = [],
  storageKey,
  groupId,
  sortItems,
}: UsePqlCollectionOptions<TItem, TFieldKey>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilterValues, setQuickFilterValues] = useState<PqlQuickFilterValues<TFieldKey>>({});
  const hasAttemptedStorageMigration = useRef(false);
  const { filters: persistedFilters, isLoading: arePersistedFiltersLoading } = usePqlFilterState(
    storageKey
      ? {
          storage_key: storageKey,
          group_id: groupId,
        }
      : undefined
  );
  const { createFilter, updateFilter, deleteFilter } = usePqlFilterActions();

  const fieldRegistry = useMemo(() => createPqlFieldRegistry(fields), [fields]);
  const quickFilterMap = useMemo(
    () => new Map(quickFilters.map(definition => [definition.fieldKey, definition])),
    [quickFilters]
  );

  useEffect(() => {
    hasAttemptedStorageMigration.current = false;
  }, [groupId, storageKey]);

  const savedFilters = useMemo(
    () =>
      persistedFilters.map(filter => {
        const parseResult = parsePqlExpression(filter.query, fields);

        return {
          id: filter.id,
          label: filter.label,
          query: filter.query,
          expression: parseResult.expression ?? undefined,
        } satisfies PqlFilter<TFieldKey>;
      }),
    [fields, persistedFilters]
  );

  const activeCustomFilterIds = useMemo(
    () => persistedFilters.filter(filter => filter.is_active).map(filter => filter.id),
    [persistedFilters]
  );

  useEffect(() => {
    if (!storageKey || hasAttemptedStorageMigration.current || arePersistedFiltersLoading) {
      return;
    }

    if (persistedFilters.length > 0) {
      hasAttemptedStorageMigration.current = true;
      return;
    }

    const persistedState = readPersistedState<TFieldKey>(storageKey);
    hasAttemptedStorageMigration.current = true;

    if (!persistedState) {
      return;
    }

    for (const filter of persistedState.savedFilters) {
      const serializedQuery = serializePqlFilter(filter).trim();
      if (!filter.label.trim() || !serializedQuery) {
        continue;
      }

      createFilter({
        id: filter.id,
        storage_key: storageKey,
        group_id: groupId,
        label: filter.label.trim(),
        query: serializedQuery,
        is_active: persistedState.activeCustomFilterIds.includes(filter.id),
      });
    }

    clearPersistedState(storageKey);
  }, [arePersistedFiltersLoading, createFilter, groupId, persistedFilters, storageKey]);

  const quickFilter = useMemo<PqlFilter<TFieldKey> | null>(() => {
    const conditions = quickFilters.flatMap(definition => {
      const values = quickFilterValues[definition.fieldKey] ?? [];
      if (values.length === 0) {
        return [];
      }

      const operator =
        definition.operator ?? (definition.multiple || values.length > 1 ? 'in' : 'eq');
      return [
        createPqlCondition({
          id: `quick-${definition.fieldKey}`,
          fieldKey: definition.fieldKey,
          operator,
          value:
            definition.serializeValue?.(values) ??
            (operator === 'in' ? values : (values[0] ?? null)),
        }),
      ];
    });

    if (conditions.length === 0) {
      return null;
    }

    const expression =
      conditions.length === 1
        ? conditions[0]
        : {
            type: 'group' as const,
            combinator: 'and' as const,
            children: conditions,
          };

    return {
      id: 'quick-filters',
      label: translateText('generated.inline.0483_field_filters_8d9ccc52'),
      expression,
    };
  }, [quickFilterValues, quickFilters]);

  const activeCustomFilters = useMemo(
    () =>
      savedFilters.filter(
        filter =>
          activeCustomFilterIds.includes(filter.id) && Boolean(getPqlFilterExpression(filter))
      ),
    [activeCustomFilterIds, savedFilters]
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    let nextItems = normalizedQuery
      ? items.filter(item =>
          searchValues.some(getSearchValue =>
            normalizeSearchValue(getSearchValue(item)).some(value =>
              value.includes(normalizedQuery)
            )
          )
        )
      : [...items];

    nextItems = applyPqlFilter(nextItems, quickFilter, fieldRegistry);
    nextItems = nextItems.filter(item =>
      activeCustomFilters.every(filter => matchesPqlFilter(item, filter, fieldRegistry))
    );

    return sortItems ? sortItems(nextItems) : nextItems;
  }, [
    activeCustomFilters,
    fieldRegistry,
    items,
    quickFilter,
    searchQuery,
    searchValues,
    sortItems,
  ]);

  const toggleQuickFilterValue = (fieldKey: TFieldKey, value: string) => {
    const definition = quickFilterMap.get(fieldKey);
    setQuickFilterValues(currentValues => {
      const fieldValues = currentValues[fieldKey] ?? [];
      const isSelected = fieldValues.includes(value);

      const nextValues = isSelected
        ? fieldValues.filter(entry => entry !== value)
        : definition?.multiple
          ? [...fieldValues, value]
          : [value];

      if (nextValues.length === 0) {
        return {
          ...currentValues,
          [fieldKey]: undefined,
        };
      }

      return {
        ...currentValues,
        [fieldKey]: nextValues,
      };
    });
  };

  const clearQuickFilter = (fieldKey: TFieldKey) => {
    setQuickFilterValues(currentValues => ({
      ...currentValues,
      [fieldKey]: undefined,
    }));
  };

  const setQuickFilterValuesForField = (fieldKey: TFieldKey, values: readonly string[]) => {
    setQuickFilterValues(currentValues => ({
      ...currentValues,
      [fieldKey]: values.length > 0 ? [...values] : undefined,
    }));
  };

  const saveCustomFilter = (filter: PqlFilter<TFieldKey>) => {
    if (!storageKey) {
      return;
    }

    const query = serializePqlFilter(filter).trim();
    const label = filter.label.trim();
    if (!label || !query) {
      return;
    }

    const existingFilter = persistedFilters.find(entry => entry.id === filter.id);
    if (existingFilter) {
      updateFilter({
        id: filter.id,
        label,
        query,
      });
      return;
    }

    createFilter({
      id: filter.id,
      storage_key: storageKey,
      group_id: groupId,
      label,
      query,
      is_active: false,
    });
  };

  const deleteCustomFilter = (filterId: string) => {
    deleteFilter(filterId);
  };

  const toggleCustomFilter = (filterId: string) => {
    const filter = persistedFilters.find(entry => entry.id === filterId);
    if (!filter) {
      return;
    }

    updateFilter({
      id: filterId,
      is_active: !filter.is_active,
    });
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setQuickFilterValues({});

    for (const filter of persistedFilters) {
      if (!filter.is_active) {
        continue;
      }

      updateFilter({
        id: filter.id,
        is_active: false,
      });
    }
  };

  return {
    fieldRegistry,
    searchQuery,
    setSearchQuery,
    quickFilterValues,
    setQuickFilterValues: setQuickFilterValuesForField,
    toggleQuickFilterValue,
    clearQuickFilter,
    savedFilters,
    saveCustomFilter,
    deleteCustomFilter,
    activeCustomFilterIds,
    toggleCustomFilter,
    clearAllFilters,
    filteredItems,
    hasActiveFilters:
      searchQuery.trim().length > 0 ||
      Object.values(quickFilterValues as Partial<Record<string, string[]>>).some(values =>
        Boolean(values?.length)
      ) ||
      activeCustomFilterIds.length > 0,
  };
}
