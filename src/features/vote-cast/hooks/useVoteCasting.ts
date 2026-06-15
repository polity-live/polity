/**
 * useVoteCasting Hook
 *
 * Composition hook that wraps the correct data-layer action hooks
 * and handles the 3-phase voting flow: indicative → final → closed.
 *
 * For elections: uses castIndicativeVote / castFinalVote from useElectionActions.
 * For amendment votes: uses castIndicativeVote / castFinalVote from useVoteActions.
 */

import { useCallback, useMemo } from 'react';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { usePermissions } from '@/zero/rbac';
import { useAuth } from '@/providers/auth-provider';
import { canUserVote, canUserBeCandidate, type VotingPhase } from '../logic/votePhaseHelpers';
import {
  createElectionFlowCorrelationId,
  logElectionFlowClient,
  logElectionFlowClientError,
} from '@/features/elections/logic/electionFlowLogging';
import { isNamedBallot } from '@/zero/shared';
import type { VoteSubmissionContext } from '@/features/shared/ui/voting';

interface UseVoteCastingOptions {
  agendaItemId: string;
  electionId?: string;
  voteId?: string;
  eventId?: string;
  /** Election or vote status — drives phase derivation */
  status?: string | null;
  /** User's elector record id (for elections) */
  electorId?: string;
  /** User's voter record id (for votes) */
  voterId?: string;
  /** Whether the ballot stores named participation links */
  ballotVisibility?: string | null;
}

export function useVoteCasting(options: UseVoteCastingOptions) {
  const { electionId, voteId, eventId, status, electorId, voterId, ballotVisibility } = options;
  const { user } = useAuth();
  const userId = user?.id;

  const { can } = usePermissions({ eventId });

  const electionActions = useElectionActions();
  const voteActions = useVoteActions();
  const shouldRecordParticipation = isNamedBallot(ballotVisibility);

  // Derive phase from election/vote status
  const phase: VotingPhase = useMemo(() => {
    if (status === 'final' || status === 'final_vote') return 'final_vote';
    if (status === 'closed' || status === 'completed') return 'closed';
    return 'indication';
  }, [status]);

  const isIndicationPhase = phase === 'indication';
  const isFinalVotePhase = phase === 'final_vote';
  const isClosed = phase === 'closed';

  // Permissions
  const userCanVote = canUserVote({ can }, phase);
  const userCanBeCandidate = canUserBeCandidate({ can });
  const canManageVoting = can('manage', 'agendaItems');

  // Cast an election vote (creates participation + selection(s))
  const castElectionVote = useCallback(
    async (candidateIds: string[], context?: VoteSubmissionContext) => {
      if (!userId || !userCanVote || !electionId) return;

      const correlationId = createElectionFlowCorrelationId('election-vote-cast');
      logElectionFlowClient('election-vote-cast', 'submit-started', {
        correlationId,
        electionId,
        candidateIds,
        phase,
      });

      try {
        context?.reportProgress('cast', 'active');

        let resolvedElectorId = electorId;
        if (!resolvedElectorId) {
          resolvedElectorId = crypto.randomUUID();
          await electionActions.createElector({
            id: resolvedElectorId,
            election_id: electionId,
            user_id: userId,
          });
        }

        const participationId = crypto.randomUUID();
        const participationArgs = {
          id: participationId,
          election_id: electionId,
          elector_id: resolvedElectorId,
        };

        const selections = candidateIds.map(candidateId => ({
          id: crypto.randomUUID(),
          election_id: electionId,
          candidate_id: candidateId,
          elector_participation_id: shouldRecordParticipation ? participationId : null,
        }));

        context?.reportProgress('cast', 'complete');
        context?.reportProgress('sync', 'active');

        if (isIndicationPhase) {
          await electionActions.castIndicativeVote(participationArgs, selections);
        } else {
          await electionActions.castFinalVote(participationArgs, selections);
        }

        context?.reportProgress('sync', 'complete');

        logElectionFlowClient('election-vote-cast', 'submit-confirmed', {
          correlationId,
          electionId,
          candidateIds,
          phase,
        });
      } catch (error) {
        context?.reportProgress('sync', 'error');
        logElectionFlowClientError('election-vote-cast', 'submit-failed', {
          correlationId,
          electionId,
          candidateIds,
          phase,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [
      electionActions,
      electionId,
      electorId,
      isIndicationPhase,
      phase,
      shouldRecordParticipation,
      userCanVote,
      userId,
    ]
  );

  // Cast an amendment/discussion vote (creates participation + decision)
  const castAmendmentVote = useCallback(
    async (choiceId: string, context?: VoteSubmissionContext) => {
      if (!userId || !userCanVote || !voteId) return;

      const correlationId = createElectionFlowCorrelationId('vote-cast');
      logElectionFlowClient('vote-cast', 'submit-started', {
        correlationId,
        voteId,
        choiceId,
        phase,
      });

      try {
        context?.reportProgress('cast', 'active');

        let resolvedVoterId = voterId;
        if (!resolvedVoterId) {
          resolvedVoterId = crypto.randomUUID();
          await voteActions.createVoter({
            id: resolvedVoterId,
            vote_id: voteId,
            user_id: userId,
          });
        }

        const participationId = crypto.randomUUID();
        const participationArgs = {
          id: participationId,
          vote_id: voteId,
          voter_id: resolvedVoterId,
        };

        const decisions = [
          {
            id: crypto.randomUUID(),
            vote_id: voteId,
            choice_id: choiceId,
            voter_participation_id: shouldRecordParticipation ? participationId : null,
          },
        ];

        context?.reportProgress('cast', 'complete');
        context?.reportProgress('sync', 'active');

        if (isIndicationPhase) {
          await voteActions.castIndicativeVote(participationArgs, decisions);
        } else {
          await voteActions.castFinalVote(participationArgs, decisions);
        }

        context?.reportProgress('sync', 'complete');

        logElectionFlowClient('vote-cast', 'submit-confirmed', {
          correlationId,
          voteId,
          choiceId,
          phase,
        });
      } catch (error) {
        context?.reportProgress('sync', 'error');
        logElectionFlowClientError('vote-cast', 'submit-failed', {
          correlationId,
          voteId,
          choiceId,
          phase,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [
      isIndicationPhase,
      phase,
      shouldRecordParticipation,
      userCanVote,
      userId,
      voteActions,
      voteId,
      voterId,
    ]
  );

  // Advance election/vote phase via status update
  const advanceElectionPhase = useCallback(
    async (newStatus: string) => {
      if (!canManageVoting || !electionId) return;
      await electionActions.updateElection({ id: electionId, status: newStatus });
    },
    [canManageVoting, electionId, electionActions]
  );

  const advanceVotePhase = useCallback(
    async (newStatus: string) => {
      if (!canManageVoting || !voteId) return;
      await voteActions.updateVote({ id: voteId, status: newStatus });
    },
    [canManageVoting, voteId, voteActions]
  );

  return {
    // Phase
    phase,
    isIndicationPhase,
    isFinalVotePhase,
    isClosed,

    // Permissions
    userCanVote,
    userCanBeCandidate,
    canManageVoting,

    // Loading
    isLoading: false,

    // Actions
    castAmendmentVote,
    castElectionVote,
    advanceElectionPhase,
    advanceVotePhase,
  };
}
