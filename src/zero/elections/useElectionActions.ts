import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError, trackServerFinalization } from '../mutate-with-server-check';
import { VOTE_CAST_SUCCESS_TOAST_ID } from '@/features/vote-cast/logic/voteCastToast';
import {
  trackCreationUnlessSilent,
  type CreationMutationOptions,
} from '@/features/notifications/utils/mutation-finalization';

/**
 * Action hook for election mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useElectionActions() {
  const zero = useZero();
  const { t } = useTranslation();

  interface CastElectionVoteOptions {
    elector?: Parameters<typeof mutators.elections.createElector>[0];
    silent?: boolean;
  }

  // ── Elections ──────────────────────────────────────────────────────

  const createElection = useCallback(
    (
      args: Parameters<typeof mutators.elections.createElection>[0],
      options?: CreationMutationOptions
    ) => {
      const result = zero.mutate(mutators.elections.createElection(args));
      trackCreationUnlessSilent(result, 'election', options, args.id);
      return result;
    },
    [t, zero]
  );

  const updateElection = useCallback(
    (args: Parameters<typeof mutators.elections.updateElection>[0]) => {
      const result =
        args.status === 'indicative' || args.status === 'final'
          ? zero.mutate(
              mutators.elections.startElection({
                election_id: args.id,
                phase: args.status,
                closing_end_time: args.closing_end_time,
              })
            )
          : zero.mutate(mutators.elections.updateElection(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.electionUpdateFailed')));
      return result;
    },
    [t, zero]
  );

  const deleteElection = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.elections.deleteElection({ id }));
      toast.success(t('common.agendaToasts.electionDeleted'));
      onServerError(result, () => toast.error(t('common.agendaToasts.electionDeleteFailed')));
      return result;
    },
    [t, zero]
  );

  // ── Candidates ─────────────────────────────────────────────────────

  const addCandidate = useCallback(
    (
      args: Parameters<typeof mutators.elections.addCandidate>[0],
      options?: CreationMutationOptions
    ) => {
      const result = zero.mutate(mutators.elections.addCandidate(args));
      trackCreationUnlessSilent(result, 'candidate', options, args.id);
      return result;
    },
    [t, zero]
  );

  const addCandidateOptimistic = useCallback(
    (
      args: Parameters<typeof mutators.elections.addCandidate>[0],
      options?: CreationMutationOptions
    ) => {
      const result = zero.mutate(mutators.elections.addCandidate(args));
      trackCreationUnlessSilent(result, 'candidate', options, args.id);
      return result;
    },
    [t, zero]
  );

  const updateCandidate = useCallback(
    (args: Parameters<typeof mutators.elections.updateCandidate>[0]) => {
      const result = zero.mutate(mutators.elections.updateCandidate(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.candidateUpdateFailed')));
      return result;
    },
    [t, zero]
  );

  const deleteCandidate = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.elections.deleteCandidate({ id }));
      toast.success(t('common.agendaToasts.candidateRemoved'));
      onServerError(result, () => toast.error(t('common.agendaToasts.candidateRemoveFailed')));
      return result;
    },
    [t, zero]
  );

  // ── Electors ───────────────────────────────────────────────────────

  const createElector = useCallback(
    (args: Parameters<typeof mutators.elections.createElector>[0]) => {
      const result = zero.mutate(mutators.elections.createElector(args));
      onServerError(result, msg => console.error('Failed to create elector:', msg));
      return result;
    },
    [zero]
  );

  const deleteElector = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.elections.deleteElector({ id }));
      onServerError(result, msg => console.error('Failed to delete elector:', msg));
      return result;
    },
    [zero]
  );

  // ── Indicative Voting ──────────────────────────────────────────────

  const castIndicativeVote = useCallback(
    (
      participationArgs: Parameters<typeof mutators.elections.castIndicativeElectionVote>[0],
      selections: Parameters<typeof mutators.elections.createIndicativeCandidateSelection>[0][],
      options?: CastElectionVoteOptions
    ) => {
      const result = zero.mutate(
        mutators.elections.submitElectionVote({
          election_id: participationArgs.election_id,
          phase: 'indicative',
          candidate_ids: selections.map(selection => selection.candidate_id),
          idempotency_id: participationArgs.id,
        })
      );
      if (!options?.silent) {
        trackServerFinalization(result, {
          onSuccess: () =>
            toast.success(t('common.agendaToasts.voteCast'), {
              id: VOTE_CAST_SUCCESS_TOAST_ID,
            }),
          onError: () => toast.error(t('common.agendaToasts.voteCastFailed')),
        });
      }
      return result;
    },
    [t, zero]
  );

  // ── Final Voting ───────────────────────────────────────────────────

  const castFinalVote = useCallback(
    (
      participationArgs: Parameters<typeof mutators.elections.castFinalElectionVote>[0],
      selections: Parameters<typeof mutators.elections.createFinalCandidateSelection>[0][],
      options?: CastElectionVoteOptions
    ) => {
      const result = zero.mutate(
        mutators.elections.submitElectionVote({
          election_id: participationArgs.election_id,
          phase: 'final',
          candidate_ids: selections.map(selection => selection.candidate_id),
          idempotency_id: participationArgs.id,
        })
      );
      if (!options?.silent) {
        trackServerFinalization(result, {
          onSuccess: () =>
            toast.success(t('common.agendaToasts.voteCast'), {
              id: VOTE_CAST_SUCCESS_TOAST_ID,
            }),
          onError: () => toast.error(t('common.agendaToasts.voteCastFailed')),
        });
      }
      return result;
    },
    [t, zero]
  );

  const upsertOfflineTally = useCallback(
    (args: Parameters<typeof mutators.elections.upsertOfflineTally>[0]) => {
      const result = zero.mutate(mutators.elections.upsertOfflineTally(args));
      onServerError(result, msg => console.error('Failed to save election offline tally:', msg));
      return result;
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
