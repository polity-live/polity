import { useMemo } from 'react';
import { useMessageState } from '@/zero/messages/useMessageState';
import { isAssistantConversation } from '../logic/assistantHelpers';

/**
 * Composition hook for the Aria & Kai assistant conversation.
 *
 * - Finds an existing assistant conversation from the user's conversation list
 */
export function useAssistantConversation(userId?: string) {
  const { conversationsWithRelations, isLoading } = useMessageState({
    includeRelations: true,
  });

  // Find existing assistant conversation for this user
  const assistantConversation = useMemo(() => {
    if (!userId) return undefined;
    const userConversations = (conversationsWithRelations ?? []).filter(c =>
      c.participants?.some(p => p.user_id === userId)
    );

    return [...userConversations]
      .filter(conversation => isAssistantConversation(conversation))
      .sort((left, right) => {
        const leftTimestamp = left.last_message_at ?? left.created_at ?? 0;
        const rightTimestamp = right.last_message_at ?? right.created_at ?? 0;
        return rightTimestamp - leftTimestamp;
      })[0];
  }, [conversationsWithRelations, userId]);

  return {
    assistantConversation,
    isLoading,
  };
}
