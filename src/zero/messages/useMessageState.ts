import { useQuery } from '@rocicorp/zero/react';
import { useMemo } from 'react';
import { queries } from '../queries';

interface MessageStateOptions {
  conversationId?: string;
  groupId?: string;
  includeRelations?: boolean;
  includeForUnread?: boolean;
  includeConversationsByUser?: boolean;
  userId?: string;
  limit?: number;
  messageLimit?: number;
}

/**
 * Reactive state hook for message/conversation data.
 * Returns query-derived state — no mutations.
 */
export function useMessageState(options: MessageStateOptions = {}) {
  const {
    conversationId,
    groupId,
    includeRelations,
    includeForUnread,
    includeConversationsByUser,
    userId,
    limit,
    messageLimit,
  } = options;

  const [messages, messagesResult] = useQuery(
    conversationId
      ? queries.messages.messagesWindow({
          conversation_id: conversationId,
          limit: messageLimit ?? 80,
        })
      : undefined
  );

  const [conversation, conversationResult] = useQuery(
    conversationId ? queries.messages.conversationById({ id: conversationId }) : undefined
  );

  const [unread, unreadResult] = useQuery(
    conversationId ? queries.messages.unreadCount({ conversation_id: conversationId }) : undefined
  );

  const [conversationsWithRelations, conversationsWithRelationsResult] = useQuery(
    includeRelations ? queries.messages.conversationsWithRelations({ limit }) : undefined
  );

  const [conversationsForUnreadRows, conversationsForUnreadResult] = useQuery(
    includeForUnread ? queries.messages.conversationsForUnread({}) : undefined
  );

  const conversationsForUnread = (conversationsForUnreadRows ?? []).flatMap(row =>
    row.conversation ? [row.conversation] : []
  );

  // ── Conversations by user with relations (opt-in) ──────────────────
  const [conversationsByUser, conversationsByUserResult] = useQuery(
    includeConversationsByUser && userId
      ? queries.messages.conversationsByUserWithRelations({ user_id: userId })
      : undefined
  );

  // ── Group conversation (opt-in by groupId) ──────────────────────────
  const [groupConversation, groupConversationResult] = useQuery(
    groupId ? queries.messages.conversationByGroupId({ group_id: groupId }) : undefined
  );

  const isLoading =
    (conversationId !== undefined &&
      (messagesResult.type === 'unknown' ||
        conversationResult.type === 'unknown' ||
        unreadResult.type === 'unknown')) ||
    (includeRelations === true && conversationsWithRelationsResult.type === 'unknown') ||
    (includeForUnread === true && conversationsForUnreadResult.type === 'unknown') ||
    (includeConversationsByUser === true &&
      userId !== undefined &&
      conversationsByUserResult.type === 'unknown') ||
    (groupId !== undefined && groupConversationResult.type === 'unknown');

  const orderedMessages = useMemo(() => [...(messages ?? [])].reverse(), [messages]);

  return {
    messages: orderedMessages,
    conversation,
    unread: unread ?? [],
    conversationsWithRelations: conversationsWithRelations ?? [],
    conversationsForUnread,
    conversationsByUser: conversationsByUser ?? [],
    groupConversation: groupConversation ?? undefined,
    isLoading,
  };
}
