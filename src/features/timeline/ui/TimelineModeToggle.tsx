'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { MapPinned, Monitor } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { ToggleGroup, ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import { cn } from '@/features/shared/utils/utils';
import { TimelineMode } from '../hooks/useTimelineMode';

export interface TimelineModeToggleProps {
  /** Current active mode */
  mode: TimelineMode;
  /** Callback when mode changes */
  onModeChange: (mode: TimelineMode) => void;
  /** Badge count for Following tab (unread count) */
  followingBadge?: number;
  /** Badge count for Decisions tab (urgent votes/elections) */
  decisionsBadge?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Mode configuration with icons and colors
 */
const MODE_CONFIG: Record<
  TimelineMode,
  {
    icon: React.ElementType;
    labelKey: string;
    activeClass: string;
    hoverClass: string;
  }
> = {
  timeline: {
    icon: MapPinned,
    labelKey: 'features.timeline.modes.timeline',
    activeClass:
      'bg-primary text-primary-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
    hoverClass: 'hover:bg-primary/10',
  },
  decisions: {
    icon: Monitor,
    labelKey: 'features.timeline.modes.decisions',
    activeClass: featureThemeClassName('timelineTimelineModeToggleNeutralBackground'),
    hoverClass: featureThemeClassName('timelineTimelineModeToggleNeutralBackgroundAlpha'),
  },
};

/**
 * TimelineModeToggle - Two-tab mode selector for timeline
 *
 * Displays tabs for:
 * - Timeline: Map + time rail around the user
 * - Decisions: Bloomberg-style terminal for votes/elections
 *
 * Features:
 * - Badge on Following showing unread count
 * - Badge on Decisions showing urgent vote count (red)
 * - Decisions tab has distinct darker styling
 * - Smooth transition animation between modes
 */
export function TimelineModeToggle({
  mode,
  onModeChange,
  followingBadge,
  decisionsBadge,
  className,
}: TimelineModeToggleProps) {
  const { t } = useTranslation();

  const modes: TimelineMode[] = ['timeline', 'decisions'];

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={nextMode => {
        if (nextMode === 'timeline' || nextMode === 'decisions') {
          onModeChange(nextMode);
        }
      }}
      className={cn(
        'inline-flex shrink-0 items-center gap-0 overflow-hidden rounded-md border',
        className
      )}
      aria-label={translateText('generated.inline.1167_timeline_mode_8f6d2e57')}
    >
      {modes.map(m => {
        const config = MODE_CONFIG[m];
        const Icon = config.icon;
        const isActive = mode === m;
        const badgeCount = m === 'timeline' ? followingBadge : decisionsBadge;
        const showBadge = badgeCount !== undefined && badgeCount > 0;

        return (
          <ToggleGroupItem
            data-action-id="timeline.mode.select"
            data-action-kind="selection"
            key={m}
            value={m}
            aria-label={t(config.labelKey)}
            title={t(config.labelKey)}
            className={cn(
              'relative size-9 shrink-0 rounded-none p-0 text-sm font-medium transition-colors',
              isActive ? config.activeClass : cn('text-muted-foreground', config.hoverClass),
              m === 'decisions' && !isActive && 'font-mono text-xs tracking-tight'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only">{t(config.labelKey)}</span>

            {/* Badge */}
            {showBadge && (
              <BadgeControl
                variant={m === 'decisions' ? 'destructive' : 'secondary'}
                className={cn(
                  'absolute top-0 right-0 h-3.5 min-w-3.5 px-0.5 text-[9px]',
                  m === 'decisions' &&
                    'dark:border-transparent dark:bg-[#8a332b] dark:text-slate-50 dark:hover:bg-[#8a332b] dark:hover:text-slate-50',
                  isActive &&
                    m !== 'decisions' &&
                    'bg-primary-foreground/20 text-primary-foreground'
                )}
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </BadgeControl>
            )}

            {/* Urgent indicator for decisions */}
            {m === 'decisions' &&
              decisionsBadge !== undefined &&
              decisionsBadge > 0 &&
              !isActive && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span
                    className={featureThemeClassName('timelineTimelineModeToggleDangerRoundIcon')}
                  />
                  <span
                    className={featureThemeClassName(
                      'timelineTimelineModeToggleDangerRoundIconAlpha'
                    )}
                  />
                </span>
              )}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export default TimelineModeToggle;
