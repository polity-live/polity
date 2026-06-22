'use client';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAgendaItemCRVoting } from '../hooks/useAgendaItemCRVoting';

interface AgendaCRVoteTimelineProps {
  agendaItemId: string;
  userId?: string;
  canManage?: boolean;
  canVote?: boolean;
}
import { AgendaCRVoteTimelineView } from './AgendaCRVoteTimelineView';
export function AgendaCRVoteTimeline({
  agendaItemId,
  userId,
  canManage = false,
  canVote = false,
}: AgendaCRVoteTimelineProps) {
  const { t } = useTranslation();
  const {
    crTimeline,
    currentItem,
    completedItems,
    progress,
    isLoading,
    hasUserVoted,
    getUserSelectedChoiceIds,
    allCRsProcessed,
    isTimelineComplete,
    castCRVote,
    startIndicativePhase,
    startFinalPhase,
    closeVoting,
  } = useAgendaItemCRVoting(agendaItemId, userId);

  if (isLoading || crTimeline.length === 0) {
    return null;
  }

  const progressPercent = Math.round(progress * 100);
  return (
    <AgendaCRVoteTimelineView
      agendaItemId={agendaItemId}
      allCRsProcessed={allCRsProcessed}
      canManage={canManage}
      canVote={canVote}
      castCRVote={castCRVote}
      closeVoting={closeVoting}
      completedItems={completedItems}
      crTimeline={crTimeline}
      currentItem={currentItem}
      getUserSelectedChoiceIds={getUserSelectedChoiceIds}
      hasUserVoted={hasUserVoted}
      isLoading={isLoading}
      isTimelineComplete={isTimelineComplete}
      progress={progress}
      progressPercent={progressPercent}
      startFinalPhase={startFinalPhase}
      startIndicativePhase={startIndicativePhase}
      t={t}
      userId={userId}
    />
  );
}
