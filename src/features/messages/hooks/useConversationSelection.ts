import { useState, useEffect, useMemo, useRef } from 'react';
import { Conversation } from '../types/message.types';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';

interface ConversationSelectionOptions {
  openAriaKai?: boolean;
  restoreOnNavigation?: boolean;
  persistSelection?: boolean;
  viewerID?: string;
  initialConversationID?: string;
}

export function useConversationSelection(
  conversations: Conversation[],
  options?: ConversationSelectionOptions
) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(() => {
    // The directory is already permission-filtered. Resolve a locally present
    // deep link on the first render instead of mounting the empty thread first.
    if (
      options?.initialConversationID &&
      conversations.some(conversation => conversation.id === options.initialConversationID)
    )
      return options.initialConversationID;
    if (!options?.restoreOnNavigation || !options.viewerID || typeof window === 'undefined')
      return null;
    const previous = window.history.state?.polityMessageSelection;
    return previous?.viewerID === options.viewerID && typeof previous.conversationID === 'string'
      ? previous.conversationID
      : null;
  });
  const openAriaKai = options?.openAriaKai === true;
  const hasHandledAriaKaiIntentRef = useRef(false);

  useEffect(() => {
    if (!options?.restoreOnNavigation || !options.viewerID) return;
    // A caller consuming this exact URL target persists it with that navigation.
    // Other selection changes still need their own history update.
    if (
      options.persistSelection === false &&
      selectedConversationId === options.initialConversationID
    )
      return;
    const previous = window.history.state?.polityMessageSelection;
    // TanStack observes native replaceState calls as navigation. A restored
    // selection is already persisted; avoid a redundant router notification.
    if (
      previous?.viewerID === options.viewerID &&
      previous.conversationID === selectedConversationId
    )
      return;
    window.history.replaceState(
      {
        ...window.history.state,
        polityMessageSelection: {
          viewerID: options.viewerID,
          conversationID: selectedConversationId,
        },
      },
      '',
      window.location.href
    );
  }, [
    options?.restoreOnNavigation,
    options?.viewerID,
    options?.persistSelection,
    options?.initialConversationID,
    selectedConversationId,
  ]);

  // Auto-open the assistant conversation once when explicitly requested.
  useEffect(() => {
    if (!openAriaKai || conversations.length === 0 || hasHandledAriaKaiIntentRef.current) {
      return;
    }

    const ariaKaiConversation = [...conversations]
      .filter(conversation => isAssistantConversation(conversation))
      .sort((left, right) => {
        const leftTimestamp = left.last_message_at ?? left.created_at ?? 0;
        const rightTimestamp = right.last_message_at ?? right.created_at ?? 0;
        return rightTimestamp - leftTimestamp;
      })[0];

    if (ariaKaiConversation) {
      hasHandledAriaKaiIntentRef.current = true;
      setSelectedConversationId(ariaKaiConversation.id);

      // This runs in a useEffect of a client hook; React never executes effects during SSR.
      window.history.replaceState(
        {
          ...window.history.state,
          ...(options?.restoreOnNavigation && options.viewerID
            ? {
                polityMessageSelection: {
                  viewerID: options.viewerID,
                  conversationID: ariaKaiConversation.id,
                },
              }
            : {}),
        },
        '',
        window.location.pathname
      );
    }
  }, [conversations, openAriaKai, options?.restoreOnNavigation, options?.viewerID]);

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
