'use client';

import { useTimelinePage } from '../hooks/useTimelinePage';
import { ModernTimelineView } from './ModernTimelineView';
import { useWorkspacePreferences } from '@/zero/preferences/useWorkspacePreferences';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { toast } from '@/features/shared/ui/ui/sonner';

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
  const { display, setDisplay } = useWorkspacePreferences();
  const { t } = useTranslation();

  return (
    <ModernTimelineView
      {...page}
      className={className}
      virtualizeTimeline
      mapVisible={display.timelineMapVisible ?? false}
      onMapVisibilityChange={visible => {
        void setDisplay({ timelineMapVisible: visible }).catch(() =>
          toast.error(t('common.workspace.saveFailed'))
        );
      }}
    />
  );
}

export const Timeline = ModernTimeline;
