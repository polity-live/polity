import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react';

import type { ContentType } from '@/features/timeline/constants/content-type-config';
import {
  type DateRangeFilter,
  type EngagementFilter,
} from '@/features/timeline/hooks/useTimelineFilters';
import { TimelineFilterPanel } from '@/features/timeline/ui/TimelineFilterPanel';
import type { SearchViewMode } from '../hooks/useSearchURL';
import { SearchHeader } from './SearchHeader';
import type { SwipeNavigationHandlers } from '@/features/shared/hooks/useSwipeNavigation';

export interface SearchPageViewProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  showFilters: boolean;
  onShowFiltersChange: Dispatch<SetStateAction<boolean>>;
  contentTypes: ContentType[];
  onContentTypesChange: (types: ContentType[]) => void;
  onContentTypeToggle: (type: ContentType) => void;
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  topics: string[];
  availableTopics: string[];
  personalTopics?: string[];
  onTopicToggle: (topic: string) => void;
  engagement: EngagementFilter;
  onEngagementChange: (engagement: EngagementFilter) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  totalResults: number | null;
  view: SearchViewMode;
  onViewChange: (view: SearchViewMode) => void;
  swipeHandlers: SwipeNavigationHandlers;
  results: ReactNode;
}

export function SearchPageView({
  searchQuery,
  onSearchQueryChange,
  showFilters,
  onShowFiltersChange,
  contentTypes,
  onContentTypesChange,
  onContentTypeToggle,
  dateRange,
  onDateRangeChange,
  topics,
  availableTopics,
  personalTopics = [],
  onTopicToggle,
  engagement,
  onEngagementChange,
  onResetFilters,
  hasActiveFilters,
  totalResults,
  view,
  onViewChange,
  swipeHandlers,
  results,
}: SearchPageViewProps) {
  const searchLayoutStyle: CSSProperties = {
    touchAction: 'pan-y',
    height:
      'calc(100dvh - var(--app-shell-mobile-top-offset, 0rem) - var(--app-shell-mobile-bottom-offset, 0rem) - 1.5rem)',
  };

  return (
    <div
      className="-mb-6 flex min-h-0 flex-col overflow-hidden"
      data-testid="search-page-layout"
      style={searchLayoutStyle}
      {...swipeHandlers}
    >
      <SearchHeader
        searchQuery={searchQuery}
        setSearchQuery={onSearchQueryChange}
        showFilters={showFilters}
        setShowFilters={onShowFiltersChange}
        activeTopics={topics}
        personalTopics={personalTopics}
        onTopicToggle={onTopicToggle}
        totalResults={totalResults}
        queryParam={searchQuery}
        view={view}
        onViewChange={onViewChange}
      />

      {showFilters ? (
        <TimelineFilterPanel
          open={showFilters}
          onClose={() => onShowFiltersChange(false)}
          contentTypes={contentTypes}
          onContentTypesChange={onContentTypesChange}
          onContentTypeToggle={onContentTypeToggle}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          topics={topics}
          availableTopics={availableTopics}
          onTopicToggle={onTopicToggle}
          engagement={engagement}
          onEngagementChange={onEngagementChange}
          onResetFilters={onResetFilters}
          hasActiveFilters={hasActiveFilters}
        />
      ) : null}

      <div className="min-h-0 flex-1">{results}</div>
    </div>
  );
}
