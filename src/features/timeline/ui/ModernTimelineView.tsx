'use client';

import { BadgeControl } from '@/features/shared/ui/status';
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
}

export function ModernTimelineView({
  className,
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
        className={cn('space-y-4', className)}
        style={{ touchAction: 'pan-y' }}
        {...timelineModeSwipeHandlers}
      >
        <TimelineHeader
          mode={mode}
          onModeChange={setMode}
          sortBy={filters.sortBy}
          onSortChange={handleSortChange}
          decisionsBadge={decisionTerminal.urgentCount}
          subtitle={t('features.timeline.header.decisionsSubtitle', {
            defaultValue: 'Live votes, elections, and recently closed decisions.',
          })}
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
      className={cn('space-y-4', className)}
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

      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        <BadgeControl variant="outline" shape="rounded">
          <MapPinned className="mr-1.5 h-3.5 w-3.5" />
          {t('features.timeline.around.mappedCount', {
            count: civicTimeline.mapItems.length,
            defaultValue: '{{count}} mapped',
          })}
        </BadgeControl>
        {civicTimeline.discoverCount > 0 ? (
          <BadgeControl variant="outline" shape="rounded">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {t('features.timeline.around.discoverCount', {
              count: civicTimeline.discoverCount,
              defaultValue: '{{count}} discover',
            })}
          </BadgeControl>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start" data-swipe-lock>
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

        <div>
          <div
            className="bg-card rounded-lg border p-4 shadow-sm sm:p-5"
            data-testid="timeline-rail-surface"
          >
            <CivicTimelineRail
              sections={civicTimeline.sections}
              activeItemId={activeItemId}
              isLoading={civicTimeline.isLoading}
              onActiveItemChange={setActiveItemId}
              onItemSelect={handleRailItemSelect}
            />
          </div>

          {civicTimeline.items.length > 0 ? (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" asChild>
                <SmartLink href="/search">
                  {t('features.timeline.discoverContent', { defaultValue: 'Discover Content' })}
                </SmartLink>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
