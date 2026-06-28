import { useCallback } from 'react';
import { useZero } from '@rocicorp/zero/react';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { mutators } from '../mutators';
import { onServerError } from '../mutate-with-server-check';

/**
 * Action hook for message/conversation mutations.
 * Every function wraps a custom mutator + sonner toast.
 * Mutations are optimistic — toasts show instantly, server errors appear in the background.
 */
export function useMessageActions() {
  const zero = useZero();
  const { t } = useTranslation();

  // ── Conversations ──────────────────────────────────────────────────
  const createConversation = useCallback(
    (args: Parameters<typeof mutators.messages.createConversation>[0]) => {
      const result = zero.mutate(mutators.messages.createConversation(args));
      toast.success(t('features.messages.toasts.conversationCreated'));
      onServerError(result, () =>
        toast.error(t('features.messages.toasts.conversationCreateFailed'))
      );
      return result;
    },
    [zero, t]
  );

  const createConversationFull = useCallback(
    (args: Parameters<typeof mutators.messages.createConversationFull>[0]) => {
      const result = zero.mutate(mutators.messages.createConversationFull(args));
      toast.success(t('features.messages.toasts.conversationCreated'));
      onServerError(result, () =>
        toast.error(t('features.messages.toasts.conversationCreateFailed'))
      );
      return result;
    },
    [zero, t]
  );

  const updateConversation = useCallback(
    (args: Parameters<typeof mutators.messages.updateConversation>[0]) => {
      const result = zero.mutate(mutators.messages.updateConversation(args));
      onServerError(result, () =>
        toast.error(t('features.messages.toasts.conversationUpdateFailed'))
      );
      return result;
    },
    [zero, t]
  );

  const deleteConversation = useCallback(
    (args: Parameters<typeof mutators.messages.deleteConversation>[0]) => {
      const result = zero.mutate(mutators.messages.deleteConversation(args));
      toast.success(t('features.messages.toasts.conversationDeleted'));
      onServerError(result, () =>
        toast.error(t('features.messages.toasts.conversationDeleteFailed'))
      );
      return result;
    },
    [zero, t]
  );

  const deleteConversationFull = useCallback(
    (args: Parameters<typeof mutators.messages.deleteConversationFull>[0]) => {
      const result = zero.mutate(mutators.messages.deleteConversationFull(args));
      toast.success(t('features.messages.toasts.conversationDeleted'));
      onServerError(result, () =>
        toast.error(t('features.messages.toasts.conversationDeleteFailed'))
      );
      return result;
    },
    [zero, t]
  );

  // ── Messages ───────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (args: Parameters<typeof mutators.messages.sendMessage>[0]) => {
      const result = zero.mutate(mutators.messages.sendMessage(args));
      onServerError(result, () => toast.error(t('features.messages.toasts.sendFailed')));
      return result;
    },
    [zero, t]
  );

  const sendAssistantMessage = useCallback(
    (args: Parameters<typeof mutators.messages.sendAssistantMessage>[0]) => {
      const result = zero.mutate(mutators.messages.sendAssistantMessage(args));
      onServerError(result, () => toast.error(t('features.messages.toasts.sendFailed')));
      return result;
    },
    [zero, t]
  );

  const updateMessage = useCallback(
    (args: Parameters<typeof mutators.messages.updateMessage>[0]) => {
      const result = zero.mutate(mutators.messages.updateMessage(args));
      onServerError(result, () => toast.error(t('features.messages.toasts.updateFailed')));
      return result;
    },
    [zero, t]
  );

  const deleteMessage = useCallback(
    (args: Parameters<typeof mutators.messages.deleteMessage>[0]) => {
      const result = zero.mutate(mutators.messages.deleteMessage(args));
      toast.success(t('features.messages.toasts.messageDeleted'));
      onServerError(result, () => toast.error(t('features.messages.toasts.messageDeleteFailed')));
      return result;
    },
    [zero, t]
  );

  // ── Participants ───────────────────────────────────────────────────
  const addParticipant = useCallback(
    (args: Parameters<typeof mutators.messages.addParticipant>[0]) => {
      const result = zero.mutate(mutators.messages.addParticipant(args));
      toast.success(t('features.messages.toasts.participantAdded'));
      onServerError(result, () => toast.error(t('features.messages.toasts.participantAddFailed')));
      return result;
    },
    [zero, t]
  );

  const removeParticipant = useCallback(
    (args: Parameters<typeof mutators.messages.removeParticipant>[0]) => {
      const result = zero.mutate(mutators.messages.removeParticipant(args));
      toast.success(t('features.messages.toasts.participantRemoved'));
      onServerError(result, () =>
        toast.error(t('features.messages.toasts.participantRemoveFailed'))
      );
      return result;
    },
    [zero, t]
  );

  // ── Read Status ────────────────────────────────────────────────────
  const markRead = useCallback(
    (args: Parameters<typeof mutators.messages.markRead>[0]) => {
      const result = zero.mutate(mutators.messages.markRead(args));
      onServerError(result, () => toast.error(t('features.messages.toasts.markReadFailed')));
      return result;
    },
    [zero, t]
  );

  return {
    // Conversations
    createConversation,
    createConversationFull,
    updateConversation,
    deleteConversation,
    deleteConversationFull,

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
  };
}
