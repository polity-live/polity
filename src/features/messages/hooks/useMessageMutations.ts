import { useState } from 'react';
import { useMessageActions } from '@/zero/messages/useMessageActions';
import { toast } from '@/features/shared/ui/ui/sonner';
import { Conversation } from '../types/message.types';
import { hasUnreadConversationRequest } from '../logic/messageUtils';
import { ARIA_KAI_USER_ID, ARIA_KAI_WELCOME_MESSAGE } from '@/features/assistant/constants';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { trackMutationFinalization } from '@/features/notifications/utils/mutation-finalization';

export function useMessageMutations() {
  const actions = useMessageActions();
  const [isLoading, setIsLoading] = useState(false);

  interface SendMessageOptions {
    contextJson?: string;
  }

  interface SendAssistantMessageOptions {
    contextJson?: string;
  }

  /**
   * Send a message to a conversation
   */
  const sendMessage = async (
    conversationId: string,
    senderId: string,
    content: string,
    recipientUserIds?: string[],
    options?: SendMessageOptions
  ) => {
    void senderId;
    void recipientUserIds;
    setIsLoading(true);
    try {
      const messageId = crypto.randomUUID();

      await waitForClientApply(
        actions.sendMessage({
          id: messageId,
          content,
          conversation_id: conversationId,
          context_json: options?.contextJson ?? '[]',
          deleted_at: null,
        })
      );

      return { success: true, messageId };
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(translateText('generated.inline.0735_failed_to_send_message_dd854823'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const sendAssistantMessage = async (
    conversationId: string,
    content: string,
    options?: SendAssistantMessageOptions
  ) => {
    setIsLoading(true);
    try {
      const messageId = crypto.randomUUID();

      await waitForClientApply(
        actions.sendAssistantMessage({
          id: messageId,
          content,
          conversation_id: conversationId,
          context_json: options?.contextJson ?? '[]',
          deleted_at: null,
        })
      );

      return { success: true, messageId };
    } catch (error) {
      console.error('Failed to send assistant message:', error);
      toast.error(translateText('generated.inline.0736_failed_to_send_assistant_message_dfc6e0f4'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Create a new conversation
   */
  const createConversation = async (
    type: string,
    participantIds: string[],
    groupId?: string,
    creatorId?: string
  ) => {
    setIsLoading(true);
    try {
      const conversationId = crypto.randomUUID();
      const now = Date.now();

      await waitForClientApply(
        actions.createConversationFull({
          conversation: {
            id: conversationId,
            type,
            status: 'pending',
            group_id: groupId ?? null,
            name: null,
            pinned: false,
            last_message_at: 0,
            assistant_for_user_id: null,
          },
          participants: participantIds.map(participantId => ({
            id: crypto.randomUUID(),
            joined_at: now,
            conversation_id: conversationId,
            user_id: participantId,
            last_read_at: 0,
            left_at: null,
          })),
        })
      );

      void creatorId;
      return { success: true, conversationId };
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const createAssistantConversation = async (
    currentUserId: string,
    name = 'Assistent Aria & Kai'
  ) => {
    setIsLoading(true);
    try {
      const conversationId = crypto.randomUUID();
      const now = Date.now();

      await waitForClientApply(
        actions.createConversationFull({
          conversation: {
            id: conversationId,
            type: 'direct',
            status: 'accepted',
            group_id: null,
            name,
            pinned: false,
            last_message_at: now,
            assistant_for_user_id: currentUserId,
          },
          participants: [
            {
              id: crypto.randomUUID(),
              joined_at: now,
              conversation_id: conversationId,
              user_id: currentUserId,
              last_read_at: 0,
              left_at: null,
            },
            {
              id: crypto.randomUUID(),
              joined_at: now,
              conversation_id: conversationId,
              user_id: ARIA_KAI_USER_ID,
              last_read_at: now,
              left_at: null,
            },
          ],
          assistantMessage: {
            id: crypto.randomUUID(),
            content: ARIA_KAI_WELCOME_MESSAGE,
            conversation_id: conversationId,
            context_json: '[]',
            deleted_at: null,
          },
        })
      );

      return { success: true, conversationId };
    } catch (error) {
      console.error('Failed to create AI conversation:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a message
   */
  const deleteMessage = async (messageId: string) => {
    setIsLoading(true);
    try {
      await waitForClientApply(actions.deleteMessage({ id: messageId }));
      toast.success(translateText('generated.inline.0741_message_deleted_3271a770'));
      return { success: true };
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error(translateText('generated.inline.0742_failed_to_delete_message_4e4266ff'));
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const markConversationAsRead = async (conversation: Conversation, currentUserId: string) => {
    const unreadMessages = conversation.messages.filter(
      msg => !msg.is_read && msg.sender?.id !== currentUserId
    );
    const shouldUpdateReadState =
      unreadMessages.length > 0 || hasUnreadConversationRequest(conversation, currentUserId);

    if (!shouldUpdateReadState) return;

    const currentParticipant = conversation.participants.find(
      participant => participant.user_id === currentUserId || participant.user?.id === currentUserId
    );

    try {
      for (const msg of unreadMessages) {
        await waitForClientApply(
          actions.updateMessage({
            id: msg.id,
            is_read: true,
          })
        );
      }

      if (currentParticipant) {
        await waitForClientApply(
          actions.markRead({
            id: currentParticipant.id,
            last_read_at: Date.now(),
          })
        );
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const acceptConversation = async (
    conversationId: string,
    params?: {
      senderId?: string;
      senderName?: string;
      requesterUserId?: string;
    }
  ) => {
    try {
      await waitForClientApply(
        actions.updateConversation({
          id: conversationId,
          status: 'accepted',
        })
      );

      void params;
      toast.success(translateText('generated.inline.0743_conversation_accepted_575bee56'));
      return { success: true };
    } catch (error) {
      console.error('Failed to accept conversation:', error);
      toast.error(translateText('generated.inline.0744_failed_to_accept_conversation_6e87255f'));
      return { success: false, error };
    }
  };

  const rejectConversation = async (conversation: Conversation) => {
    let finalizationStarted = false;
    try {
      const mutationResult = actions.deleteConversationFull({
        id: conversation.id,
        messageIds: conversation.messages.map(message => message.id),
        participantIds: conversation.participants.map(participant => participant.id),
      });
      trackMutationFinalization({
        result: mutationResult,
        entityKind: 'conversation',
        operationId: `reject:${conversation.id}`,
        messages: {
          pending: translateText('features.messages.toasts.conversationRejecting'),
          success: translateText('features.messages.toasts.conversationRejected'),
          error: translateText('features.messages.toasts.conversationRejectFailed'),
        },
      });
      finalizationStarted = true;
      await waitForClientApply(mutationResult);
      return { success: true };
    } catch (error) {
      console.error('Failed to reject conversation:', error);
      if (!finalizationStarted) {
        toast.error(translateText('features.messages.toasts.conversationRejectFailed'));
      }
      return { success: false, error };
    }
  };

  const deleteConversation = async (conversation: Conversation) => {
    let finalizationStarted = false;
    try {
      const mutationResult = actions.deleteConversationFull({
        id: conversation.id,
        messageIds: conversation.messages.map(message => message.id),
        participantIds: conversation.participants.map(participant => participant.id),
      });
      trackMutationFinalization({
        result: mutationResult,
        entityKind: 'conversation',
        operationId: `delete:${conversation.id}`,
        messages: {
          pending: translateText('features.messages.toasts.conversationDeleting'),
          success: translateText('features.messages.toasts.conversationDeleted'),
          error: translateText('features.messages.toasts.conversationDeleteFailed'),
        },
      });
      finalizationStarted = true;
      await waitForClientApply(mutationResult);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      if (!finalizationStarted) {
        toast.error(translateText('features.messages.toasts.conversationDeleteFailed'));
      }
      return { success: false, error };
    }
  };

  const togglePin = async (conversationId: string, currentPinned: boolean) => {
    try {
      await waitForClientApply(
        actions.updateConversation({
          id: conversationId,
          pinned: !currentPinned,
        })
      );
      return { success: true };
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      toast.error(translateText('generated.inline.0749_failed_to_toggle_pin_bd700a53'));
      return { success: false, error };
    }
  };

  const updateConversationName = async (conversationId: string, name: string | null) => {
    try {
      await waitForClientApply(
        actions.updateConversation({
          id: conversationId,
          name,
        })
      );
      return { success: true };
    } catch (error) {
      console.error('Failed to update conversation name:', error);
      toast.error(translateText('generated.inline.0750_failed_to_update_conversation_4dc375ea'));
      return { success: false, error };
    }
  };

  return {
    sendMessage,
    sendAssistantMessage,
    createConversation,
    createAssistantConversation,
    deleteMessage,
    markConversationAsRead,
    acceptConversation,
    rejectConversation,
    deleteConversation,
    togglePin,
    updateConversationName,
    isLoading,
  };
}
