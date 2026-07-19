import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';
import {
  trackCreationUnlessSilent,
  type CreationMutationOptions,
} from '@/features/notifications/utils/mutation-finalization';

/**
 * Action hook for agenda mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useAgendaActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── Agenda Items ───────────────────────────────────────────────────
  const createAgendaItem = useCallback(
    (
      args: Parameters<typeof mutators.agendas.createAgendaItem>[0],
      options?: CreationMutationOptions
    ) => {
      const result = zero.mutate(mutators.agendas.createAgendaItem(args));
      trackCreationUnlessSilent(result, 'agendaItem', options, args.id);
      return result;
    },
    [t, zero]
  );

  const createFullAgendaItem = useCallback(
    (
      args: Parameters<typeof mutators.agendas.createFull>[0],
      options?: CreationMutationOptions
    ) => {
      const result = zero.mutate(mutators.agendas.createFull(args));
      trackCreationUnlessSilent(result, 'agendaItem', options, args.agenda_items[0]?.id);
      return result;
    },
    [t, zero]
  );

  const updateAgendaItem = useCallback(
    (args: Parameters<typeof mutators.agendas.updateAgendaItem>[0]) => {
      const result = zero.mutate(mutators.agendas.updateAgendaItem(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.itemUpdateFailed')));
      return result;
    },
    [t, zero]
  );

  const deleteAgendaItem = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.agendas.deleteAgendaItem({ id }));
      toast.success(t('common.agendaToasts.itemDeleted'));
      onServerError(result, () => toast.error(t('common.agendaToasts.itemDeleteFailed')));
      return result;
    },
    [t, zero]
  );

  const reorderAgendaItems = useCallback(
    (args: Parameters<typeof mutators.agendas.reorderAgendaItems>[0]) => {
      const result = zero.mutate(mutators.agendas.reorderAgendaItems(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.reorderFailed')));
      return result;
    },
    [t, zero]
  );

  // ── Speaker List ───────────────────────────────────────────────────
  const addSpeaker = useCallback(
    (
      args: Parameters<typeof mutators.agendas.addSpeaker>[0],
      options?: CreationMutationOptions
    ) => {
      const result = zero.mutate(mutators.agendas.addSpeaker(args));
      trackCreationUnlessSilent(result, 'speaker', options, args.id);
      return result;
    },
    [t, zero]
  );

  const updateSpeaker = useCallback(
    (args: Parameters<typeof mutators.agendas.updateSpeaker>[0]) => {
      const result = zero.mutate(mutators.agendas.updateSpeaker(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.speakerUpdateFailed')));
      return result;
    },
    [t, zero]
  );

  const removeSpeaker = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.agendas.removeSpeaker({ id }));
      toast.success(t('common.agendaToasts.speakerRemoved'));
      onServerError(result, () => toast.error(t('common.agendaToasts.speakerRemoveFailed')));
      return result;
    },
    [t, zero]
  );

  // ── Agenda Item Change Requests ────────────────────────────────────

  const createAgendaItemChangeRequest = useCallback(
    (args: Parameters<typeof mutators.agendas.createAgendaItemChangeRequest>[0]) => {
      const result = zero.mutate(mutators.agendas.createAgendaItemChangeRequest(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.crCreateFailed')));
      return result;
    },
    [t, zero]
  );

  const updateAgendaItemChangeRequest = useCallback(
    (args: Parameters<typeof mutators.agendas.updateAgendaItemChangeRequest>[0]) => {
      const result = zero.mutate(mutators.agendas.updateAgendaItemChangeRequest(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.crUpdateFailed')));
      return result;
    },
    [t, zero]
  );

  const reorderAgendaItemChangeRequests = useCallback(
    (args: Parameters<typeof mutators.agendas.reorderAgendaItemChangeRequests>[0]) => {
      const result = zero.mutate(mutators.agendas.reorderAgendaItemChangeRequests(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.crReorderFailed')));
      return result;
    },
    [t, zero]
  );

  const deleteAgendaItemChangeRequest = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.agendas.deleteAgendaItemChangeRequest({ id }));
      onServerError(result, () => toast.error(t('common.agendaToasts.crDeleteFailed')));
      return result;
    },
    [t, zero]
  );

  const initializeChangeRequestVoting = useCallback(
    (args: {
      amendment_id: string;
      agenda_item_id: string;
      voting_context?: 'event' | 'internal';
      group_id?: string;
      start_final_vote_if_no_change_requests?: boolean;
    }) => {
      const result = zero.mutate(mutators.agendas.initializeChangeRequestVoting(args));
      toast.success(t('common.agendaToasts.crVotingInitialized'));
      onServerError(result, () => toast.error(t('common.agendaToasts.crVotingInitFailed')));
      return result;
    },
    [t, zero]
  );

  const ensureEventSuggestionChangeRequestVotes = useCallback(
    (args: { amendment_id: string; agenda_item_id: string; process_branch_id?: string | null }) => {
      const result = zero.mutate(mutators.agendas.ensureEventSuggestionChangeRequestVotes(args));
      onServerError(result, () => toast.error(t('common.agendaToasts.crVotingInitFailed')));
      return result;
    },
    [t, zero]
  );

  const processCRVoteResult = useCallback(
    (args: {
      agenda_item_change_request_id: string;
      vote_result: 'passed' | 'rejected' | 'tie';
    }) => {
      const result = zero.mutate(mutators.agendas.processCRVoteResult(args));
      toast.success(t('common.agendaToasts.crVoteProcessed'));
      onServerError(result, () => toast.error(t('common.agendaToasts.crVoteProcessFailed')));
      return result;
    },
    [t, zero]
  );

  return {
    // Agenda items
    createAgendaItem,
    createFullAgendaItem,
    updateAgendaItem,
    deleteAgendaItem,
    reorderAgendaItems,

    // Speaker list
    addSpeaker,
    updateSpeaker,
    removeSpeaker,

    // Agenda item change requests
    createAgendaItemChangeRequest,
    updateAgendaItemChangeRequest,
    reorderAgendaItemChangeRequests,
    deleteAgendaItemChangeRequest,
    initializeChangeRequestVoting,
    ensureEventSuggestionChangeRequestVotes,
    processCRVoteResult,
  };
}
