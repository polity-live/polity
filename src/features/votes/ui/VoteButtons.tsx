'use client';

import {
  SelectedVoteBadge,
  VoteChoiceButtons,
  VotingUnavailableMessage,
  type SelectedVoteLabels,
  type VotingChoiceLabels,
  type VotingChoiceValue,
} from '@/features/shared/ui/voting';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useEventVoting, type VoteValue } from '../hooks/useEventVoting';

interface VoteButtonsProps {
  eventId: string;
  agendaItemId: string;
  sessionId: string;
  size?: 'sm' | 'default' | 'lg';
}

export interface VoteButtonsViewProps {
  canVote: boolean;
  hasUserVoted: boolean;
  userVote: VoteValue | null;
  isLoading: boolean;
  onVote: (vote: VotingChoiceValue) => void | Promise<void>;
  labels: VotingChoiceLabels;
  selectedVoteLabels: SelectedVoteLabels;
  noVotingRightsLabel: string;
  size?: 'sm' | 'default' | 'lg';
}

export function VoteButtonsView({
  canVote,
  hasUserVoted,
  userVote,
  isLoading,
  onVote,
  labels,
  selectedVoteLabels,
  noVotingRightsLabel,
  size = 'default',
}: VoteButtonsViewProps) {
  if (hasUserVoted && userVote) {
    return (
      <div className="flex flex-col items-center gap-2">
        <SelectedVoteBadge vote={userVote} labels={selectedVoteLabels} />
      </div>
    );
  }

  if (!canVote) {
    return <VotingUnavailableMessage>{noVotingRightsLabel}</VotingUnavailableMessage>;
  }

  return <VoteChoiceButtons labels={labels} onVote={onVote} isLoading={isLoading} size={size} />;
}

export function VoteButtons({
  eventId,
  agendaItemId,
  sessionId,
  size = 'default',
}: VoteButtonsProps) {
  const { t } = useTranslation();
  const { canVote, hasUserVoted, userVote, currentSession, isLoading, castVote } = useEventVoting(
    eventId,
    agendaItemId
  );

  if (!currentSession || currentSession.phase !== 'voting') {
    return null;
  }

  const labels = {
    accept: t('features.events.voting.accept'),
    reject: t('features.events.voting.reject'),
    abstain: t('features.events.voting.abstain'),
  };

  return (
    <VoteButtonsView
      canVote={canVote}
      hasUserVoted={hasUserVoted}
      userVote={userVote}
      isLoading={isLoading}
      onVote={vote => castVote(sessionId, vote)}
      labels={labels}
      selectedVoteLabels={{
        ...labels,
        prefix: t('features.events.voting.yourVote'),
      }}
      noVotingRightsLabel={t('features.events.voting.noVotingRights')}
      size={size}
    />
  );
}
