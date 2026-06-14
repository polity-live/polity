import type { Dispatch, ReactNode, SetStateAction } from 'react';

import type { ContentType } from '@/features/timeline/constants/content-type-config';
import {
  type DateRangeFilter,
  type EngagementFilter,
} from '@/features/timeline/hooks/useTimelineFilters';
import { TimelineFilterPanel } from '@/features/timeline/ui/TimelineFilterPanel';
import { SearchHeader } from './SearchHeader';

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
  onTopicToggle: (topic: string) => void;
  engagement: EngagementFilter;
  onEngagementChange: (engagement: EngagementFilter) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  totalResults: number;
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
  onTopicToggle,
  engagement,
  onEngagementChange,
  onResetFilters,
  hasActiveFilters,
  totalResults,
  results,
}: SearchPageViewProps) {
  return (
    <div>
      <SearchHeader
        searchQuery={searchQuery}
        setSearchQuery={onSearchQueryChange}
        showFilters={showFilters}
        setShowFilters={onShowFiltersChange}
        activeTopics={topics}
        onTopicRemove={onTopicToggle}
        totalResults={totalResults}
        queryParam={searchQuery}
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

      {results}
    </div>
  );
}
