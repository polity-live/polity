'use client';

import { useState } from 'react';
import { useEventVoting, type MajorityType, type VotingType } from '../hooks/useEventVoting';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface VotingSessionManagerProps {
  eventId: string;
  agendaItemId: string;
  agendaItemTitle: string;
  votingType: VotingType;
  targetEntityId: string;
}

export function useVotingSessionManagerController({
  eventId,
  agendaItemId,
  agendaItemTitle,
  votingType,
  targetEntityId,
}: VotingSessionManagerProps) {
  const { t } = useTranslation();

  const {
    currentSession,
    votedCount,
    totalVoters,
    canManageVoting,
    voteResults,
    isLoading,
    timeRemaining,
    startIntroductionPhase,
    startVotingPhase,
    closeVoting,
  } = useEventVoting(eventId, agendaItemId);

  const [majorityType, setMajorityType] = useState<MajorityType>('simple');

  const [timeLimit, setTimeLimit] = useState(300);

  // 5 minutes default
  const [expanded, setExpanded] = useState(true);

  const handleStartIntroduction = async () => {
    await startIntroductionPhase({
      agendaItemId,
      votingType,
      targetEntityId,
      majorityType,
      autoCloseOnAllVoted: true,
    });
  };

  const handleStartVoting = async () => {
    if (currentSession) {
      await startVotingPhase(currentSession.id, timeLimit);
    }
  };

  const handleCloseVoting = async () => {
    if (currentSession) {
      await closeVoting(currentSession.id);
    }
  };

  // Calculate progress
  const votingProgress = totalVoters > 0 ? (votedCount / totalVoters) * 100 : 0;

  return {
    eventId,
    agendaItemId,
    agendaItemTitle,
    votingType,
    targetEntityId,
    t,
    currentSession,
    votedCount,
    totalVoters,
    canManageVoting,
    voteResults,
    isLoading,
    timeRemaining,
    startIntroductionPhase,
    startVotingPhase,
    closeVoting,
    majorityType,
    setMajorityType,
    timeLimit,
    setTimeLimit,
    expanded,
    setExpanded,
    handleStartIntroduction,
    handleStartVoting,
    handleCloseVoting,
    votingProgress,
  };
}
