'use client';

import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useDecisionTerminal } from '@/features/decision-terminal/hooks/useDecisionTerminal';
import { CIVIC_TIMELINE_CONTENT_TYPES, type CivicTimelineItem } from '../logic/civicTimeline';
import { useCivicTimeline } from './useCivicTimeline';
import { useTimelineFilters, type TimelineSortOption } from './useTimelineFilters';
import { useTimelineMode } from './useTimelineMode';
import type { TimelineRadiusFilter } from '../ui/TimelineFilterPanel';

const DEFAULT_RADIUS: TimelineRadiusFilter = 'all';

function countCivicFilters(args: {
  contentTypeCount: number;
  totalContentTypeCount: number;
  dateRange: string;
  topicsCount: number;
  radiusKm: TimelineRadiusFilter;
}) {
  let count = 0;
  if (args.contentTypeCount !== args.totalContentTypeCount) count += 1;
  if (args.dateRange !== 'all') count += 1;
  if (args.topicsCount > 0) count += 1;
  if (args.radiusKm !== DEFAULT_RADIUS) count += 1;
  return count;
}

function scrollRailItemIntoView(itemId: string) {
  if (typeof document === 'undefined') return;

  const escapedId = itemId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const element = document.querySelector<HTMLElement>(`[data-timeline-item-id="${escapedId}"]`);
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

interface UseTimelinePageOptions {
  userId?: string;
  groupId?: string;
}

export function useTimelinePage({ userId: userIdProp, groupId }: UseTimelinePageOptions = {}) {
  const { user } = useAuth();
  const userId = userIdProp || user?.id || '';
  const { mode, setMode } = useTimelineMode();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [radiusKm, setRadiusKm] = useState<TimelineRadiusFilter>(DEFAULT_RADIUS);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const {
    filters,
    setSortBy,
    setContentTypes,
    toggleContentType,
    setDateRange,
    setTopics,
    toggleTopic,
    setEngagement,
  } = useTimelineFilters({
    contentTypes: [...CIVIC_TIMELINE_CONTENT_TYPES],
    sortBy: 'recent',
  });

  const decisionTerminal = useDecisionTerminal({
    groupIds: groupId ? [groupId] : undefined,
  });

  const civicTimeline = useCivicTimeline({
    userId,
    userEmail: user?.email || undefined,
    filters,
    radiusKm,
    decisions: decisionTerminal.decisions,
    decisionsLoading: decisionTerminal.isLoading,
  });

  const activeFilterCount = useMemo(
    () =>
      countCivicFilters({
        contentTypeCount: filters.contentTypes.length,
        totalContentTypeCount: CIVIC_TIMELINE_CONTENT_TYPES.length,
        dateRange: filters.dateRange,
        topicsCount: filters.topics.length,
        radiusKm,
      }),
    [filters.contentTypes.length, filters.dateRange, filters.topics.length, radiusKm]
  );

  const handleSortChange = useCallback(
    (sort: TimelineSortOption) => {
      setSortBy(sort);
    },
    [setSortBy]
  );

  const handleResetFilters = useCallback(() => {
    setContentTypes([...CIVIC_TIMELINE_CONTENT_TYPES]);
    setDateRange('all');
    setTopics([]);
    setEngagement('all');
    setRadiusKm(DEFAULT_RADIUS);
  }, [setContentTypes, setDateRange, setEngagement, setTopics]);

  const handleMapItemSelect = useCallback((item: CivicTimelineItem) => {
    setActiveItemId(item.id);
    scrollRailItemIntoView(item.id);
  }, []);

  const handleRailItemSelect = useCallback((item: CivicTimelineItem) => {
    setActiveItemId(item.id);
  }, []);

  return {
    userId,
    mode,
    setMode,
    filters,
    setContentTypes,
    toggleContentType,
    setDateRange,
    toggleTopic,
    setEngagement,
    showFilterPanel,
    setShowFilterPanel,
    radiusKm,
    setRadiusKm,
    activeItemId,
    setActiveItemId,
    decisionTerminal,
    civicTimeline,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
    handleSortChange,
    handleResetFilters,
    handleMapItemSelect,
    handleRailItemSelect,
  };
}

export type UseTimelinePageReturn = ReturnType<typeof useTimelinePage>;
