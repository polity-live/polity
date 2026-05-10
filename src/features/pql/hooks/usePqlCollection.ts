import { useEffect, useMemo, useState } from 'react';
import {
  applyPqlFilter,
  createPqlFieldRegistry,
  matchesPqlFilter,
  type PqlFieldDefinition,
  type PqlFilter,
  type PqlOperator,
  type PqlRule,
} from '../logic/applyPqlFilter';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';

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
  sortItems?: (items: TItem[]) => TItem[];
}

function normalizeSearchValue(value: PqlSearchValue): readonly string[] {
  if (Array.isArray(value)) {
    return value.map(entry => entry.trim().toLowerCase()).filter(Boolean);
  }

  return value ? [value.trim().toLowerCase()] : [];
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

function writePersistedState<TFieldKey extends string>(
  storageKey: string,
  value: PqlPersistedState<TFieldKey>
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

export function usePqlCollection<TItem, TFieldKey extends string>({
  items,
  fields,
  searchValues = [],
  quickFilters = [],
  storageKey,
  sortItems,
}: UsePqlCollectionOptions<TItem, TFieldKey>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilterValues, setQuickFilterValues] = useState<PqlQuickFilterValues<TFieldKey>>({});
  const [savedFilters, setSavedFilters] = useState<PqlFilter<TFieldKey>[]>([]);
  const [activeCustomFilterIds, setActiveCustomFilterIds] = useState<string[]>([]);

  const fieldRegistry = useMemo(() => createPqlFieldRegistry(fields), [fields]);
  const quickFilterMap = useMemo(
    () => new Map(quickFilters.map(definition => [definition.fieldKey, definition])),
    [quickFilters]
  );

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    const persistedState = readPersistedState<TFieldKey>(storageKey);
    if (!persistedState) {
      return;
    }

    setSavedFilters(persistedState.savedFilters);
    setActiveCustomFilterIds(persistedState.activeCustomFilterIds);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    writePersistedState(storageKey, { savedFilters, activeCustomFilterIds });
  }, [activeCustomFilterIds, savedFilters, storageKey]);

  const quickFilter = useMemo<PqlFilter<TFieldKey> | null>(() => {
    const rules = quickFilters.flatMap(definition => {
      const values = quickFilterValues[definition.fieldKey] ?? [];
      if (values.length === 0) {
        return [];
      }

      const operator =
        definition.operator ?? (definition.multiple || values.length > 1 ? 'in' : 'eq');
      return [
        {
          id: `quick-${definition.fieldKey}`,
          fieldKey: definition.fieldKey,
          operator,
          value:
            definition.serializeValue?.(values) ??
            (operator === 'in' ? values : (values[0] ?? null)),
        },
      ];
    });

    if (rules.length === 0) {
      return null;
    }

    return {
      id: 'quick-filters',
      label: 'Field filters',
      combinator: 'and',
      rules,
    };
  }, [quickFilterValues, quickFilters]);

  const activeCustomFilters = useMemo(
    () => savedFilters.filter(filter => activeCustomFilterIds.includes(filter.id)),
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
    setSavedFilters(currentFilters => {
      const existingFilter = currentFilters.some(entry => entry.id === filter.id);
      return existingFilter
        ? currentFilters.map(entry => (entry.id === filter.id ? filter : entry))
        : [...currentFilters, filter];
    });
  };

  const deleteCustomFilter = (filterId: string) => {
    setSavedFilters(currentFilters => currentFilters.filter(filter => filter.id !== filterId));
    setActiveCustomFilterIds(currentIds => currentIds.filter(id => id !== filterId));
  };

  const toggleCustomFilter = (filterId: string) => {
    setActiveCustomFilterIds(currentIds =>
      currentIds.includes(filterId)
        ? currentIds.filter(id => id !== filterId)
        : [...currentIds, filterId]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setQuickFilterValues({});
    setActiveCustomFilterIds([]);
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
      Object.values(quickFilterValues).some(values => Boolean(values?.length)) ||
      activeCustomFilterIds.length > 0,
  };
}
