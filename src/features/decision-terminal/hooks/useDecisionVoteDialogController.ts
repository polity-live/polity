'use client';

import { useState } from 'react';

import { useZero } from '@rocicorp/zero/react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useVoteCasting } from '@/features/vote-cast/hooks/useVoteCasting';
import type { VoteCastDialog } from '@/features/vote-cast/ui/VoteCastDialog';
import { useAuth } from '@/providers/auth-provider';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import { mutators } from '@/zero/mutators';

import type { DecisionItem } from '../ui/types';

interface UseDecisionVoteDialogControllerProps {
  decision: DecisionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type VoteCastDialogProps = React.ComponentProps<typeof VoteCastDialog>;

export function useDecisionVoteDialogController({
  decision,
  open,
  onOpenChange,
}: UseDecisionVoteDialogControllerProps) {
  const zero = useZero();
  const { user } = useAuth();
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

  if (!decision) {
    return { dialogProps: null };
  }

  const dialogProps: VoteCastDialogProps = {
    open,
    onOpenChange: nextOpen => {
      if (!nextOpen) setPasswordError(null);
      onOpenChange(nextOpen);
    },
    phase: decision.phase ?? voteCasting.phase,
    title: decision.title,
    candidates:
      decision.type === 'election'
        ? decision.candidates?.map(candidate => ({
            id: candidate.id,
            name: candidate.name,
            avatar: candidate.avatarUrl,
          }))
        : undefined,
    maxVotes: decision.maxVotes ?? 1,
    electionMode: decision.electionMode ?? null,
    seatCount: decision.seatCount ?? null,
    choices: decision.type === 'vote' ? decision.choices : undefined,
    requirePassword: true,
    passwordError,
    noVotingPasswordSettingsHref: user?.id ? `/user/${user.id}/settings?tab=passwords` : undefined,
    isPasswordVerifying,
    onPasswordSubmit: async password => {
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
    },
    onCastVote: voteCasting.castAmendmentVote,
    onCastElectionVote: voteCasting.castElectionVote,
    isLoading: voteCasting.isLoading,
  };

  return { dialogProps };
}
