import { useEffect, useRef } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useWorkspacePreferences } from '@/zero/preferences/useWorkspacePreferences';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';
import type { SearchViewMode } from './hooks/useSearchURL';
import { useSearchPage } from './hooks/useSearchPage';
import { SearchPageView } from './ui/SearchPageView';
import { SpatialSearchView } from './ui/SpatialSearchView';
import { VirtualSearchGrid } from './ui/VirtualSearchGrid';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation';
import { SearchCardStateProvider } from './SearchCardStateProvider';

export function SearchPage() {
  const sp = useSearchPage();
  const { t } = useTranslation();
  const preference = useWorkspacePreferences();
  const params = useSearch({ strict: false });
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || preference.isLoading) return;
    initialized.current = true;
    if (!params.view && preference.display.searchView) sp.setView(preference.display.searchView);
  }, [preference.isLoading, preference.display.searchView, params.view, sp.setView]);
  const setView = (view: SearchViewMode) => {
    initialized.current = true;
    sp.setView(view);
    void preference
      .setDisplay({ searchView: view })
      .catch(() => toast.error(t('common.workspace.saveFailed')));
  };
  const { handlers: viewSwipeHandlers } = useSwipeNavigation({
    canSwipePrev: sp.view === 'spatial',
    canSwipeNext: sp.view !== 'spatial',
    onSwipePrev: () => setView('list'),
    onSwipeNext: () => setView('spatial'),
    keyboardMode: 'global',
  });
  const resultView =
    sp.view === 'spatial' ? (
      <SpatialSearchView
        context={sp.searchContext}
        permalinkID={sp.permalinkId}
        onTotalChange={sp.setTotalResults}
      />
    ) : (
      <VirtualSearchGrid
        key={sp.view}
        compact={sp.view === 'compact'}
        context={sp.searchContext}
        permalinkID={sp.permalinkId}
        onTotalChange={sp.setTotalResults}
      />
    );

  return (
    <SearchCardStateProvider>
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
        onViewChange={setView}
        swipeHandlers={viewSwipeHandlers}
        results={resultView}
      />
    </SearchCardStateProvider>
  );
}
