import { featureThemeClassName } from '@/features/shared/theme';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { AlertCircle, Archive, Check, LoaderCircle, Wrench, X } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { getOtherParticipant } from '../logic/messageUtils';
import { AriaKaiMessageActions } from '@/features/assistant/ui/AriaKaiMessageActions.tsx';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { MessageContent } from '@/features/messages/ui/MessageContent.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
interface StreamingAssistantMessage {
  text: string;
  isCompressing: boolean;
  isThinking: boolean;
  isToolCalling: boolean;
  toolName?: string | null;
  toolPreview?: string | null;
  errorMessage?: string | null;
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

export interface MessageListViewProps {
  conversation: any;
  messages: any;
  hasMoreOlderMessages: any;
  onLoadOlderMessages: any;
  onAtEndChange: any;
  currentUserId: any;
  onAcceptConversation: any;
  onRejectConversation: any;
  resolveAttachmentCardData: any;
  streamingAssistantMessage: any;
  t: any;
  scrollRef: any;
  pendingPrependRef: any;
  rafRef: any;
  previousConversationIdRef: any;
  previousLastMessageIdRef: any;
  isAtEnd: any;
  setIsAtEnd: any;
  hasNewMessages: any;
  setHasNewMessages: any;
  displayMessages: any;
  otherUser: any;
  otherParticipantName: any;
  hasUserRepliedToAssistant: any;
  virtualRows: any;
  virtualizer: any;
  virtualItems: any[];
  updateAtEnd: any;
  scrollToBottom: any;
  scheduleScrollToBottom: any;
  handleScroll: any;
}

export function MessageListView({
  conversation,
  currentUserId,
  onAcceptConversation,
  onRejectConversation,
  resolveAttachmentCardData,
  streamingAssistantMessage,
  t,
  scrollRef,
  hasNewMessages,
  displayMessages,
  otherUser,
  otherParticipantName,
  virtualRows,
  virtualizer,
  virtualItems,
  scrollToBottom,
  handleScroll,
}: MessageListViewProps) {
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
            {virtualItems.map((virtualItem: any) => {
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
