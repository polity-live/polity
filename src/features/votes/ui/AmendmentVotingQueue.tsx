'use client';
import { useState, useMemo } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useChangeRequestVoting } from '../hooks/useChangeRequestVoting';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';

interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  proposedChange: string;
  characterCount?: number;
  votingOrder?: number;
  status: string;
  source?: string;
  createdAt: number;
  creator?: {
    id: string;
    name?: string;
    avatar?: string;
  };
}

interface VoteSession {
  id: string;
  status: string;
  votingStartTime: number;
  votingEndTime: number;
  currentChangeRequestIndex?: number;
  votes?: {
    id: string;
    vote: string;
    voter: {
      id: string;
      name?: string;
    };
  }[];
}

interface AmendmentVotingQueueProps {
  amendmentId: string;
  eventId: string;
  agendaItemId: string;
  changeRequests: ChangeRequest[];
  currentSession?: VoteSession;
  isOrganizer: boolean;
  onAdvanceToNext: () => void;
  onComplete: () => void;
  userId?: string;
}
import { AmendmentVotingQueueView } from './AmendmentVotingQueueView';
export function AmendmentVotingQueue({
  amendmentId,
  eventId,
  agendaItemId,
  changeRequests,
  currentSession,
  isOrganizer,
  onAdvanceToNext,
  onComplete,
  userId,
}: AmendmentVotingQueueProps) {
  const { t } = useTranslation();
  const [localChangeRequests, setLocalChangeRequests] = useState(changeRequests);

  // Integrate with useChangeRequestVoting for proper voting management
  const {
    currentChangeRequest,
    voteResults: currentVoteResults,
    hasVoted,
    castVote,
    isLoading: votingLoading,
  } = useChangeRequestVoting({
    eventId,
    votingSessionId: currentSession?.id || '',
    userId: userId || '',
    agendaItemId,
    amendmentId,
  });

  // Sort change requests by votingOrder (if set) or characterCount
  const sortedChangeRequests = useMemo(() => {
    return [...localChangeRequests].sort((a, b) => {
      if (a.votingOrder !== undefined && b.votingOrder !== undefined) {
        return a.votingOrder - b.votingOrder;
      }
      if (a.votingOrder !== undefined) return -1;
      if (b.votingOrder !== undefined) return 1;
      return (b.characterCount || 0) - (a.characterCount || 0);
    });
  }, [localChangeRequests]);

  const currentIndex = currentSession?.currentChangeRequestIndex || 0;
  const totalRequests = sortedChangeRequests.length;
  const progress = totalRequests > 0 ? ((currentIndex + 1) / (totalRequests + 1)) * 100 : 0;

  const timeRemaining = currentSession ? Math.max(0, currentSession.votingEndTime - Date.now()) : 0;
  const minutesRemaining = Math.floor(timeRemaining / 60000);
  const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;

    const newOrder = [...sortedChangeRequests];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;

    await updateVotingOrder(newOrder);
  };

  const handleMoveDown = async (index: number) => {
    if (index === sortedChangeRequests.length - 1) return;

    const newOrder = [...sortedChangeRequests];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;

    await updateVotingOrder(newOrder);
  };

  const updateVotingOrder = async (newOrder: ChangeRequest[]) => {
    setLocalChangeRequests(newOrder);
    toast.success(
      translateText('generated.inline.1256_abstimmungsreihenfolge_aktualisiert_4e6d6850')
    );
  };
  return (
    <AmendmentVotingQueueView
      amendmentId={amendmentId}
      eventId={eventId}
      agendaItemId={agendaItemId}
      changeRequests={changeRequests}
      currentSession={currentSession}
      isOrganizer={isOrganizer}
      onAdvanceToNext={onAdvanceToNext}
      onComplete={onComplete}
      userId={userId}
      t={t}
      localChangeRequests={localChangeRequests}
      setLocalChangeRequests={setLocalChangeRequests}
      currentChangeRequest={currentChangeRequest}
      currentVoteResults={currentVoteResults}
      hasVoted={hasVoted}
      castVote={castVote}
      votingLoading={votingLoading}
      sortedChangeRequests={sortedChangeRequests}
      currentIndex={currentIndex}
      totalRequests={totalRequests}
      progress={progress}
      timeRemaining={timeRemaining}
      minutesRemaining={minutesRemaining}
      secondsRemaining={secondsRemaining}
      handleMoveUp={handleMoveUp}
      handleMoveDown={handleMoveDown}
      updateVotingOrder={updateVotingOrder}
    />
  );
}
