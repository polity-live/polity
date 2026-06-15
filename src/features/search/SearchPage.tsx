import { useSearchPage } from './hooks/useSearchPage';
import { SearchPageView } from './ui/SearchPageView';
import { SpatialSearchView } from './ui/SpatialSearchView';
import { VirtualSearchGrid } from './ui/VirtualSearchGrid';

export function SearchPage() {
  const sp = useSearchPage();
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
      results={results}
    />
  );
}
