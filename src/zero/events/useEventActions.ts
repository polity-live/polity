import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for event mutations.
 * Every function is a thin wrapper around a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useEventActions() {
  const zero = useZero()
  const { t } = useTranslation()

  // ── CRUD ───────────────────────────────────────────────────────────
  const createEvent = useCallback(
    (args: Parameters<typeof mutators.events.create>[0]) => {
      const result = zero.mutate(mutators.events.create(args))
      toast.success(t('features.events.toasts.created'))
      onServerError(result, () => toast.error(t('features.events.toasts.createFailed')))
    },
    [zero]
  )

  const updateEvent = useCallback(
    (args: Parameters<typeof mutators.events.update>[0]) => {
      const result = zero.mutate(mutators.events.update(args))
      onServerError(result, () => toast.error(t('features.events.toasts.updateFailed')))
    },
    [zero]
  )

  const cancelEvent = useCallback(
    (args: Parameters<typeof mutators.events.cancel>[0]) => {
      const result = zero.mutate(mutators.events.cancel(args))
      toast.success(t('features.events.toasts.cancelled'))
      onServerError(result, () => toast.error(t('features.events.toasts.cancelFailed')))
    },
    [zero]
  )

  // ── Participation ──────────────────────────────────────────────────
  const joinEvent = useCallback(
    (args: Parameters<typeof mutators.events.joinEvent>[0]) => {
      const result = zero.mutate(mutators.events.joinEvent(args))
      toast.success(t('features.events.toasts.joined'))
      onServerError(result, () => toast.error(t('features.events.toasts.joinFailed')))
    },
    [zero]
  )

  const inviteParticipant = useCallback(
    (args: Parameters<typeof mutators.events.inviteParticipant>[0]) => {
      const result = zero.mutate(mutators.events.inviteParticipant(args))
      toast.success(t('features.events.toasts.participantInvited'))
      onServerError(result, () => toast.error(t('features.events.toasts.inviteFailed')))
    },
    [zero]
  )

  const leaveEvent = useCallback(
    (args: Parameters<typeof mutators.events.leaveEvent>[0]) => {
      const result = zero.mutate(mutators.events.leaveEvent(args))
      toast.success(t('features.events.toasts.left'))
      onServerError(result, () => toast.error(t('features.events.toasts.leaveFailed')))
    },
    [zero]
  )

  const updateParticipant = useCallback(
    (args: Parameters<typeof mutators.events.updateParticipant>[0]) => {
      const result = zero.mutate(mutators.events.updateParticipant(args))
      onServerError(result, () => toast.error(t('features.events.toasts.updateParticipantFailed')))
    },
    [zero]
  )

  // ── Delegates ──────────────────────────────────────────────────────
  const finalizeDelegates = useCallback(
    (args: Parameters<typeof mutators.events.finalizeDelegates>[0]) => {
      const result = zero.mutate(mutators.events.finalizeDelegates(args))
      toast.success(t('features.events.toasts.delegatesFinalized'))
      onServerError(result, () => toast.error(t('features.events.toasts.delegatesFinalizeFailed')))
    },
    [zero]
  )

  // ── Positions ──────────────────────────────────────────────────────
  const createPosition = useCallback(
    (args: Parameters<typeof mutators.events.createPosition>[0]) => {
      const result = zero.mutate(mutators.events.createPosition(args))
      toast.success(t('features.events.toasts.positionCreated'))
      onServerError(result, () => toast.error(t('features.events.toasts.positionCreateFailed')))
    },
    [zero]
  )

  const updatePosition = useCallback(
    (args: Parameters<typeof mutators.events.updatePosition>[0]) => {
      const result = zero.mutate(mutators.events.updatePosition(args))
      onServerError(result, () => toast.error(t('features.events.toasts.positionUpdateFailed')))
    },
    [zero]
  )

  const deletePosition = useCallback(
    (args: Parameters<typeof mutators.events.deletePosition>[0]) => {
      const result = zero.mutate(mutators.events.deletePosition(args))
      toast.success(t('features.events.toasts.positionDeleted'))
      onServerError(result, () => toast.error(t('features.events.toasts.positionDeleteFailed')))
    },
    [zero]
  )

  // ── Meetings ───────────────────────────────────────────────────────
  const createMeetingSlot = useCallback(
    (args: Parameters<typeof mutators.events.createMeetingSlot>[0]) => {
      const result = zero.mutate(mutators.events.createMeetingSlot(args))
      toast.success(t('features.events.toasts.meetingSlotCreated'))
      onServerError(result, () => toast.error(t('features.events.toasts.meetingSlotCreateFailed')))
    },
    [zero]
  )

  const updateMeetingSlot = useCallback(
    (args: Parameters<typeof mutators.events.updateMeetingSlot>[0]) => {
      const result = zero.mutate(mutators.events.updateMeetingSlot(args))
      onServerError(result, () => toast.error(t('features.events.toasts.meetingSlotUpdateFailed')))
    },
    [zero]
  )

  const deleteMeetingSlot = useCallback(
    (args: Parameters<typeof mutators.events.deleteMeetingSlot>[0]) => {
      const result = zero.mutate(mutators.events.deleteMeetingSlot(args))
      toast.success(t('features.events.toasts.meetingSlotDeleted'))
      onServerError(result, () => toast.error(t('features.events.toasts.meetingSlotDeleteFailed')))
    },
    [zero]
  )

  const createMeetingBooking = useCallback(
    (args: Parameters<typeof mutators.events.createMeetingBooking>[0]) => {
      const result = zero.mutate(mutators.events.createMeetingBooking(args))
      toast.success(t('features.events.toasts.meetingBooked'))
      onServerError(result, () => toast.error(t('features.events.toasts.meetingBookFailed')))
    },
    [zero]
  )

  const deleteMeetingBooking = useCallback(
    (args: Parameters<typeof mutators.events.deleteMeetingBooking>[0]) => {
      const result = zero.mutate(mutators.events.deleteMeetingBooking(args))
      toast.success(t('features.events.toasts.bookingCancelled'))
      onServerError(result, () => toast.error(t('features.events.toasts.bookingCancelFailed')))
    },
    [zero]
  )

  // ── Event Exceptions ───────────────────────────────────────────────
  const createException = useCallback(
    (args: Parameters<typeof mutators.events.createException>[0]) => {
      const result = zero.mutate(mutators.events.createException(args))
      toast.success(t('features.events.toasts.exceptionCreated'))
      onServerError(result, () => toast.error(t('features.events.toasts.exceptionCreateFailed')))
    },
    [zero],
  )

  const updateException = useCallback(
    (args: Parameters<typeof mutators.events.updateException>[0]) => {
      const result = zero.mutate(mutators.events.updateException(args))
      toast.success(t('features.events.toasts.exceptionUpdated'))
      onServerError(result, () => toast.error(t('features.events.toasts.exceptionUpdateFailed')))
    },
    [zero],
  )

  const deleteException = useCallback(
    (args: Parameters<typeof mutators.events.deleteException>[0]) => {
      const result = zero.mutate(mutators.events.deleteException(args))
      toast.success(t('features.events.toasts.exceptionDeleted'))
      onServerError(result, () => toast.error(t('features.events.toasts.exceptionDeleteFailed')))
    },
    [zero],
  )

  return {
    // CRUD
    createEvent,
    updateEvent,
    cancelEvent,

    // Participation
    joinEvent,
    inviteParticipant,
    leaveEvent,
    updateParticipant,

    // Delegates
    finalizeDelegates,

    // Positions
    createPosition,
    updatePosition,
    deletePosition,

    // Meetings
    createMeetingSlot,
    updateMeetingSlot,
    deleteMeetingSlot,
    createMeetingBooking,
    deleteMeetingBooking,

    // Exceptions
    createException,
    updateException,
    deleteException,
  }
}
