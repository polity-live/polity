'use client';

import { useCallback, useMemo, useState } from 'react';
import { MapPinned, Sparkles } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Badge } from '@/features/shared/ui/ui/badge';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { DecisionTerminal } from '@/features/decision-terminal/ui/DecisionTerminal';
import { useDecisionTerminal } from '@/features/decision-terminal/hooks/useDecisionTerminal';
import { CIVIC_TIMELINE_CONTENT_TYPES, type CivicTimelineItem } from '../logic/civicTimeline';
import { useCivicTimeline } from '../hooks/useCivicTimeline';
import { useTimelineMode } from '../hooks/useTimelineMode';
import { useTimelineFilters, type TimelineSortOption } from '../hooks/useTimelineFilters';
import { CivicTimelineMap } from './CivicTimelineMap';
import { CivicTimelineRail } from './CivicTimelineRail';
import { TimelineFilterPanel, type TimelineRadiusFilter } from './TimelineFilterPanel';
import { TimelineHeader } from './TimelineHeader';

interface ModernTimelineProps {
  className?: string;
  userId?: string;
  groupId?: string;
}

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

/**
 * Timeline - map + chronological civic activity rail.
 *
 * Keeps the old export name for compatibility while the visible feature is now Timeline.
 */
export function ModernTimeline({ className, userId: userIdProp, groupId }: ModernTimelineProps) {
  const { t } = useTranslation();
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

  const hasActiveFilters = activeFilterCount > 0;

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

  if (!userId) {
    return null;
  }

  if (mode === 'decisions') {
    return (
      <div className={cn('space-y-4', className)}>
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
    <div className={cn('space-y-4', className)}>
      <TimelineHeader
        mode={mode}
        onModeChange={setMode}
        sortBy={filters.sortBy}
        onSortChange={handleSortChange}
        onFilterClick={() => setShowFilterPanel(current => !current)}
        activeFilterCount={activeFilterCount}
        decisionsBadge={decisionTerminal.urgentCount}
        showSort={false}
        subtitle={t('features.timeline.header.subtitle', {
          defaultValue: 'What is happening around you, ranked by relevance and proximity.',
        })}
      />

      {showFilterPanel && (
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
      )}

      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className="rounded-md">
          <MapPinned className="mr-1.5 h-3.5 w-3.5" />
          {t('features.timeline.around.mappedCount', {
            count: civicTimeline.mapItems.length,
            defaultValue: '{{count}} mapped',
          })}
        </Badge>
        {civicTimeline.discoverCount > 0 && (
          <Badge variant="outline" className="rounded-md">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {t('features.timeline.around.discoverCount', {
              count: civicTimeline.discoverCount,
              defaultValue: '{{count}} discover',
            })}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <CivicTimelineMap
            items={civicTimeline.mapItems}
            activeItemId={activeItemId}
            onActiveItemChange={setActiveItemId}
            onItemSelect={handleMapItemSelect}
          />
          {!civicTimeline.userCoordinates && (
            <div className="bg-muted/30 text-muted-foreground mt-2 rounded-lg border px-3 py-2 text-xs">
              {t('features.timeline.around.noUserLocation', {
                defaultValue:
                  'Add a location to your profile to make nearby activity more precise.',
              })}
            </div>
          )}
        </div>

        <div>
          <CivicTimelineRail
            sections={civicTimeline.sections}
            activeItemId={activeItemId}
            isLoading={civicTimeline.isLoading}
            onActiveItemChange={setActiveItemId}
            onItemSelect={handleRailItemSelect}
          />

          {civicTimeline.items.length > 0 && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" asChild>
                <a href="/search">
                  {t('features.timeline.discoverContent', { defaultValue: 'Discover Content' })}
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const Timeline = ModernTimeline;
