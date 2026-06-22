import { useMemo, useCallback } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAgendaItemCRTimeline } from '@/zero/agendas/useAgendaState';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import {
  computeVoteResultSummary,
  type MajorityType,
  type VoteResult,
} from '@/features/vote-cast/logic/computeVoteResults';
import { isNamedBallot } from '@/zero/shared';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { VOTE_PHASE } from '@/zero/votes/vote-workflow';
import { isMockCRTimelineItem } from '../logic/createMockCRTimelineItems';
import {
  deriveChangeRequestVotePhase,
  type ChangeRequestVotePhase,
} from '../logic/changeRequestVotePhase';

export type CRVotePhase = ChangeRequestVotePhase;

function getTimelineStepKind(item: unknown) {
  return (
    (item as { _voteStepKind?: string; step_kind?: string | null } | null | undefined)
      ?._voteStepKind ??
    (item as { step_kind?: string | null } | null | undefined)?.step_kind ??
    null
  );
}

function isChangeRequestTimelineStep(item: ChangeRequestTimelineRow) {
  const stepKind = getTimelineStepKind(item);
  return !item.is_closing_vote && stepKind !== 'merge_variant';
}

function normalizeMajorityType(value?: string | null): MajorityType {
  if (value === 'absolute' || value === 'two_thirds') {
    return value;
  }

  return 'simple';
}

export function useAgendaItemCRVoting(agendaItemId: string | undefined, userId?: string) {
  const {
    crTimeline,
    currentItem,
    pendingItems,
    completedItems,
    closingVoteItem,
    progress,
    isLoading,
  } = useAgendaItemCRTimeline(agendaItemId);

  const { updateAgendaItemChangeRequest } = useAgendaActions();
  const { updateVote, castIndicativeVote, castFinalVote, createVoter } = useVoteActions();

  // Determine if the current user has voted on a given CR vote (for the current phase)
  const hasUserVoted = useCallback(
    (item: ChangeRequestTimelineRow) => {
      if (!userId || !item.vote) return false;
      const voters = item.vote.voters ?? [];
      const voter = voters.find((v: { user_id: string }) => v.user_id === userId);
      if (!voter) return false;

      const phase = getVotePhase(item);
      if (phase === 'final') {
        return (item.vote.final_participations ?? []).some(
          (p: { voter_id: string }) => p.voter_id === voter.id
        );
      }
      return (item.vote.indicative_participations ?? []).some(
        (p: { voter_id: string }) => p.voter_id === voter.id
      );
    },
    [userId]
  );

  // Get voter record for current user on a given vote
  const getUserVoter = useCallback(
    (item: ChangeRequestTimelineRow) => {
      if (!userId || !item.vote) return null;
      const voters = item.vote.voters ?? [];
      return voters.find((v: { user_id: string }) => v.user_id === userId) ?? null;
    },
    [userId]
  );

  const getUserSelectedChoiceIds = useCallback(
    (item: ChangeRequestTimelineRow) => {
      if (!userId || !item.vote) return [];

      const voter = getUserVoter(item);
      if (!voter) return [];

      const phase = getVotePhase(item);
      const participations =
        phase === 'final' || phase === 'closed'
          ? (item.vote.final_participations ?? [])
          : (item.vote.indicative_participations ?? []);

      const userParticipation = participations.find(
        (p: { voter_id?: string | null }) => p.voter_id === voter.id
      );

      if (!userParticipation) return [];

      return (userParticipation.decisions ?? [])
        .map(
          (d: { choice_id?: string | null; choice?: { id: string } | null }) =>
            d.choice?.id ?? d.choice_id ?? ''
        )
        .filter(Boolean);
    },
    [userId, getUserVoter]
  );

  // Start indicative phase for a CR vote
  const startIndicativePhase = useCallback(
    async (itemId: string) => {
      const item = crTimeline.find(i => i.id === itemId);
      if (!item?.vote) return;
      await updateVote({ id: item.vote.id, status: VOTE_PHASE.indicative });
      await updateAgendaItemChangeRequest({ id: itemId, status: 'voting' });
    },
    [crTimeline, updateVote, updateAgendaItemChangeRequest]
  );

  // Transition a CR vote to final phase
  const startFinalPhase = useCallback(
    async (itemId: string) => {
      const item = crTimeline.find(i => i.id === itemId);
      if (!item?.vote) return;
      if (item.status === 'pending') {
        await updateAgendaItemChangeRequest({ id: itemId, status: 'voting' });
      }
      await updateVote({ id: item.vote.id, status: VOTE_PHASE.final });
    },
    [crTimeline, updateAgendaItemChangeRequest, updateVote]
  );

  // Close voting on a CR. Server-side vote closing resolves the linked CR.
  const closeVoting = useCallback(
    async (itemId: string) => {
      const item = crTimeline.find(i => i.id === itemId);
      if (!item?.vote) return;

      const result = getVoteResult(item);

      await updateVote({ id: item.vote.id, status: 'closed' });

      return result;
    },
    [crTimeline, updateVote]
  );

  // Cast a vote on a CR item (handles indicative vs final based on current phase)
  const castCRVote = useCallback(
    async (item: ChangeRequestTimelineRow, choiceId: string) => {
      if (isMockCRTimelineItem(item)) {
        toast.error(
          translateText('generated.inline.0001_cannot_cast_vote_missing_user_or_vote_data_32ecb2cb')
        );
        return;
      }

      if (!userId || !item.vote) {
        toast.error(
          translateText('generated.inline.0001_cannot_cast_vote_missing_user_or_vote_data_32ecb2cb')
        );
        return;
      }

      const phase = getVotePhase(item);
      if (phase === 'closed') {
        return;
      }

      let voterId = getUserVoter(item)?.id;
      if (!voterId) {
        voterId = crypto.randomUUID();
        await createVoter({
          id: voterId,
          vote_id: item.vote.id,
          user_id: userId,
        });
      }

      const participationId = crypto.randomUUID();
      const participationArgs = {
        id: participationId,
        vote_id: item.vote.id,
        voter_id: voterId,
      };
      const decisions = [
        {
          id: crypto.randomUUID(),
          vote_id: item.vote.id,
          choice_id: choiceId,
          voter_participation_id: isNamedBallot(item.vote.ballot_visibility)
            ? participationId
            : null,
        },
      ];

      if (phase === 'final') {
        await castFinalVote(participationArgs, decisions);
      } else {
        await castIndicativeVote(participationArgs, decisions);
      }
    },
    [userId, getUserVoter, castIndicativeVote, castFinalVote, createVoter]
  );

  // Check if all CR votes (non-final) are completed
  const allCRsProcessed = useMemo(() => {
    const crItems = crTimeline.filter(isChangeRequestTimelineStep);
    return crItems.every(item => item.status === 'completed');
  }, [crTimeline]);

  // Check if timeline is complete (all items including final vote are completed)
  const isTimelineComplete = useMemo(
    () => crTimeline.length > 0 && crTimeline.every(item => item.status === 'completed'),
    [crTimeline]
  );

  return {
    crTimeline,
    currentItem,
    pendingItems,
    completedItems,
    closingVoteItem,
    progress,
    isLoading,
    hasUserVoted,
    getUserVoter,
    getUserSelectedChoiceIds,
    startIndicativePhase,
    startFinalPhase,
    closeVoting,
    castCRVote,
    allCRsProcessed,
    isTimelineComplete,
  };
}

