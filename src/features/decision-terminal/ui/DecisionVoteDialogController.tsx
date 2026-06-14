'use client';

import { useState } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { mutators } from '@/zero/mutators';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { useVoteCasting } from '@/features/vote-cast/hooks/useVoteCasting';
import { VoteCastDialog } from '@/features/vote-cast/ui/VoteCastDialog';
import type { DecisionItem } from './types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface DecisionVoteDialogControllerProps {
  decision: DecisionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DecisionVoteDialogController({
  decision,
  open,
  onOpenChange,
}: DecisionVoteDialogControllerProps) {
  const zero = useZero();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordVerifying, setIsPasswordVerifying] = useState(false);

  const voteCasting = useVoteCasting({
    agendaItemId: decision?.agendaItemId ?? '',
    electionId: decision?.electionId,
    voteId: decision?.voteId,
    eventId: decision?.eventId,
    status: decision?.phase,
    electorId: decision?.electorId,
    voterId: decision?.voterId,
    ballotVisibility: decision?.ballotVisibility ?? null,
  });

  if (!decision) return null;

  return (
    <VoteCastDialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) setPasswordError(null);
        onOpenChange(nextOpen);
      }}
      phase={decision.phase ?? voteCasting.phase}
      title={decision.title}
      candidates={
        decision.type === 'election'
          ? decision.candidates?.map(candidate => ({
              id: candidate.id,
              name: candidate.name,
              avatar: candidate.avatarUrl,
            }))
          : undefined
      }
      maxVotes={decision.maxVotes ?? 1}
      electionMode={decision.electionMode ?? null}
      seatCount={decision.seatCount ?? null}
      choices={decision.type === 'vote' ? decision.choices : undefined}
      requirePassword
      passwordError={passwordError}
      isPasswordVerifying={isPasswordVerifying}
      onPasswordSubmit={async password => {
        setPasswordError(null);
        setIsPasswordVerifying(true);
        try {
          await serverConfirmed(
            zero.mutate(mutators.votingPassword.verifyVotingPassword({ password }))
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : translateText('generated.inline.0010_verification_failed_e10d7e51');
          setPasswordError(message);
          throw error;
        } finally {
          setIsPasswordVerifying(false);
        }
      }}
      onCastVote={voteCasting.castAmendmentVote}
      onCastElectionVote={voteCasting.castElectionVote}
      isLoading={voteCasting.isLoading}
    />
  );
}
