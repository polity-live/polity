import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useSearch } from '@tanstack/react-router';

import { queries } from '@/zero/queries';
import {
  ALL_CONTENT_TYPES,
  type DateRangeFilter,
} from '@/features/timeline/hooks/useTimelineFilters';
import type { ContentType } from '@/features/timeline/constants/content-type-config';
import type { SearchListContext } from '../types/search-document.types';
import { useSearchURL } from './useSearchURL';

function createdAfterForRange(range: DateRangeFilter) {
  const now = new Date();
  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (range === 'week') return now.getTime() - 7 * 24 * 60 * 60 * 1000;
  if (range === 'month') return now.getTime() - 30 * 24 * 60 * 60 * 1000;
  if (range === 'year') return now.getTime() - 365 * 24 * 60 * 60 * 1000;
  return null;
}

export function useSearchPage() {
  const [showFilters, setShowFilters] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
  const {
    searchQuery,
    setSearchQuery,
    contentTypes,
    setContentTypes,
    dateRange,
    setDateRange,
    topics,
    setTopics,
    engagement,
    setEngagement,
    sortBy,
  } = useSearchURL();

  const [topicRows] = useQuery(queries.search.searchDocumentTopics({ limit: 160 }));

  const availableTopics = useMemo(
    () => Array.from(new Set((topicRows ?? []).map(row => row.topic))).slice(0, 80),
    [topicRows]
  );

  const toggleContentType = useCallback(
    (type: ContentType) => {
      setContentTypes(
        contentTypes.includes(type)
          ? contentTypes.filter(contentType => contentType !== type)
          : [...contentTypes, type]
      );
    },
    [contentTypes, setContentTypes]
  );

  const toggleTopic = useCallback(
    (topic: string) => {
      setTopics(
        topics.includes(topic) ? topics.filter(item => item !== topic) : [...topics, topic]
      );
    },
    [setTopics, topics]
  );

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setContentTypes([...ALL_CONTENT_TYPES]);
    setDateRange('all');
    setTopics([]);
    setEngagement('all');
  }, [setContentTypes, setDateRange, setEngagement, setSearchQuery, setTopics]);

  const hasActiveFilters =
    contentTypes.length !== ALL_CONTENT_TYPES.length ||
    dateRange !== 'all' ||
    topics.length > 0 ||
    engagement !== 'all' ||
    searchQuery.trim().length > 0;

  const searchContext = useMemo<SearchListContext>(
    () => ({
      query: searchQuery,
      types: contentTypes.length === ALL_CONTENT_TYPES.length ? [] : contentTypes,
      topics,
      createdAfter: createdAfterForRange(dateRange),
      engagement,
      sort: sortBy,
      snapshotAt: null,
    }),
    [contentTypes, dateRange, engagement, searchQuery, sortBy, topics]
  );

  return {
    searchQuery,
    setSearchQuery,
    contentTypes,
    setContentTypes,
    dateRange,
    setDateRange,
    topics,
    engagement,
    setEngagement,
    showFilters,
    setShowFilters,
    totalResults,
    setTotalResults,
    availableTopics,
    toggleContentType,
    toggleTopic,
    resetFilters,
    hasActiveFilters,
    searchContext,
    permalinkId: searchParams.result ?? null,
  };
}
