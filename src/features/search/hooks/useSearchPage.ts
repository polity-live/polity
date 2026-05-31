import { useCallback, useMemo, useState } from 'react';
import { useSearchURL } from './useSearchURL';
import { useSearchData } from './useSearchData';
import { useSearchFilters } from './useSearchFilters';
import { mapMosaicToContentItems } from '../logic/searchMappers';
import {
  filterAndSortContentItems,
  collectAvailableTopics,
  buildAgendaItemsByEventId,
  hasActiveFilters as checkActiveFilters,
} from '../logic/searchFiltering';
import { ALL_CONTENT_TYPES } from '@/features/timeline/hooks/useTimelineFilters';
import type { ContentType } from '@/features/timeline/constants/content-type-config';
import type { SearchContentItem } from '../types/search.types';
import { buildTimelineCardProps } from '../logic/buildTimelineCardProps';

export function useSearchPage() {
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
    setSortBy,
  } = useSearchURL();

  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useSearchData(searchQuery);

  const agendaItemsByEventId = useMemo(
    () =>
      buildAgendaItemsByEventId(
        (data?.agendaItems ?? []) as Parameters<typeof buildAgendaItemsByEventId>[0]
      ),
    [data?.agendaItems]
  );

  const { mosaicResults } = useSearchFilters(data, {
    query: searchQuery,
    sortBy,
    topics,
  });

  const toggleContentType = useCallback(
    (type: ContentType) => {
      setContentTypes(prev =>
        prev.includes(type) ? prev.filter(item => item !== type) : [...prev, type]
      );
    },
    [setContentTypes]
  );

  const toggleTopic = useCallback(
    (topic: string) => {
      setTopics(prev =>
        prev.includes(topic) ? prev.filter(item => item !== topic) : [...prev, topic]
      );
    },
    [setTopics]
  );

  const resetFilters = useCallback(() => {
    setContentTypes([...ALL_CONTENT_TYPES]);
    setDateRange('all');
    setTopics([]);
    setEngagement('all');
    setSortBy('recent');
  }, [setContentTypes, setDateRange, setTopics, setEngagement, setSortBy]);

  const contentItems = useMemo(
    () => mapMosaicToContentItems(mosaicResults, agendaItemsByEventId),
    [mosaicResults, agendaItemsByEventId]
  );

  const filteredItems = useMemo(
    () =>
      filterAndSortContentItems(contentItems, {
        contentTypes,
        dateRange,
        topics,
        engagement,
        sortBy,
      }),
    [contentItems, contentTypes, dateRange, topics, engagement, sortBy]
  );

  const availableTopics = useMemo(() => collectAvailableTopics(contentItems), [contentItems]);

  const hasActiveFiltersMemo = useMemo(
    () =>
      checkActiveFilters(
        contentTypes,
        ALL_CONTENT_TYPES.length,
        dateRange,
        topics,
        engagement,
        searchQuery
      ),
    [contentTypes, dateRange, topics, engagement, searchQuery]
  );

  const buildCardProps = useCallback((item: SearchContentItem) => buildTimelineCardProps(item), []);

  return {
    // URL state
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
    setSortBy,

    // UI state
    showFilters,
    setShowFilters,

    // Data
    isLoading,
    contentItems,
    filteredItems,
    availableTopics,

    // Derived
    hasActiveFilters: hasActiveFiltersMemo,

    // Handlers
    toggleContentType,
    toggleTopic,
    resetFilters,
    buildCardProps,
  };
}
