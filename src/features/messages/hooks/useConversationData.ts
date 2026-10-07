import { useMessageState } from '@/zero/messages/useMessageState';

export function useConversationData(
  userId?: string,
  cursor: { after?: string; first: number } = { first: 20 }
) {
  const { conversationsWithRelations, isLoading } = useMessageState({
    includeRelations: true,
    limit: cursor.first,
  });

  const filteredConversations = userId
    ? (conversationsWithRelations || []).filter(
        c => c.type === 'project_ai' || c.participants?.some(p => p.user_id === userId)
      )
    : [];

  return {
    conversations: filteredConversations,
    isLoading,
    pageInfo: undefined,
  };
}
