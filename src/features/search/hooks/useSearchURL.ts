import { useNavigate, useSearch, useRouterState } from '@tanstack/react-router';
import { useEffect, useMemo, useState, useRef } from 'react';
import {
  ALL_CONTENT_TYPES,
  type DateRangeFilter,
  type EngagementFilter,
  type TimelineSortOption,
} from '@/features/timeline/hooks/useTimelineFilters';
import { type ContentType } from '@/features/timeline/constants/content-type-config';

export type SearchViewMode = 'list' | 'spatial' | 'compact';

export function useSearchURL() {
  const navigate = useNavigate();
  const previewOpen = useRouterState({
    select: state => state.location.hash.startsWith('preview='),
  });
  const searchParams = useSearch({ strict: false }) as Record<string, string>;

  // Get URL parameters
  const queryParam = searchParams.q || '';
  const typesParam = searchParams.types || '';
  const rangeParam = (searchParams.range || 'all') as DateRangeFilter;
  const topicsParam = searchParams.topics || '';
  const hashtagParam = searchParams.hashtag || '';
  const engagementParam = (searchParams.engagement || 'all') as EngagementFilter;
  const sortParam = (searchParams.sort || 'recent') as TimelineSortOption;
  const viewParam = searchParams.view || 'list';

  const parsedContentTypes = useMemo<ContentType[]>(() => {
    if (!typesParam) return [...ALL_CONTENT_TYPES];
    const parts = typesParam
      .split(',')
      .map(type => type.trim())
      .filter(Boolean);
    const validTypes = parts.filter(type => ALL_CONTENT_TYPES.includes(type as ContentType));
    return validTypes.length > 0 ? (validTypes as ContentType[]) : [...ALL_CONTENT_TYPES];
  }, [typesParam]);

  const parsedTopics = useMemo(() => {
    const fromTopics = topicsParam
      ? topicsParam
          .split(',')
          .map(topic => topic.trim())
          .filter(Boolean)
      : [];
    // When ?hashtag=politics arrives, inject it into topics if not already present
    if (hashtagParam && !fromTopics.includes(hashtagParam)) {
      fromTopics.push(hashtagParam);
    }
    return fromTopics;
  }, [topicsParam, hashtagParam]);

  const parsedDateRange: DateRangeFilter =
    rangeParam === 'today' ||
    rangeParam === 'week' ||
    rangeParam === 'month' ||
    rangeParam === 'year'
      ? rangeParam
      : 'all';

  const parsedEngagement: EngagementFilter =
    engagementParam === 'popular' || engagementParam === 'rising' || engagementParam === 'discussed'
      ? engagementParam
      : 'all';

  const parsedSort: TimelineSortOption =
    sortParam === 'trending' || sortParam === 'engagement' ? sortParam : 'recent';
  const parsedView: SearchViewMode =
    viewParam === 'spatial' ? 'spatial' : viewParam === 'compact' ? 'compact' : 'list';

  // Local state
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [contentTypes, setContentTypes] = useState<ContentType[]>(parsedContentTypes);
  const [dateRange, setDateRange] = useState<DateRangeFilter>(parsedDateRange);
  const [topics, setTopics] = useState<string[]>(parsedTopics);
  const [engagement, setEngagement] = useState<EngagementFilter>(parsedEngagement);
  const [sortBy, setSortBy] = useState<TimelineSortOption>(parsedSort);
  const [view, setView] = useState<SearchViewMode>(parsedView);

  // History navigation restores the controls without remounting the results or preview.
  const urlKey = JSON.stringify(searchParams);
  const lastURL = useRef(urlKey);
  useEffect(() => {
    if (lastURL.current === urlKey) return;
    lastURL.current = urlKey;
    setSearchQuery(queryParam);
    setContentTypes(parsedContentTypes);
    setDateRange(parsedDateRange);
    setTopics(parsedTopics);
    setEngagement(parsedEngagement);
    setSortBy(parsedSort);
    setView(parsedView);
  }, [urlKey]);

  // Update URL when search parameters change
  const updateURL = (updates: Record<string, string>) => {
    const params = new URLSearchParams(
      Object.entries(searchParams)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)])
    );
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    const current = new URLSearchParams(
      Object.entries(searchParams)
        .filter(([, value]) => value != null)
        .map(([key, value]) => [key, String(value)])
    );
    params.sort();
    current.sort();
    if (params.toString() === current.toString()) return;
    void navigate({
      to: `/search?${params.toString()}`,
      hash: true,
      resetScroll: false,
    });
  };

  // Type-ahead search: Update URL as user types (with debouncing)
  useEffect(() => {
    // A pending search update must not add another history entry above the preview.
    // Keep local controls intact and flush their URL once the preview closes.
    if (previewOpen) return;
    const timer = setTimeout(() => {
      const allTypesSelected = contentTypes.length === ALL_CONTENT_TYPES.length;
      updateURL({
        q: searchQuery,
        types: allTypesSelected ? '' : contentTypes.join(','),
        range: dateRange !== 'all' ? dateRange : '',
        topics: topics.length > 0 ? topics.join(',') : '',
        engagement: engagement !== 'all' ? engagement : '',
        sort: sortBy !== 'recent' ? sortBy : '',
        view: view !== 'list' ? view : '',
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, contentTypes, dateRange, topics, engagement, sortBy, view, urlKey, previewOpen]);

  return {
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
    view,
    setView,
  };
}
