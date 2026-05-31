import { useMemo, useState } from 'react';
import { useTypeaheadData } from './useTypeaheadData';
import {
  DEFAULT_TYPEAHEAD_SEARCH_KEYS,
  filterItems,
  groupResultsByType,
  sortByRelevance,
  type EntityType,
  type TypeaheadItem,
} from '@/features/shared/logic/typeaheadHelpers';

interface UseTypeaheadSearchOptions {
  entityTypes?: EntityType[];
  items?: readonly TypeaheadItem[];
}

/**
 * Full typeahead search hook: manages query state, filtering, and grouped results.
 * Returns both the full source dataset and the filtered result list.
 */
export function useTypeaheadSearch({
  entityTypes = [],
  items: externalItems,
}: UseTypeaheadSearchOptions) {
  const [query, setQuery] = useState('');
  const { items: internalItems } = useTypeaheadData({ entityTypes });
  const items = useMemo(() => externalItems ?? internalItems, [externalItems, internalItems]);

  const results = useMemo(() => {
    const filteredItems = filterItems(items, query, DEFAULT_TYPEAHEAD_SEARCH_KEYS);
    return sortByRelevance(filteredItems, query);
  }, [items, query]);

  const groupedResults = useMemo(() => groupResultsByType(results), [results]);

  return {
    query,
    setQuery,
    items,
    results,
    groupedResults,
  };
}
