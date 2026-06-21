import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError, serverConfirmed } from '../mutate-with-server-check';

/**
 * Action hook for vote mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useVoteActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── Votes ──────────────────────────────────────────────────────────

  const createVote = useCallback(
    (args: Parameters<typeof mutators.votes.createVote>[0]) => {
      const result = zero.mutate(mutators.votes.createVote(args));
      toast.success(t('common.agendaToasts.voteCreated'));
      onServerError(result, () => toast.error(t('common.agendaToasts.voteCreateFailed')));
      return serverConfirmed(result);
    },
    [t, zero]
  );

  const updateVote = useCallback(
    (args: Parameters<typeof mutators.votes.updateVote>[0]) => {
      const result = zero.mutate(mutators.votes.updateVote(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.voteUpdateFailed')));
      return serverConfirmed(result);
    },
    [t, zero]
  );

  const deleteVote = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.votes.deleteVote({ id }));
      toast.success(t('common.agendaToasts.voteDeleted'));
      onServerError(result, () => toast.error(t('common.agendaToasts.voteDeleteFailed')));
      return serverConfirmed(result);
    },
    [t, zero]
  );

  const closeExpiredFinalVotesForEvent = useCallback(
    (args: Parameters<typeof mutators.votes.closeExpiredFinalVotesForEvent>[0]) => {
      const result = zero.mutate(mutators.votes.closeExpiredFinalVotesForEvent(args));
      onServerError(result, msg => console.error('Failed to close expired final votes:', msg));
      return serverConfirmed(result);
    },
    [zero]
  );

  // ── Vote Choices ───────────────────────────────────────────────────

  const createVoteChoice = useCallback(
    (args: Parameters<typeof mutators.votes.createVoteChoice>[0]) => {
      const result = zero.mutate(mutators.votes.createVoteChoice(args));
      onServerError(result, msg => console.error('Failed to create vote choice:', msg));
      return serverConfirmed(result);
    },
    [zero]
  );

  const updateVoteChoice = useCallback(
    (args: Parameters<typeof mutators.votes.updateVoteChoice>[0]) => {
      const result = zero.mutate(mutators.votes.updateVoteChoice(args));
      onServerError(result, msg => console.error('Failed to update vote choice:', msg));
      return serverConfirmed(result);
    },
    [zero]
  );

  const deleteVoteChoice = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.votes.deleteVoteChoice({ id }));
      onServerError(result, msg => console.error('Failed to delete vote choice:', msg));
      return serverConfirmed(result);
    },
    [zero]
  );

  // ── Voters ─────────────────────────────────────────────────────────

  const createVoter = useCallback(
    (args: Parameters<typeof mutators.votes.createVoter>[0]) => {
      const result = zero.mutate(mutators.votes.createVoter(args));
      onServerError(result, msg => console.error('Failed to create voter:', msg));
      return serverConfirmed(result);
    },
    [zero]
  );

  const deleteVoter = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.votes.deleteVoter({ id }));
      onServerError(result, msg => console.error('Failed to delete voter:', msg));
      return serverConfirmed(result);
    },
    [zero]
  );

  // ── Indicative Voting ──────────────────────────────────────────────

  const castIndicativeVote = useCallback(
    async (
      participationArgs: Parameters<typeof mutators.votes.castIndicativeVote>[0],
      decisions: Parameters<typeof mutators.votes.createIndicativeChoiceDecision>[0][]
    ) => {
      const result = zero.mutate(
        mutators.votes.replaceIndicativeVote({
          participation: participationArgs,
          decisions,
        })
      );
      onServerError(result, () => toast.error(t('common.agendaToasts.voteCastFailed')));
      await serverConfirmed(result);

      toast.success(t('common.agendaToasts.voteCast'));
    },
    [t, zero]
  );

  // ── Final Voting ───────────────────────────────────────────────────

  const castFinalVote = useCallback(
    async (
      participationArgs: Parameters<typeof mutators.votes.castFinalVote>[0],
      decisions: Parameters<typeof mutators.votes.createFinalChoiceDecision>[0][]
    ) => {
      const participationResult = zero.mutate(mutators.votes.castFinalVote(participationArgs));
      onServerError(participationResult, () =>
        toast.error(t('common.agendaToasts.voteCastFailed'))
      );
      await serverConfirmed(participationResult);

      for (const decision of decisions) {
        const decisionResult = zero.mutate(mutators.votes.createFinalChoiceDecision(decision));
        onServerError(decisionResult, () => toast.error(t('common.agendaToasts.voteCastFailed')));
        await serverConfirmed(decisionResult);
      }

      toast.success(t('common.agendaToasts.voteCast'));
    },
    [t, zero]
  );

  const upsertOfflineTally = useCallback(
    (args: Parameters<typeof mutators.votes.upsertOfflineTally>[0]) => {
      const result = zero.mutate(mutators.votes.upsertOfflineTally(args));
      onServerError(result, () =>
        toast.error(translateText('generated.inline.0049_failed_to_save_offline_tally_82b59509'))
      );
      return serverConfirmed(result);
    },
    [zero]
  );

  return {
    // Votes
    createVote,
    updateVote,
    deleteVote,
    closeExpiredFinalVotesForEvent,

    // Choices
    createVoteChoice,
    updateVoteChoice,
    deleteVoteChoice,

    // Voters
    createVoter,
    deleteVoter,

    // Voting
    castIndicativeVote,
    castFinalVote,
    upsertOfflineTally,
  };
}
