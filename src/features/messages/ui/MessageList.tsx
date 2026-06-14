import { featureThemeClassName } from '@/features/shared/theme';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { AlertCircle, Archive, Check, LoaderCircle, Wrench, X } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { Conversation, Message } from '../types/message.types';
import { getOtherParticipant } from '../logic/messageUtils';
import { AriaKaiMessageActions } from '@/features/assistant/ui/AriaKaiMessageActions.tsx';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { MessageContent } from '@/features/messages/ui/MessageContent.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
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

function StreamingBubble({
  streamingAssistantMessage,
  otherUser,
}: {
  streamingAssistantMessage: StreamingAssistantMessage;
  otherUser: ReturnType<typeof getOtherParticipant>;
}) {
  const { t } = useTranslation();
  if (!otherUser) return null;

  return (
    <div className="flex items-end gap-2">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={otherUser.avatar ?? undefined} />
        <AvatarFallback>{otherUser.first_name?.[0]?.toUpperCase() || 'A'}</AvatarFallback>
      </Avatar>
      <div className="max-w-[70%] space-y-2">
        <div className="bg-muted rounded-lg px-4 py-2">
          {streamingAssistantMessage.text ? (
            <div className="space-y-3">
              <MessageContent content={streamingAssistantMessage.text} />
              {streamingAssistantMessage.errorMessage && (
                <div className={featureThemeClassName('messageMessageListDangerBadge')}>
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{streamingAssistantMessage.errorMessage}</span>
                </div>
              )}
            </div>
          ) : streamingAssistantMessage.isToolCalling ? (
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full">
                  <Wrench className="h-3.5 w-3.5 animate-[wiggle_1.2s_ease-in-out_infinite]" />
                </div>
                <span>
                  {streamingAssistantMessage.toolName
                    ? t('features.messages.ai.toolCallingNamed', {
                        tool: streamingAssistantMessage.toolName,
                      })
                    : t('features.messages.ai.toolCalling')}
                </span>
              </div>
              <div className="border-border/60 bg-background/70 overflow-hidden rounded-md border px-3 py-2">
                <div className={featureThemeClassName('messageMessageListThemedText')}>
                  {t('features.messages.ai.toolCallLabel')}
                </div>
                <div className="text-foreground font-mono text-xs leading-5 break-all">
                  {streamingAssistantMessage.toolPreview ??
                    streamingAssistantMessage.toolName ??
                    translateText('generated.inline.0116_tool_78c84770')}
                </div>
                <div className="mt-2 flex gap-1">
                  <span className="bg-primary/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                  <span className="bg-primary/50 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                  <span className="bg-primary/50 h-1.5 w-1.5 animate-bounce rounded-full" />
                </div>
              </div>
            </div>
          ) : streamingAssistantMessage.isCompressing ? (
            <div className="space-y-3">
              <div className="text-muted-foreground flex items-center gap-3 text-sm">
                <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full">
                  <Archive className="h-3.5 w-3.5" />
                </div>
                <span>{t('features.messages.ai.compressingHistory')}</span>
              </div>
              <div className="border-border/60 bg-background/70 rounded-md border px-3 py-3">
                <div className="mb-2 flex items-end gap-1.5">
                  <span className="bg-primary/35 h-3 w-2 animate-pulse rounded-full [animation-delay:-0.2s]" />
                  <span className="bg-primary/45 h-5 w-2 animate-pulse rounded-full [animation-delay:-0.05s]" />
                  <span className="bg-primary/60 h-7 w-2 animate-pulse rounded-full [animation-delay:0.1s]" />
                  <span className="bg-primary/45 h-5 w-2 animate-pulse rounded-full [animation-delay:0.25s]" />
                  <span className="bg-primary/35 h-3 w-2 animate-pulse rounded-full [animation-delay:0.4s]" />
                </div>
                <div className="flex items-center gap-1.5 opacity-80">
                  <span className="bg-muted-foreground/30 h-1.5 w-16 animate-pulse rounded-full" />
                  <span className="bg-muted-foreground/20 h-1.5 w-10 animate-pulse rounded-full [animation-delay:120ms]" />
                  <span className="bg-muted-foreground/30 h-1.5 w-6 animate-pulse rounded-full [animation-delay:240ms]" />
                </div>
              </div>
            </div>
          ) : streamingAssistantMessage.errorMessage ? (
            <div className={featureThemeClassName('messageMessageListDangerText')}>
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{streamingAssistantMessage.errorMessage}</span>
            </div>
          ) : (
            <div className="text-muted-foreground flex items-center gap-3 text-sm">
              <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              </div>
              <div className="flex items-center gap-2">
                <span>{t('features.messages.ai.thinking')}</span>
                <span className="bg-primary/40 h-1.5 w-1.5 animate-pulse rounded-full" />
                <span className="bg-primary/40 h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:120ms]" />
                <span className="bg-primary/40 h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:240ms]" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MessageList({
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

  return (
    <div className="relative min-h-0 flex-1">
      {hasNewMessages && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
          <Button
            presentation="floatingShadow"
            className="pointer-events-auto"
            size="sm"
            onClick={scrollToBottom}
          >
            {translateText('generated.inline.0753_neue_nachrichten_df7c6ff1')}
          </Button>
        </div>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto">
        {displayMessages.length === 0 && !streamingAssistantMessage ? (
          <div className="flex h-full items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">
              {t('features.messages.conversation.noMessagesYet')}
            </p>
          </div>
        ) : (
          <div
            className="relative w-full"
            style={{
              height: virtualizer.getTotalSize(),
            }}
          >
            {virtualItems.map(virtualItem => {
              const row = virtualRows[virtualItem.index];
              if (!row) return null;

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full px-4 pb-4"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {row.type === 'message' && (
                    <MessageBubble
                      message={row.message}
                      isOwnMessage={row.message.sender?.id === currentUserId}
                      resolveAttachmentCardData={resolveAttachmentCardData}
                    />
                  )}

                  {row.type === 'assistant-actions' && currentUserId && (
                    <AriaKaiMessageActions
                      conversationId={conversation.id}
                      currentUserId={currentUserId}
                    />
                  )}

                  {row.type === 'streaming' && (
                    <StreamingBubble
                      streamingAssistantMessage={row.streaming}
                      otherUser={otherUser}
                    />
                  )}

                  {row.type === 'conversation-request' && (
                    <div className="border-t pt-4">
                      <Card surface="muted">
                        <CardContent className="flex flex-col items-center gap-3 p-4">
                          {conversation.requested_by?.id === currentUserId ? (
                            <p className="text-center text-sm font-medium">
                              {t('features.messages.conversation.waitingForAccept', {
                                name: otherParticipantName,
                              })}
                            </p>
                          ) : (
                            <>
                              <p className="text-center text-sm font-medium">
                                {t('features.messages.conversation.wantsToStart', {
                                  name: otherParticipantName,
                                })}
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => onAcceptConversation(conversation)}
                                  variant="default"
                                  size="sm"
                                >
                                  <Check className="mr-2 h-4 w-4" />
                                  {t('features.messages.conversation.accept')}
                                </Button>
                                <Button
                                  onClick={() => onRejectConversation(conversation)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  {t('features.messages.conversation.reject')}
                                </Button>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
