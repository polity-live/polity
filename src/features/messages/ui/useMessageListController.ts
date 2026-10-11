import { useStickToBottom } from '@rocicorp/zero-virtual/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { usePolityZeroList } from '@/features/shared/virtualization';
import type { AiAttachmentEntity } from '@/lib/ai/schemas';
import { queries } from '@/zero/queries';
import { observeRouteReadiness } from '@/zero/observed-query';
import { getOtherParticipant } from '../logic/messageUtils';
import type { Conversation, Message } from '../types/message.types';
import type { MessageTimelineItem } from './MessageList';

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

const MESSAGE_PAGE_SIZE = 50;

export type VirtualMessageRow =
  | {
      type: 'message';
      index: number;
      key: string | number;
      message?: Message;
      timelineBefore?: MessageTimelineItem[];
      timelineAfter?: MessageTimelineItem[];
    }
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
  timelineItems?: MessageTimelineItem[];
  active?: boolean;
}

function isNearBottom(element: HTMLElement, threshold = 96) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

export function useMessageListController({
  conversation,
  messages,
  hasMoreOlderMessages,
  onAtEndChange,
  currentUserId,
  onAcceptConversation,
  onRejectConversation,
  resolveAttachmentCardData,
  streamingAssistantMessage,
  timelineItems = [],
  active = true,
}: MessageListProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialAnchorRef = useRef<{ conversationId: string; messageId: string | null }>({
    conversationId: '',
    messageId: null,
  });
  const displayMessages = messages ?? conversation.messages;

  if (initialAnchorRef.current.conversationId !== conversation.id) {
    // A complete short thread fits in one page. Starting around its last row
    // would create two cursor views and a single-row lookup before displaying
    // the same messages. Longer or incomplete threads still need that anchor.
    const fitsFirstPage =
      messages !== undefined &&
      hasMoreOlderMessages === false &&
      messages.length < MESSAGE_PAGE_SIZE;
    initialAnchorRef.current = {
      conversationId: conversation.id,
      messageId: fitsFirstPage ? null : (displayMessages.at(-1)?.id ?? null),
    };
  }

  const listContextParams = useMemo(() => ({ conversationId: conversation.id }), [conversation.id]);
  const virtualList = usePolityZeroList<typeof listContextParams, Message, MessageStart>({
    scrollStateKey: `messages-thread-${conversation.id}`,
    listContextParams,
    // A minimized dock keeps the conversation mounted, but has no viewport.
    // Detach its virtualizer so zero-height geometry cannot drive pagination.
    getScrollElement: useCallback(() => (active ? scrollRef.current : null), [active]),
    estimateSize: useCallback(() => 92, []),
    overscan: 10,
    minPageSize: MESSAGE_PAGE_SIZE,
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
  useStickToBottom(virtualList, { enabled: active });
  useEffect(() => {
    // The public virtualizer snapshot describes the real rendered message page.
    // A preload of messagesWindow does not establish this page's readiness.
    if (active)
      observeRouteReadiness('messages.messagePage', virtualList.complete, {
        args: { conversationId: conversation.id },
        ids: virtualList.items.flatMap(item => (item.row ? [item.row.id] : [])),
      });
  }, [active, conversation.id, virtualList.complete, virtualList.items]);

  const otherUser =
    conversation.type === 'project_ai'
      ? {
          id: 'a12a0000-0000-4000-a000-000000000001',
          first_name: 'Aria & Kai',
          last_name: null,
          avatar: '/avatars/aria-kai-avatar-256.webp',
          handle: 'aria-kai',
        }
      : getOtherParticipant(conversation, currentUserId);
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

    const messageRows = rows.filter(
      (row): row is Extract<VirtualMessageRow, { type: 'message' }> => row.type === 'message'
    );
    const resolvedRows = messageRows.filter(
      (row): row is Extract<VirtualMessageRow, { type: 'message' }> & { message: Message } =>
        Boolean(row.message)
    );
    for (const item of [...timelineItems].sort((a, b) => a.createdAt - b.createdAt)) {
      const preceding = [...resolvedRows]
        .reverse()
        .find(row => Number(row.message.created_at) <= item.createdAt);
      if (preceding) {
        preceding.timelineAfter = [...(preceding.timelineAfter ?? []), item];
      } else if (resolvedRows[0]) {
        resolvedRows[0].timelineBefore = [...(resolvedRows[0].timelineBefore ?? []), item];
      }
    }

    if (streamingAssistantMessage) {
      rows.push({ type: 'streaming', key: 'streaming', streaming: streamingAssistantMessage });
    }
    if (conversation.type === 'direct' && conversation.status === 'pending') {
      rows.push({ type: 'conversation-request', key: 'conversation-request' });
    }
    return rows;
  }, [conversation, streamingAssistantMessage, timelineItems, virtualList.items]);

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
    rowsEmpty: virtualList.rowsEmpty && timelineItems.length === 0,
    scrollToBottom,
    handleScroll,
  };
}
