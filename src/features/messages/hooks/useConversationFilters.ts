import { useMemo, useState } from 'react';
import { Conversation, Message } from '../types/message.types';
import { getConversationDisplay } from '../logic/messageUtils';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';

export type ConversationFilter = 'all' | 'direct' | 'group' | 'event' | 'ai';

function sortConversations(left: Conversation, right: Conversation) {
  if (left.pinned && !right.pinned) return -1;
  if (!left.pinned && right.pinned) return 1;

  const leftTimestamp = left.last_message_at || 0;
  const rightTimestamp = right.last_message_at || 0;
  return rightTimestamp - leftTimestamp;
}

export function useConversationFilters(
  conversations: readonly Conversation[],
  currentUserId?: string
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>('all');

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return conversations
      .filter(conversation => {
        if (conversationFilter === 'group') {
          return conversation.type === 'group';
        }

        if (conversationFilter === 'event') {
          return conversation.type === 'event';
        }

        if (conversationFilter === 'ai') {
          return isAssistantConversation(conversation);
        }

        if (conversationFilter === 'direct') {
          return conversation.type === 'direct' && !isAssistantConversation(conversation);
        }

        return true;
      })
      .filter((conversation: Conversation) => {
        if (!normalizedQuery) {
          return true;
        }

        const display = getConversationDisplay(conversation, currentUserId);
        const displayMatch =
          display.name.toLowerCase().includes(normalizedQuery) ||
          (display.handle ?? '').toLowerCase().includes(normalizedQuery) ||
          (conversation.name ?? '').toLowerCase().includes(normalizedQuery);

        const participantMatch = conversation.participants.some(participant => {
          const name = [participant.user?.first_name, participant.user?.last_name]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          const handle = participant.user?.handle?.toLowerCase() || '';
          return name.includes(normalizedQuery) || handle.includes(normalizedQuery);
        });

        const messageMatch = conversation.messages.some((message: Message) =>
          (message.content ?? '').toLowerCase().includes(normalizedQuery)
        );

        return displayMatch || participantMatch || messageMatch;
      })
      .sort(sortConversations);
  }, [conversations, conversationFilter, currentUserId, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    conversationFilter,
    setConversationFilter,
    filteredConversations,
  };
}
