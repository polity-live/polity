import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useSearch } from '@tanstack/react-router';

import { useAuth } from '@/providers/auth-provider';
import { queries } from '@/zero/queries';
import { useCommonState } from '@/zero/common';
import { extractHashtagTags } from '@/zero/common/hashtagHelpers';
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
  const { user } = useAuth();
  const [showFilters, setShowFilters] = useState(false);
  const [totalResultsState, setTotalResultsState] = useState<{
    contextKey: string;
    total: number | null;
  }>({ contextKey: '', total: null });
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
    view,
    setView,
  } = useSearchURL();

  const [topicRows] = useQuery(queries.search.searchDocumentTopics({ limit: 160 }));
  const { userHashtags } = useCommonState({ user_id: user?.id });
  const personalTopics = useMemo(() => extractHashtagTags(userHashtags), [userHashtags]);

  const availableTopics = useMemo(() => {
    const seen = new Set<string>();

    return [...personalTopics, ...(topicRows ?? []).map(row => row.topic)]
      .filter(topic => {
        const key = topic.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 80);
  }, [personalTopics, topicRows]);

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
      bounds: null,
    }),
    [contentTypes, dateRange, engagement, searchQuery, sortBy, topics]
  );
  const resultsContextKey = useMemo(
    () => JSON.stringify({ searchContext, view }),
    [searchContext, view]
  );
  const totalResults =
    totalResultsState.contextKey === resultsContextKey ? totalResultsState.total : null;
  const setTotalResults = useCallback(
    (total: number | null) => {
      setTotalResultsState({ contextKey: resultsContextKey, total });
    },
    [resultsContextKey]
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
    view,
    setView,
    availableTopics,
    personalTopics,
    toggleContentType,
    toggleTopic,
    resetFilters,
    hasActiveFilters,
    searchContext,
    permalinkId: searchParams.result ?? null,
  };
}
