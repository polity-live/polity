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
      className={cn('bg-muted/50 inline-flex items-center gap-1 rounded-lg border p-1', className)}
      aria-label={translateText('generated.inline.1167_timeline_mode_8f6d2e57')}
    >
      {modes.map(m => {
        const config = MODE_CONFIG[m];
        const Icon = config.icon;
        const isActive = mode === m;
        const badgeCount =
          m === 'timeline' ? followingBadge : m === 'decisions' ? decisionsBadge : undefined;
        const showBadge = badgeCount !== undefined && badgeCount > 0;

        return (
          <ToggleGroupItem
            key={m}
            value={m}
            aria-controls={`timeline-panel-${m}`}
            aria-label={t(config.labelKey)}
            className={cn(
              'relative h-auto gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200',
              isActive ? config.activeClass : cn('text-muted-foreground', config.hoverClass),
              m === 'decisions' && !isActive && 'font-mono text-xs tracking-tight'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t(config.labelKey)}</span>

            {/* Badge */}
            {showBadge && (
              <BadgeControl
                variant={m === 'decisions' ? 'destructive' : 'secondary'}
                className={cn(
                  'ml-1 h-5 min-w-[20px] px-1.5 text-xs',
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
