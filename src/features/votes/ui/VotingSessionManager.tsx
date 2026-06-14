'use client';

import { type VotingType } from '../hooks/useEventVoting';

interface VotingSessionManagerProps {
  eventId: string;
  agendaItemId: string;
  agendaItemTitle: string;
  votingType: VotingType;
  targetEntityId: string;
}

import { useVotingSessionManagerController } from './useVotingSessionManagerController';
import { VotingSessionManagerView } from './VotingSessionManagerView';

export function VotingSessionManager({
  eventId,
  agendaItemId,
  agendaItemTitle,
  votingType,
  targetEntityId,
}: VotingSessionManagerProps) {
  const viewProps = useVotingSessionManagerController({
    eventId,
    agendaItemId,
    agendaItemTitle,
    votingType,
    targetEntityId,
  });

  return <VotingSessionManagerView {...viewProps} />;
}
