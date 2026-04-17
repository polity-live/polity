import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for amendment mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useAmendmentActions() {
  const zero = useZero()
  const { t } = useTranslation()

  // ── CRUD ───────────────────────────────────────────────────────────
  const createAmendment = useCallback(
    (args: Parameters<typeof mutators.amendments.create>[0]) => {
      const result = zero.mutate(mutators.amendments.create(args))
      toast.success(t('features.amendments.toasts.created'))
      onServerError(result, () => toast.error(t('features.amendments.toasts.createFailed')))
    },
    [zero]
  )

  const updateAmendment = useCallback(
    (args: Parameters<typeof mutators.amendments.update>[0]) => {
      const result = zero.mutate(mutators.amendments.update(args))
      onServerError(result, () => toast.error(t('features.amendments.toasts.updateFailed')))
    },
    [zero]
  )

  const deleteAmendment = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.delete({ id }))
      toast.success(t('features.amendments.toasts.deleted'))
      onServerError(result, () => toast.error(t('features.amendments.toasts.deleteFailed')))
    },
    [zero]
  )

  // ── Collaboration ──────────────────────────────────────────────────
  const requestCollaboration = useCallback(
    (args: Parameters<typeof mutators.amendments.addCollaborator>[0]) => {
      const result = zero.mutate(mutators.amendments.addCollaborator(args))
      toast.success(t('features.amendments.toasts.collaborationRequested'))
      onServerError(result, () => toast.error(t('features.amendments.toasts.collaborationRequestFailed')))
    },
    [zero]
  )

  const leaveCollaboration = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.removeCollaborator({ id }))
      toast.success(t('features.amendments.toasts.leftCollaboration'))
      onServerError(result, () => toast.error(t('features.amendments.toasts.leaveCollaborationFailed')))
    },
    [zero]
  )

  const acceptInvitation = useCallback(
    (id: string) => {
      const result = zero.mutate(
        mutators.amendments.updateCollaborator({ id, status: 'member' })
      )
      toast.success(t('features.amendments.toasts.joinedCollaboration'))
      onServerError(result, () => toast.error(t('features.amendments.toasts.joinCollaborationFailed')))
    },
    [zero]
  )

  const updateCollaborator = useCallback(
    (args: Parameters<typeof mutators.amendments.updateCollaborator>[0]) => {
      const result = zero.mutate(mutators.amendments.updateCollaborator(args))
      onServerError(result, () => toast.error(t('features.amendments.toasts.updateCollaboratorFailed')))
    },
    [zero]
  )

  // ── Workflow ────────────────────────────────────────────────────────
  const updateEditingMode = useCallback(
    (id: string, editingMode: string) => {
      const result = zero.mutate(
        mutators.amendments.update({ id, editing_mode: editingMode })
      )
      toast.success(t('features.amendments.toasts.workflowChanged', { status: editingMode }))
      onServerError(result, () => toast.error(t('features.amendments.toasts.workflowChangeFailed')))
    },
    [zero]
  )

  const submitToEvent = useCallback(
    (id: string, eventId: string) => {
      const result = zero.mutate(
        mutators.amendments.update({
          id,
          editing_mode: 'suggest_event',
          event_id: eventId,
        })
      )
      toast.success(t('features.amendments.toasts.submittedToEvent'))
      onServerError(result, () => toast.error(t('features.amendments.toasts.submitToEventFailed')))
    },
    [zero]
  )

  const finalizeAmendment = useCallback(
    (id: string, finalResult: 'passed' | 'rejected') => {
      const mutationResult = zero.mutate(
        mutators.amendments.update({
          id,
          editing_mode: finalResult,
        })
      )
      toast.success(
        finalResult === 'passed'
          ? t('features.amendments.toasts.passed')
          : t('features.amendments.toasts.rejected')
      )
      onServerError(mutationResult, () => toast.error(t('features.amendments.toasts.finalizeFailed')))
    },
    [zero]
  )

  // ── Change Requests ────────────────────────────────────────────────
  const createChangeRequest = useCallback(
    (args: Parameters<typeof mutators.amendments.createChangeRequest>[0]) => {
      const result = zero.mutate(mutators.amendments.createChangeRequest(args))
      toast.success(t('features.amendments.toasts.changeRequestCreated'))
      onServerError(result, () => toast.error(t('features.amendments.toasts.changeRequestCreateFailed')))
    },
    [zero]
  )

  const updateChangeRequest = useCallback(
    (args: Parameters<typeof mutators.amendments.updateChangeRequest>[0]) => {
      const result = zero.mutate(mutators.amendments.updateChangeRequest(args))
      onServerError(result, () => toast.error(t('features.amendments.toasts.changeRequestUpdateFailed')))
    },
    [zero]
  )

  const voteOnChangeRequest = useCallback(
    (args: Parameters<typeof mutators.amendments.voteOnChangeRequest>[0]) => {
      const result = zero.mutate(mutators.amendments.voteOnChangeRequest(args))
      onServerError(result, () => toast.error(t('features.amendments.toasts.voteOnChangeRequestFailed')))
    },
    [zero]
  )

  // ── Support ────────────────────────────────────────────────────────
  const supportAmendment = useCallback(
    (args: Parameters<typeof mutators.amendments.supportAmendment>[0]) => {
      const result = zero.mutate(mutators.amendments.supportAmendment(args))
      onServerError(result, () => toast.error(t('features.amendments.toasts.supportAddFailed')))
    },
    [zero]
  )

  const updateSupportVote = useCallback(
    (args: Parameters<typeof mutators.amendments.updateSupportVote>[0]) => {
      const result = zero.mutate(mutators.amendments.updateSupportVote(args))
      onServerError(result, () => toast.error(t('common.voteToasts.voteUpdateFailed', 'Failed to update vote')))
    },
    [zero]
  )

  const deleteSupportVote = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.amendments.deleteSupportVote({ id }))
      onServerError(result, () => toast.error(t('common.voteToasts.voteDeleteFailed', 'Failed to delete vote')))
    },
    [zero]
  )

  const createSupportConfirmation = useCallback(
    (args: Parameters<typeof mutators.amendments.createSupportConfirmation>[0]) => {
      const result = zero.mutate(mutators.amendments.createSupportConfirmation(args))
      onServerError(result, () => toast.error(t('features.amendments.toasts.supportConfirmationFailed')))
    },
    [zero]
  )

  const updateSupportConfirmation = useCallback(
    (args: Parameters<typeof mutators.amendments.updateSupportConfirmation>[0]) => {
      const result = zero.mutate(mutators.amendments.updateSupportConfirmation(args))
      const status = args.status
      toast.success(status === 'confirmed' ? t('features.amendments.toasts.supportConfirmed') : t('features.amendments.toasts.supportDeclined'))
      onServerError(result, () => toast.error(t('features.amendments.toasts.supportConfirmationUpdateFailed')))
    },
    [zero]
  )

  // ── Subscription (delegates to common mutators) ────────────────────
  const subscribe = useCallback(
    (args: { id: string; amendment_id: string }) => {
      const result = zero.mutate(
        mutators.common.subscribe({
          id: args.id,
          amendment_id: args.amendment_id,
          user_id: null,
          group_id: null,
          event_id: null,
          blog_id: null,
        })
      )
      toast.success(t('features.amendments.toasts.subscribed'))
      onServerError(result, () => toast.error(t('features.amendments.toasts.subscribeFailed')))
    },
    [zero]
  )

  const unsubscribe = useCallback(
    (id: string) => {
      const result = zero.mutate(mutators.common.unsubscribe({ id }))
      toast.success(t('features.amendments.toasts.unsubscribed'))
      onServerError(result, () => toast.error(t('features.amendments.toasts.unsubscribeFailed')))
    },
    [zero]
  )

  // ── Amendment Paths ────────────────────────────────────────────────
  const createPath = useCallback(
    (args: Parameters<typeof mutators.amendments.createPath>[0]) => {
      const result = zero.mutate(mutators.amendments.createPath(args))
      onServerError(result, () => toast.error(t('features.amendments.toasts.pathCreateFailed', 'Failed to create path')))
    },
    [zero]
  )

  const deletePath = useCallback(
    (args: Parameters<typeof mutators.amendments.deletePath>[0]) => {
      const result = zero.mutate(mutators.amendments.deletePath(args))
      onServerError(result, () => toast.error(t('features.amendments.toasts.pathDeleteFailed', 'Failed to delete path')))
    },
    [zero]
  )

  const createPathSegment = useCallback(
    (args: Parameters<typeof mutators.amendments.createPathSegment>[0]) => {
      const result = zero.mutate(mutators.amendments.createPathSegment(args))
      onServerError(result, () => toast.error(t('features.amendments.toasts.pathSegmentCreateFailed', 'Failed to create path segment')))
    },
    [zero]
  )

  const deletePathSegment = useCallback(
    (args: Parameters<typeof mutators.amendments.deletePathSegment>[0]) => {
      const result = zero.mutate(mutators.amendments.deletePathSegment(args))
      onServerError(result, () => toast.error(t('features.amendments.toasts.pathSegmentDeleteFailed', 'Failed to delete path segment')))
    },
    [zero]
  )

  return {
    // CRUD
    createAmendment,
    updateAmendment,
    deleteAmendment,

    // Collaboration
    requestCollaboration,
    leaveCollaboration,
    acceptInvitation,
    updateCollaborator,

    // Workflow
    updateEditingMode,
    submitToEvent,
    finalizeAmendment,

    // Paths
    createPath,
    deletePath,
    createPathSegment,
    deletePathSegment,

    // Change requests
    createChangeRequest,
    updateChangeRequest,
    voteOnChangeRequest,

    // Support
    supportAmendment,
    updateSupportVote,
    deleteSupportVote,
    createSupportConfirmation,
    updateSupportConfirmation,

    // Subscription
    subscribe,
    unsubscribe,
  }
}
