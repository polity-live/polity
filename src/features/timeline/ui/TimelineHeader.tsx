'use client';

import type { ReactNode } from 'react';

import { BadgeControl } from '@/features/shared/ui/status';
import { SlidersHorizontal, ArrowUpDown, Settings } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';
import { TimelineModeToggle } from './TimelineModeToggle';
import { TimelineMode } from '../hooks/useTimelineMode';
import { TimelineSortOption } from '../hooks/useTimelineFilters';

export interface TimelineHeaderProps {
  /** Current active mode */
  mode: TimelineMode;
  /** Callback when mode changes */
  onModeChange: (mode: TimelineMode) => void;
  /** Current sort option */
  sortBy: TimelineSortOption;
  /** Callback when sort changes */
  onSortChange: (sort: TimelineSortOption) => void;
  /** Callback to open filter panel */
  onFilterClick?: () => void;
  /** Number of active filters */
  activeFilterCount?: number;
  /** Badge count for Following tab (unread count) */
  followingBadge?: number;
  /** Badge count for Decisions tab (urgent votes/elections) */
  decisionsBadge?: number;
  /** Callback to open settings */
  onSettingsClick?: () => void;
  /** Whether to show the sort dropdown */
  showSort?: boolean;
  /** Optional short context line below the title */
  subtitle?: string;
  /** Whether to render the title row */
  showTitle?: boolean;
  /** Additional CSS classes */
  className?: string;
  actions?: ReactNode;
  filtersOpen?: boolean;
}

/**
 * Sort options with labels
 */
const SORT_OPTIONS: { value: TimelineSortOption; labelKey: string }[] = [
  { value: 'recent', labelKey: 'features.timeline.sort.recent' },
  { value: 'trending', labelKey: 'features.timeline.sort.trending' },
  { value: 'engagement', labelKey: 'features.timeline.sort.engagement' },
];

/**
 * TimelineHeader - Main header for the timeline page
 *
 * Features:
 * - Title: "Your Political Ecosystem"
 * - Mode Toggle: Following / Decisions
 * - Filter button (hidden in Decisions mode)
 * - Sort dropdown
 * - Settings icon
 */
export function TimelineHeader({
  mode,
  onModeChange,
  sortBy,
  onSortChange,
  onFilterClick,
  activeFilterCount = 0,
  followingBadge,
  decisionsBadge,
  onSettingsClick,
  showSort = true,
  subtitle,
  showTitle = true,
  className,
  actions,
  filtersOpen,
}: TimelineHeaderProps) {
  const { t } = useTranslation();
  const isDecisionsMode = mode === 'decisions';

  return (
    <div className={cn(showTitle && 'space-y-2', className)}>
      {showTitle ? (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-sans text-base font-semibold">
              {t('features.timeline.header.title', { defaultValue: 'Timeline' })}
            </h1>
            {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
          </div>

          {onSettingsClick && (
            <Button
              data-action-id="timeline.header.settings.open"
              data-action-kind="interaction"
              variant="ghost"
              size="icon"
              onClick={onSettingsClick}
            >
              <Settings className="h-5 w-5" />
              <span className="sr-only">
                {t('features.timeline.header.settings', { defaultValue: 'Settings' })}
              </span>
            </Button>
          )}
        </div>
      ) : (
        <h1 className="sr-only">
          {t('features.timeline.header.title', { defaultValue: 'Timeline' })}
        </h1>
      )}

      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Mode toggle */}
        <TimelineModeToggle
          mode={mode}
          onModeChange={onModeChange}
          followingBadge={followingBadge}
          decisionsBadge={decisionsBadge}
        />

        {/* Filter and sort controls */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
          {/* Filter button - hidden in Decisions mode */}
          {!isDecisionsMode && onFilterClick && (
            <Button
              data-action-id="timeline.header.filters.open"
              data-action-kind="interaction"
              variant="outline"
              size="icon"
              aria-label={t('features.timeline.header.filter', { defaultValue: 'Filter' })}
              title={t('features.timeline.header.filter', { defaultValue: 'Filter' })}
              aria-expanded={filtersOpen}
              onClick={onFilterClick}
              className="relative"
            >
              <SlidersHorizontal className="size-4" />

              {/* Active filter count badge */}
              {activeFilterCount > 0 && (
                <BadgeControl
                  variant="secondary"
                  size="xs"
                  className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                >
                  {activeFilterCount}
                </BadgeControl>
              )}
            </Button>
          )}

          {/* Sort dropdown - hidden in Decisions mode (has its own sorting) */}
          {!isDecisionsMode && showSort && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  data-action-id="timeline.header.sort.open"
                  data-action-kind="interaction"
                  variant="outline"
                  size="sm"
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  {t(`features.timeline.sort.${sortBy}`, { defaultValue: 'Sort' })}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_OPTIONS.map(option => (
                  <DropdownMenuItem
                    data-action-id="timeline.header.sort.select"
                    data-action-kind="selection"
                    key={option.value}
                    onClick={() => onSortChange(option.value)}
                    className={cn(sortBy === option.value && 'bg-accent')}
                  >
                    {t(option.labelKey, { defaultValue: option.value })}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

export default TimelineHeader;
