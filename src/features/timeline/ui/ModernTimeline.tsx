'use client';

import { useTimelinePage } from '../hooks/useTimelinePage';
import { ModernTimelineView } from './ModernTimelineView';

export interface ModernTimelineProps {
  className?: string;
  userId?: string;
  groupId?: string;
}

/**
 * Timeline - map + chronological civic activity rail.
 *
 * Keeps the old export name for compatibility while the visible feature is now Timeline.
 */
export function ModernTimeline({ className, userId, groupId }: ModernTimelineProps) {
  const page = useTimelinePage({ userId, groupId });

  return <ModernTimelineView {...page} className={className} virtualizeTimeline />;
}

export const Timeline = ModernTimeline;
