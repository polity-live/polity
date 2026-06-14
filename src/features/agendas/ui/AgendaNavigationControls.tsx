'use client';

import { useAgendaNavigation } from '../hooks/useAgendaNavigation';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface AgendaNavigationControlsProps {
  eventId: string;
}
import { AgendaNavigationControlsView } from './AgendaNavigationControlsView';
export function AgendaNavigationControls({ eventId }: AgendaNavigationControlsProps) {
  const { t } = useTranslation();
  const {
    currentAgendaItem,
    currentIndex,
    totalItems,
    canNavigate,
    isLoading,
    moveToNextItem,
    moveToPreviousItem,
    completeCurrentItem,
    hasNextItem,
    hasPreviousItem,
  } = useAgendaNavigation(eventId);

  // Only show for users who can manage agenda
  if (!canNavigate) {
    return null;
  }

  const progressPercentage = totalItems > 0 ? ((currentIndex + 1) / totalItems) * 100 : 0;
  return (
    <AgendaNavigationControlsView
      canNavigate={canNavigate}
      completeCurrentItem={completeCurrentItem}
      currentAgendaItem={currentAgendaItem}
      currentIndex={currentIndex}
      eventId={eventId}
      hasNextItem={hasNextItem}
      hasPreviousItem={hasPreviousItem}
      isLoading={isLoading}
      moveToNextItem={moveToNextItem}
      moveToPreviousItem={moveToPreviousItem}
      progressPercentage={progressPercentage}
      t={t}
      totalItems={totalItems}
    />
  );
}
