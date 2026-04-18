import { useCallback } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast'
import { useTranslation } from '@/features/shared/hooks/use-translation'
import { mutators } from '../mutators'
import { onServerError } from '../mutate-with-server-check'

/**
 * Action hook for message/conversation mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useMessageActions() {
  const zero = useZero()
  const { t } = useTranslation()

  // ── Conversations ──────────────────────────────────────────────────
  const createConversation = useCallback(
    (args: Parameters<typeof mutators.messages.createConversation>[0]) => {
      const result = zero.mutate(mutators.messages.createConversation(args))
      toast.success(t('features.messages.toasts.conversationCreated'))
      onServerError(result, () => toast.error(t('features.messages.toasts.conversationCreateFailed')))
    },
    [zero]
  )

  const updateConversation = useCallback(
    (args: Parameters<typeof mutators.messages.updateConversation>[0]) => {
      const result = zero.mutate(mutators.messages.updateConversation(args))
      onServerError(result, () => toast.error(t('features.messages.toasts.conversationUpdateFailed')))
    },
    [zero]
  )

  const deleteConversation = useCallback(
    (args: Parameters<typeof mutators.messages.deleteConversation>[0]) => {
      const result = zero.mutate(mutators.messages.deleteConversation(args))
      toast.success(t('features.messages.toasts.conversationDeleted'))
      onServerError(result, () => toast.error(t('features.messages.toasts.conversationDeleteFailed')))
    },
    [zero]
  )

  // ── Messages ───────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (args: Parameters<typeof mutators.messages.sendMessage>[0]) => {
      const result = zero.mutate(mutators.messages.sendMessage(args))
      onServerError(result, () => toast.error(t('features.messages.toasts.sendFailed')))
    },
    [zero]
  )

  const sendAssistantMessage = useCallback(
    (args: Parameters<typeof mutators.messages.sendAssistantMessage>[0]) => {
      const result = zero.mutate(mutators.messages.sendAssistantMessage(args))
      onServerError(result, () => toast.error(t('features.messages.toasts.sendFailed')))
    },
    [zero]
  )

  const updateMessage = useCallback(
    (args: Parameters<typeof mutators.messages.updateMessage>[0]) => {
      const result = zero.mutate(mutators.messages.updateMessage(args))
      onServerError(result, () => toast.error(t('features.messages.toasts.updateFailed')))
    },
    [zero]
  )

  const deleteMessage = useCallback(
    (args: Parameters<typeof mutators.messages.deleteMessage>[0]) => {
      const result = zero.mutate(mutators.messages.deleteMessage(args))
      toast.success(t('features.messages.toasts.messageDeleted'))
      onServerError(result, () => toast.error(t('features.messages.toasts.messageDeleteFailed')))
    },
    [zero]
  )

  // ── Participants ───────────────────────────────────────────────────
  const addParticipant = useCallback(
    (args: Parameters<typeof mutators.messages.addParticipant>[0]) => {
      const result = zero.mutate(mutators.messages.addParticipant(args))
      toast.success(t('features.messages.toasts.participantAdded'))
      onServerError(result, () => toast.error(t('features.messages.toasts.participantAddFailed')))
    },
    [zero]
  )

  const removeParticipant = useCallback(
    (args: Parameters<typeof mutators.messages.removeParticipant>[0]) => {
      const result = zero.mutate(mutators.messages.removeParticipant(args))
      toast.success(t('features.messages.toasts.participantRemoved'))
      onServerError(result, () => toast.error(t('features.messages.toasts.participantRemoveFailed')))
    },
    [zero]
  )

  // ── Read Status ────────────────────────────────────────────────────
  const markRead = useCallback(
    (args: Parameters<typeof mutators.messages.markRead>[0]) => {
      const result = zero.mutate(mutators.messages.markRead(args))
      onServerError(result, () => toast.error(t('features.messages.toasts.markReadFailed')))
    },
    [zero]
  )

  return {
    // Conversations
    createConversation,
    updateConversation,
    deleteConversation,

    // Messages
    sendMessage,
    sendAssistantMessage,
    updateMessage,
    deleteMessage,

    // Participants
    addParticipant,
    removeParticipant,

    // Read Status
    markRead,
  }
}
