import { useState, useEffect, useMemo, useRef } from 'react';
import { Conversation } from '../types/message.types';
import { ARIA_KAI_USER_ID } from '@/features/assistant/constants';

interface ConversationSelectionOptions {
  openAriaKai?: boolean;
}

export function useConversationSelection(
  conversations: Conversation[],
  options?: ConversationSelectionOptions
) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const openAriaKai = options?.openAriaKai === true;
  const hasHandledAriaKaiIntentRef = useRef(false);

  // Auto-open the assistant conversation once when explicitly requested.
  useEffect(() => {
    if (!openAriaKai || conversations.length === 0 || hasHandledAriaKaiIntentRef.current) {
      return;
    }

    const ariaKaiConversation = conversations.find(conv =>
      conv.participants.some(p => p.user?.id === ARIA_KAI_USER_ID)
    );

    if (ariaKaiConversation) {
      hasHandledAriaKaiIntentRef.current = true;
      setSelectedConversationId(ariaKaiConversation.id);

      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [conversations, openAriaKai]);

  // Get selected conversation with sorted messages
  const selectedConversation = useMemo(() => {
    const conversation = conversations.find(conv => conv.id === selectedConversationId);
    if (!conversation) return undefined;

    // Sort messages by created_at timestamp (oldest to newest, like WhatsApp)
    const sortedMessages = [...conversation.messages].sort((a, b) => {
      return a.created_at - b.created_at;
    });

    return {
      ...conversation,
      messages: sortedMessages,
    };
  }, [conversations, selectedConversationId]);

  return {
    selectedConversationId,
    setSelectedConversationId,
    selectedConversation,
  };
}
