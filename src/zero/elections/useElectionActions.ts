import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError, serverConfirmed } from '../mutate-with-server-check';

/**
 * Action hook for election mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useElectionActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── Elections ──────────────────────────────────────────────────────

  const createElection = useCallback(
    (args: Parameters<typeof mutators.elections.createElection>[0]) => {
      const result = zero.mutate(mutators.elections.createElection(args));
      toast.success(t('common.agendaToasts.electionCreated'));
      onServerError(result, () => toast.error(t('common.agendaToasts.electionCreateFailed')));
      return serverConfirmed(result);
    },
    [t, zero]
  );

  const updateElection = useCallback(
    (args: Parameters<typeof mutators.elections.updateElection>[0]) => {
      const result = zero.mutate(mutators.elections.updateElection(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.electionUpdateFailed')));
      return serverConfirmed(result);
    },
    [t, zero]
  );

  const deleteElection = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.elections.deleteElection({ id }));
      toast.success(t('common.agendaToasts.electionDeleted'));
      onServerError(result, () => toast.error(t('common.agendaToasts.electionDeleteFailed')));
      return serverConfirmed(result);
    },
    [t, zero]
  );

  // ── Candidates ─────────────────────────────────────────────────────

  const addCandidate = useCallback(
    (args: Parameters<typeof mutators.elections.addCandidate>[0]) => {
      const result = zero.mutate(mutators.elections.addCandidate(args));
      toast.success(t('common.agendaToasts.candidateAdded'));
      onServerError(result, () => toast.error(t('common.agendaToasts.candidateAddFailed')));
      return serverConfirmed(result);
    },
    [t, zero]
  );

  const addCandidateOptimistic = useCallback(
    (args: Parameters<typeof mutators.elections.addCandidate>[0]) => {
      const result = zero.mutate(mutators.elections.addCandidate(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.candidateAddFailed')));
      return result;
    },
    [t, zero]
  );

  const updateCandidate = useCallback(
    (args: Parameters<typeof mutators.elections.updateCandidate>[0]) => {
      const result = zero.mutate(mutators.elections.updateCandidate(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.candidateUpdateFailed')));
      return serverConfirmed(result);
    },
    [t, zero]
  );

  const deleteCandidate = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.elections.deleteCandidate({ id }));
      toast.success(t('common.agendaToasts.candidateRemoved'));
      onServerError(result, () => toast.error(t('common.agendaToasts.candidateRemoveFailed')));
      return serverConfirmed(result);
    },
    [t, zero]
  );

  // ── Electors ───────────────────────────────────────────────────────

  const createElector = useCallback(
    (args: Parameters<typeof mutators.elections.createElector>[0]) => {
      const result = zero.mutate(mutators.elections.createElector(args));
      onServerError(result, msg => console.error('Failed to create elector:', msg));
      return serverConfirmed(result);
    },
    [zero]
  );

  const deleteElector = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.elections.deleteElector({ id }));
      onServerError(result, msg => console.error('Failed to delete elector:', msg));
      return serverConfirmed(result);
    },
    [zero]
  );

  // ── Indicative Voting ──────────────────────────────────────────────

  const castIndicativeVote = useCallback(
    async (
      participationArgs: Parameters<typeof mutators.elections.castIndicativeElectionVote>[0],
      selections: Parameters<typeof mutators.elections.createIndicativeCandidateSelection>[0][]
    ) => {
      const result = zero.mutate(
        mutators.elections.replaceIndicativeElectionVote({
          participation: participationArgs,
          selections,
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
      participationArgs: Parameters<typeof mutators.elections.castFinalElectionVote>[0],
      selections: Parameters<typeof mutators.elections.createFinalCandidateSelection>[0][]
    ) => {
      const participationResult = zero.mutate(
        mutators.elections.castFinalElectionVote(participationArgs)
      );
      onServerError(participationResult, () =>
        toast.error(t('common.agendaToasts.voteCastFailed'))
      );
      await serverConfirmed(participationResult);

      for (const selection of selections) {
        const selectionResult = zero.mutate(
          mutators.elections.createFinalCandidateSelection(selection)
        );
        onServerError(selectionResult, () => toast.error(t('common.agendaToasts.voteCastFailed')));
        await serverConfirmed(selectionResult);
      }

      toast.success(t('common.agendaToasts.voteCast'));
    },
    [t, zero]
  );

  const upsertOfflineTally = useCallback(
    (args: Parameters<typeof mutators.elections.upsertOfflineTally>[0]) => {
      const result = zero.mutate(mutators.elections.upsertOfflineTally(args));
      return serverConfirmed(result);
    },
    [zero]
  );

  return {
    // Elections
    createElection,
    updateElection,
    deleteElection,

    // Candidates
    addCandidate,
    addCandidateOptimistic,
    updateCandidate,
    deleteCandidate,

    // Electors
    createElector,
    deleteElector,

    // Voting
    castIndicativeVote,
    castFinalVote,
    upsertOfflineTally,
  };
}
