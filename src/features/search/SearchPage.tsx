import { useSearchPage } from './hooks/useSearchPage';
import { SearchPageView } from './ui/SearchPageView';
import { SpatialSearchView } from './ui/SpatialSearchView';
import { VirtualSearchGrid } from './ui/VirtualSearchGrid';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation';

export function SearchPage() {
  const sp = useSearchPage();
  const { handlers: viewSwipeHandlers } = useSwipeNavigation({
    canSwipePrev: sp.view === 'spatial',
    canSwipeNext: sp.view === 'list',
    onSwipePrev: () => sp.setView('list'),
    onSwipeNext: () => sp.setView('spatial'),
    keyboardMode: 'global',
  });
  const results =
    sp.view === 'spatial' ? (
      <SpatialSearchView
        context={sp.searchContext}
        permalinkID={sp.permalinkId}
        onTotalChange={sp.setTotalResults}
      />
    ) : (
      <VirtualSearchGrid
        context={sp.searchContext}
        permalinkID={sp.permalinkId}
        onTotalChange={sp.setTotalResults}
      />
    );

  return (
    <SearchPageView
      searchQuery={sp.searchQuery}
      onSearchQueryChange={sp.setSearchQuery}
      showFilters={sp.showFilters}
      onShowFiltersChange={sp.setShowFilters}
      contentTypes={sp.contentTypes}
      onContentTypesChange={sp.setContentTypes}
      onContentTypeToggle={sp.toggleContentType}
      dateRange={sp.dateRange}
      onDateRangeChange={sp.setDateRange}
      topics={sp.topics}
      availableTopics={sp.availableTopics}
      personalTopics={sp.personalTopics}
      onTopicToggle={sp.toggleTopic}
      engagement={sp.engagement}
      onEngagementChange={sp.setEngagement}
      onResetFilters={sp.resetFilters}
      hasActiveFilters={sp.hasActiveFilters}
      totalResults={sp.totalResults}
      view={sp.view}
      onViewChange={sp.setView}
      swipeHandlers={viewSwipeHandlers}
      results={results}
    />
  );
}