/** Derive the current voting phase from a CR timeline item's vote status. */
export function getVotePhase(item: ChangeRequestTimelineRow): CRVotePhase {
  return deriveChangeRequestVotePhase(item);
}

/** Compute the vote result for a CR item from final decisions and configured majority rules. */
export function getVoteResult(item: ChangeRequestTimelineRow): VoteResult {
  if (!item.vote) return 'tie';

  const choices = item.vote.choices ?? [];
  const finalDecisions = item.vote.final_decisions ?? [];
  const offlineTallies = item.vote.offline_tallies ?? [];
  if (choices.length === 0) return 'tie';

  const offlineFinalCount = offlineTallies.reduce(
    (sum, tally) => (tally.phase === 'final' ? sum + (tally.count ?? 0) : sum),
    0
  );
  const totalEligible = Math.max(
    item.vote.voters?.length ?? 0,
    finalDecisions.length + offlineFinalCount
  );

  return computeVoteResultSummary(
    choices.map((choice, idx) => ({
      id: choice.id,
      label: choice.label || `Choice ${idx + 1}`,
      order_index: choice.order_index ?? idx,
    })),
    finalDecisions
      .map(decision => ({
        choice_id: decision.choice_id ?? decision.choice?.id ?? '',
      }))
      .filter(decision => Boolean(decision.choice_id)),
    totalEligible,
    normalizeMajorityType(item.vote.majority_type),
    offlineTallies
  ).result;
}
