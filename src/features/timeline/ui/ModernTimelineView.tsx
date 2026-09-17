'use client';
import { useState } from 'react';

import { MapPinned, Sparkles } from 'lucide-react';

import { Button } from '@/features/shared/ui/ui/button';
import { DecisionTerminal } from '@/features/decision-terminal/ui/DecisionTerminal';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { CIVIC_TIMELINE_CONTENT_TYPES } from '../logic/civicTimeline';
import type { UseTimelinePageReturn } from '../hooks/useTimelinePage';
import { CivicTimelineMap } from './CivicTimelineMap';
import { CivicTimelineRail } from './CivicTimelineRail';
import { TimelineFilterPanel } from './TimelineFilterPanel';
import { TimelineHeader } from './TimelineHeader';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation';
import { StatementStoryCarousel } from '@/features/statements/ui/StatementStoryCarousel';

export interface ModernTimelineViewProps extends UseTimelinePageReturn {
  className?: string;
  virtualizeTimeline?: boolean;
  mapVisible?: boolean;
  onMapVisibilityChange?: (visible: boolean) => void;
}

export function ModernTimelineView({
  className,
  virtualizeTimeline = false,
  mapVisible,
  onMapVisibilityChange,
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
  hasActiveFilters,
  handleSortChange,
  handleResetFilters,
  handleMapItemSelect,
  handleRailItemSelect,
}: ModernTimelineViewProps) {
  const { t } = useTranslation();
  const [localMapVisible, setLocalMapVisible] = useState(false);
  const showMap = mapVisible ?? localMapVisible;
  const { handlers: timelineModeSwipeHandlers } = useSwipeNavigation({
    canSwipePrev: mode === 'decisions',
    canSwipeNext: mode === 'timeline',
    onSwipePrev: () => setMode('timeline'),
    onSwipeNext: () => setMode('decisions'),
    keyboardMode: 'global',
  });

  if (!userId) {
    return null;
  }

  if (mode === 'decisions') {
    return (
      <div
        className={cn('space-y-3', className)}
        style={{ touchAction: 'pan-y' }}
        {...timelineModeSwipeHandlers}
      >
        <TimelineHeader
          mode={mode}
          onModeChange={setMode}
          sortBy={filters.sortBy}
          onSortChange={handleSortChange}
          decisionsBadge={decisionTerminal.urgentCount}
          showTitle={false}
        />
        <DecisionTerminal
          decisions={decisionTerminal.decisions}
          isLoading={decisionTerminal.isLoading}
        />
      </div>
    );
  }

  return (
    <div
      className={cn('space-y-3', className)}
      style={{ touchAction: 'pan-y' }}
      {...timelineModeSwipeHandlers}
    >
      <TimelineHeader
        mode={mode}
        onModeChange={setMode}
        sortBy={filters.sortBy}
        onSortChange={handleSortChange}
        onFilterClick={() => setShowFilterPanel(current => !current)}
        activeFilterCount={activeFilterCount}
        decisionsBadge={decisionTerminal.urgentCount}
        showSort={false}
        showTitle={false}
        filtersOpen={showFilterPanel}
        actions={
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-pressed={showMap}
              aria-label={t(showMap ? 'common.workspace.hideMap' : 'common.workspace.showMap')}
              title={t(showMap ? 'common.workspace.hideMap' : 'common.workspace.showMap')}
              data-action-id="timeline.map.toggle"
              onClick={() => {
                setLocalMapVisible(!showMap);
                onMapVisibilityChange?.(!showMap);
              }}
            >
              <MapPinned className="size-4" />
            </Button>
            <span className="inline-flex items-center whitespace-nowrap">
              {t('features.timeline.around.mappedCount', {
                count: civicTimeline.mapItems.length,
                defaultValue: '{{count}} mapped',
              })}
            </span>
            {civicTimeline.discoverCount > 0 ? (
              <span className="inline-flex items-center whitespace-nowrap">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {t('features.timeline.around.discoverCount', {
                  count: civicTimeline.discoverCount,
                  defaultValue: '{{count}} discover',
                })}
              </span>
            ) : null}
          </div>
        }
      />

      {showFilterPanel ? (
        <TimelineFilterPanel
          open={showFilterPanel}
          onClose={() => setShowFilterPanel(false)}
          contentTypes={filters.contentTypes}
          contentTypeOptions={CIVIC_TIMELINE_CONTENT_TYPES}
          onContentTypesChange={setContentTypes}
          onContentTypeToggle={toggleContentType}
          dateRange={filters.dateRange}
          onDateRangeChange={setDateRange}
          topics={filters.topics}
          availableTopics={civicTimeline.availableTopics}
          onTopicToggle={toggleTopic}
          engagement={filters.engagement}
          onEngagementChange={setEngagement}
          onResetFilters={handleResetFilters}
          hasActiveFilters={hasActiveFilters}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          showEngagement={false}
        />
      ) : null}

      <StatementStoryCarousel />

      <div
        className={cn(
          'grid min-w-0 grid-cols-1 gap-4',
          showMap &&
            civicTimeline.mapItems.length > 0 &&
            'lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]'
        )}
        data-testid="timeline-map-rail-grid"
      >
        {showMap && civicTimeline.mapItems.length === 0 ? (
          <p role="status" className="text-muted-foreground text-sm">
            {t('common.workspace.noMappedActivity')}
          </p>
        ) : null}
        {showMap && civicTimeline.mapItems.length > 0 ? (
          <div
            className="max-w-full min-w-0 lg:sticky lg:top-4 lg:self-start"
            data-swipe-lock
            data-testid="timeline-map-column"
          >
            <CivicTimelineMap
              items={civicTimeline.mapItems}
              activeItemId={activeItemId}
              onActiveItemChange={setActiveItemId}
              onItemSelect={handleMapItemSelect}
            />
            {!civicTimeline.userCoordinates ? (
              <div className="bg-muted/30 text-muted-foreground mt-2 rounded-lg border px-3 py-2 text-xs">
                {t('features.timeline.around.noUserLocation', {
                  defaultValue:
                    'Add a location to your profile to make nearby activity more precise.',
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="max-w-full min-w-0" data-testid="timeline-rail-column">
          <div className="min-w-0 px-1 sm:px-3" data-testid="timeline-rail-surface">
            <CivicTimelineRail
              sections={civicTimeline.sections}
              activeItemId={activeItemId}
              isLoading={civicTimeline.isLoading}
              onActiveItemChange={setActiveItemId}
              onItemSelect={handleRailItemSelect}
              queryContext={virtualizeTimeline ? { contentTypes: filters.contentTypes } : undefined}
            />
          </div>

          {civicTimeline.items.length > 0 ? (
            <div className="mt-6 flex justify-center">
              <Button data-action-scope="presentation" variant="outline" asChild>
                <SmartLink
                  data-action-id="timeline.empty.search.open"
                  data-action-kind="navigation"
                  href="/search"
                >
                  {t('features.timeline.discoverContent', {
                    defaultValue: 'Discover Content',
                  })}
                </SmartLink>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
