import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for agenda mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useAgendaActions() {
  const zero = useZero()
  const { t } = useTranslation()

  // ── Agenda Items ───────────────────────────────────────────────────
  const createAgendaItem = useCallback(
    (args: Parameters<typeof mutators.agendas.createAgendaItem>[0]) => {
      const result = zero.mutate(mutators.agendas.createAgendaItem(args))
      toast.success(t('common.agendaToasts.itemCreated'))
      onServerError(result, () => toast.error(t('common.agendaToasts.itemCreateFailed')))
    },
    [zero]
  )

  const updateAgendaItem = useCallback(
    (args: Parameters<typeof mutators.agendas.updateAgendaItem>[0]) => {
      const result = zero.mutate(mutators.agendas.updateAgendaItem(args))
      onServerError(result, () => toast.error(t('common.agendaToasts.itemUpdateFailed')))
    },
    [zero]
  )

  const deleteAgendaItem = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.agendas.deleteAgendaItem({ id }))
      toast.success(t('common.agendaToasts.itemDeleted'))
      onServerError(result, () => toast.error(t('common.agendaToasts.itemDeleteFailed')))
    },
    [zero]
  )

  const reorderAgendaItems = useCallback(
    (args: Parameters<typeof mutators.agendas.reorderAgendaItems>[0]) => {
      const result = zero.mutate(mutators.agendas.reorderAgendaItems(args))
      onServerError(result, () => toast.error(t('common.agendaToasts.reorderFailed')))
    },
    [zero]
  )

  // ── Speaker List ───────────────────────────────────────────────────
  const addSpeaker = useCallback(
    (args: Parameters<typeof mutators.agendas.addSpeaker>[0]) => {
      const result = zero.mutate(mutators.agendas.addSpeaker(args))
      toast.success(t('common.agendaToasts.speakerAdded'))
      onServerError(result, () => toast.error(t('common.agendaToasts.speakerAddFailed')))
    },
    [zero]
  )

  const updateSpeaker = useCallback(
    (args: Parameters<typeof mutators.agendas.updateSpeaker>[0]) => {
      const result = zero.mutate(mutators.agendas.updateSpeaker(args))
      onServerError(result, () => toast.error(t('common.agendaToasts.speakerUpdateFailed')))
    },
    [zero]
  )

  const removeSpeaker = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.agendas.removeSpeaker({ id }))
      toast.success(t('common.agendaToasts.speakerRemoved'))
      onServerError(result, () => toast.error(t('common.agendaToasts.speakerRemoveFailed')))
    },
    [zero]
  )

  // ── Agenda Item Change Requests ────────────────────────────────────

  const createAgendaItemChangeRequest = useCallback(
    (args: Parameters<typeof mutators.agendas.createAgendaItemChangeRequest>[0]) => {
      const result = zero.mutate(mutators.agendas.createAgendaItemChangeRequest(args))
      onServerError(result, () => toast.error(t('common.agendaToasts.crCreateFailed')))
    },
    [zero]
  )

  const updateAgendaItemChangeRequest = useCallback(
    (args: Parameters<typeof mutators.agendas.updateAgendaItemChangeRequest>[0]) => {
      const result = zero.mutate(mutators.agendas.updateAgendaItemChangeRequest(args))
      onServerError(result, () => toast.error(t('common.agendaToasts.crUpdateFailed')))
    },
    [zero]
  )

  const reorderAgendaItemChangeRequests = useCallback(
    (args: Parameters<typeof mutators.agendas.reorderAgendaItemChangeRequests>[0]) => {
      const result = zero.mutate(mutators.agendas.reorderAgendaItemChangeRequests(args))
      onServerError(result, () => toast.error(t('common.agendaToasts.crReorderFailed')))
    },
    [zero]
  )

  const deleteAgendaItemChangeRequest = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.agendas.deleteAgendaItemChangeRequest({ id }))
      onServerError(result, () => toast.error(t('common.agendaToasts.crDeleteFailed')))
    },
    [zero]
  )

  const initializeChangeRequestVoting = useCallback(
    (args: { amendment_id: string; agenda_item_id: string; voting_context?: 'event' | 'internal'; group_id?: string }) => {
      const result = zero.mutate(mutators.agendas.initializeChangeRequestVoting(args))
      toast.success(t('common.agendaToasts.crVotingInitialized'))
      onServerError(result, () => toast.error(t('common.agendaToasts.crVotingInitFailed')))
    },
    [zero]
  )

  const processCRVoteResult = useCallback(
    (args: { agenda_item_change_request_id: string; vote_result: 'passed' | 'rejected' | 'tie' }) => {
      const result = zero.mutate(mutators.agendas.processCRVoteResult(args))
      toast.success(t('common.agendaToasts.crVoteProcessed'))
      onServerError(result, () => toast.error(t('common.agendaToasts.crVoteProcessFailed')))
    },
    [zero]
  )

  return {
    // Agenda items
    createAgendaItem,
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
    processCRVoteResult,
  }
}
