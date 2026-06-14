import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Conversation, Message } from '../types/message.types';
import { getOtherParticipant } from '../logic/messageUtils';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { AiAttachmentEntity } from '@/lib/ai/schemas';
interface StreamingAssistantMessage {
  text: string;
  isCompressing: boolean;
  isThinking: boolean;
  isToolCalling: boolean;
  toolName?: string | null;
  toolPreview?: string | null;
  errorMessage?: string | null;
}
type VirtualMessageRow =
  | { type: 'message'; message: Message }
  | { type: 'assistant-actions' }
  | { type: 'streaming'; streaming: StreamingAssistantMessage }
  | { type: 'conversation-request' };
interface MessageListProps {
  conversation: Conversation;
  messages?: Message[];
  hasMoreOlderMessages?: boolean;
  onLoadOlderMessages?: () => void;
  onAtEndChange?: (isAtEnd: boolean) => void;
  currentUserId?: string;
  onAcceptConversation: (conversation: Conversation) => void;
  onRejectConversation: (conversation: Conversation) => void;
  resolveAttachmentCardData?: (entityType: AiAttachmentEntity, entityId: string) => string | null;
  streamingAssistantMessage?: StreamingAssistantMessage;
}
function isNearBottom(element: HTMLElement, threshold = 96) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export function useMessageListController({
  conversation,
  messages,
  hasMoreOlderMessages = false,
  onLoadOlderMessages,
  onAtEndChange,
  currentUserId,
  onAcceptConversation,
  onRejectConversation,
  resolveAttachmentCardData,
  streamingAssistantMessage,
}: MessageListProps) {
  const { t } = useTranslation();

  const scrollRef = useRef<HTMLDivElement>(null);

  const pendingPrependRef = useRef<{ height: number; top: number; count: number } | null>(null);

  const rafRef = useRef<number | null>(null);

  const previousConversationIdRef = useRef<string | null>(null);

  const previousLastMessageIdRef = useRef<string | null>(null);

  const [isAtEnd, setIsAtEnd] = useState(true);

  const [hasNewMessages, setHasNewMessages] = useState(false);

  const displayMessages = messages ?? conversation.messages;

  const otherUser = getOtherParticipant(conversation, currentUserId);

  const otherParticipantName =
    [otherUser?.first_name, otherUser?.last_name].filter(Boolean).join(' ') ||
    t('common.labels.unspecifiedUser');

  const hasUserRepliedToAssistant = displayMessages.some(
    message => message.sender?.id === currentUserId
  );

  const virtualRows = useMemo<VirtualMessageRow[]>(() => {
    const rows: VirtualMessageRow[] = displayMessages.map(message => ({
      type: 'message',
      message,
    }));

    if (isAssistantConversation(conversation) && currentUserId && !hasUserRepliedToAssistant) {
      rows.push({ type: 'assistant-actions' });
    }

    if (streamingAssistantMessage) {
      rows.push({ type: 'streaming', streaming: streamingAssistantMessage });
    }

    if (conversation.type === 'direct' && conversation.status === 'pending') {
      rows.push({ type: 'conversation-request' });
    }

    return rows;
  }, [
    conversation,
    currentUserId,
    displayMessages,
    hasUserRepliedToAssistant,
    streamingAssistantMessage,
  ]);

  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 92,
    overscan: 10,
    getItemKey: index => {
      const row = virtualRows[index];
      if (!row) return index;
      if (row.type === 'message') return row.message.id;
      return row.type;
    },
  });

  const virtualItems = virtualizer.getVirtualItems();

  const updateAtEnd = useCallback(
    (nextIsAtEnd: boolean) => {
      setIsAtEnd(nextIsAtEnd);
      onAtEndChange?.(nextIsAtEnd);
      if (nextIsAtEnd) {
        setHasNewMessages(false);
      }
    },
    [onAtEndChange]
  );

  const scrollToBottom = useCallback(() => {
    if (virtualRows.length === 0) return;
    virtualizer.scrollToIndex(virtualRows.length - 1, { align: 'end' });
    updateAtEnd(true);
  }, [updateAtEnd, virtualRows.length, virtualizer]);

  const scheduleScrollToBottom = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      scrollToBottom();
    });
  }, [scrollToBottom]);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    []
  );

  useLayoutEffect(() => {
    const element = scrollRef.current;
    const pending = pendingPrependRef.current;
    if (!element || !pending || displayMessages.length <= pending.count) return;

    window.requestAnimationFrame(() => {
      element.scrollTop = pending.top + (element.scrollHeight - pending.height);
      pendingPrependRef.current = null;
    });
  }, [displayMessages.length]);

  useLayoutEffect(() => {
    if (previousConversationIdRef.current === conversation.id) return;

    previousConversationIdRef.current = conversation.id;
    previousLastMessageIdRef.current = displayMessages.at(-1)?.id ?? null;
    window.requestAnimationFrame(scrollToBottom);
  }, [conversation.id, displayMessages, scrollToBottom]);

  useEffect(() => {
    const lastMessage = displayMessages.at(-1);
    const lastMessageId = lastMessage?.id ?? null;
    const previousLastMessageId = previousLastMessageIdRef.current;
    previousLastMessageIdRef.current = lastMessageId;

    if (!lastMessageId || previousLastMessageId === lastMessageId) return;

    const sentByCurrentUser = lastMessage?.sender?.id === currentUserId;
    if (isAtEnd || sentByCurrentUser) {
      scheduleScrollToBottom();
    } else {
      setHasNewMessages(true);
    }
  }, [currentUserId, displayMessages, isAtEnd, scheduleScrollToBottom]);

  useEffect(() => {
    if (!streamingAssistantMessage) return;
    if (isAtEnd) {
      scheduleScrollToBottom();
    }
  }, [
    isAtEnd,
    scheduleScrollToBottom,
    streamingAssistantMessage?.errorMessage,
    streamingAssistantMessage?.isCompressing,
    streamingAssistantMessage?.isThinking,
    streamingAssistantMessage?.isToolCalling,
    streamingAssistantMessage?.text,
    streamingAssistantMessage?.toolName,
  ]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const nextIsAtEnd = isNearBottom(element);
    updateAtEnd(nextIsAtEnd);

    if (
      element.scrollTop < 180 &&
      hasMoreOlderMessages &&
      onLoadOlderMessages &&
      !pendingPrependRef.current
    ) {
      pendingPrependRef.current = {
        height: element.scrollHeight,
        top: element.scrollTop,
        count: displayMessages.length,
      };
      onLoadOlderMessages();
    }
  }, [displayMessages.length, hasMoreOlderMessages, onLoadOlderMessages, updateAtEnd]);

  return {
    conversation,
    messages,
    hasMoreOlderMessages,
    onLoadOlderMessages,
    onAtEndChange,
    currentUserId,
    onAcceptConversation,
    onRejectConversation,
    resolveAttachmentCardData,
    streamingAssistantMessage,
    t,
    scrollRef,
    pendingPrependRef,
    rafRef,
    previousConversationIdRef,
    previousLastMessageIdRef,
    isAtEnd,
    setIsAtEnd,
    hasNewMessages,
    setHasNewMessages,
    displayMessages,
    otherUser,
    otherParticipantName,
    hasUserRepliedToAssistant,
    virtualRows,
    virtualizer,
    virtualItems,
    updateAtEnd,
    scrollToBottom,
    scheduleScrollToBottom,
    handleScroll,
  };
}
