import { useStickToBottom } from '@rocicorp/zero-virtual/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { usePolityZeroList } from '@/features/shared/virtualization';
import type { AiAttachmentEntity } from '@/lib/ai/schemas';
import { queries } from '@/zero/queries';
import { getOtherParticipant } from '../logic/messageUtils';
import type { Conversation, Message } from '../types/message.types';

interface StreamingAssistantMessage {
  text: string;
  isCompressing: boolean;
  isThinking: boolean;
  isToolCalling: boolean;
  toolName?: string | null;
  toolPreview?: string | null;
  errorMessage?: string | null;
  canRetry?: boolean;
  onRetry?: () => Promise<boolean>;
}

interface MessageStart {
  created_at: number;
  id: string;
}

export type VirtualMessageRow =
  | { type: 'message'; index: number; key: string | number; message?: Message }
  | { type: 'streaming'; key: 'streaming'; streaming: StreamingAssistantMessage }
  | { type: 'conversation-request'; key: 'conversation-request' };

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
  onAtEndChange,
  currentUserId,
  onAcceptConversation,
  onRejectConversation,
  resolveAttachmentCardData,
  streamingAssistantMessage,
}: MessageListProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialAnchorRef = useRef<{ conversationId: string; messageId: string | null }>({
    conversationId: '',
    messageId: null,
  });
  const displayMessages = messages ?? conversation.messages;

  if (initialAnchorRef.current.conversationId !== conversation.id) {
    initialAnchorRef.current = {
      conversationId: conversation.id,
      messageId: displayMessages.at(-1)?.id ?? null,
    };
  }

  const listContextParams = useMemo(() => ({ conversationId: conversation.id }), [conversation.id]);
  const virtualList = usePolityZeroList<typeof listContextParams, Message, MessageStart>({
    scrollStateKey: `messages-thread-${conversation.id}`,
    listContextParams,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: useCallback(() => 92, []),
    overscan: 10,
    getRowKey: message => message.id,
    toStartRow: message => ({ created_at: Number(message.created_at), id: message.id }),
    getPageQuery: useCallback(
      ({ limit, start, dir, settled }) => ({
        query: queries.messages.messagePage({
          conversationId: conversation.id,
          limit,
          start,
          dir,
        }) as any,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      [conversation.id]
    ),
    getSingleQuery: useCallback(
      ({ id, settled }) => ({
        query: queries.messages.messageById({ id }) as any,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      }),
      []
    ),
    permalinkID: initialAnchorRef.current.messageId ?? undefined,
  });
  useStickToBottom(virtualList);

  const otherUser = getOtherParticipant(conversation, currentUserId);
  const otherParticipantName =
    [otherUser?.first_name, otherUser?.last_name].filter(Boolean).join(' ') ||
    t('common.labels.unspecifiedUser');
  const virtualRows = useMemo<VirtualMessageRow[]>(() => {
    const rows: VirtualMessageRow[] = virtualList.items.map(item => ({
      type: 'message',
      index: item.index,
      key: item.key,
      message: item.row,
    }));

    if (streamingAssistantMessage) {
      rows.push({ type: 'streaming', key: 'streaming', streaming: streamingAssistantMessage });
    }
    if (conversation.type === 'direct' && conversation.status === 'pending') {
      rows.push({ type: 'conversation-request', key: 'conversation-request' });
    }
    return rows;
  }, [conversation, streamingAssistantMessage, virtualList.items]);

  const [isAtEnd, setIsAtEnd] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const previousLastMessageIdRef = useRef<string | null>(displayMessages.at(-1)?.id ?? null);

  const updateAtEnd = useCallback(
    (nextIsAtEnd: boolean) => {
      setIsAtEnd(nextIsAtEnd);
      onAtEndChange?.(nextIsAtEnd);
      if (nextIsAtEnd) setHasNewMessages(false);
    },
    [onAtEndChange]
  );
  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    updateAtEnd(true);
  }, [updateAtEnd]);
  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (element) updateAtEnd(isNearBottom(element));
  }, [updateAtEnd]);

  useEffect(() => {
    const latest = displayMessages.at(-1);
    const previous = previousLastMessageIdRef.current;
    previousLastMessageIdRef.current = latest?.id ?? null;
    if (!latest || latest.id === previous) return;
    if (isAtEnd || latest.sender?.id === currentUserId) scrollToBottom();
    else setHasNewMessages(true);
  }, [currentUserId, displayMessages, isAtEnd, scrollToBottom]);

  return {
    conversation,
    currentUserId,
    onAcceptConversation,
    onRejectConversation,
    resolveAttachmentCardData,
    t,
    scrollRef,
    hasNewMessages,
    otherUser,
    otherParticipantName,
    virtualRows,
    spaceBefore: virtualList.spaceBefore,
    spaceAfter: virtualList.spaceAfter,
    rowsEmpty: virtualList.rowsEmpty,
    scrollToBottom,
    handleScroll,
  };
}
