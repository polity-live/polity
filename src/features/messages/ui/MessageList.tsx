import { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { AlertCircle, Archive, Check, LoaderCircle, Wrench, X } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { Conversation, Message } from '../types/message.types';
import { getOtherParticipant } from '../logic/messageUtils';
import { AriaKaiMessageActions } from '@/features/assistant/ui/AriaKaiMessageActions.tsx';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { MessageContent } from '@/features/messages/ui/MessageContent.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import type { AiAttachmentEntity } from '@/lib/ai/schemas';

interface MessageListProps {
  conversation: Conversation;
  currentUserId?: string;
  onAcceptConversation: (conversation: Conversation) => void;
  onRejectConversation: (conversation: Conversation) => void;
  resolveAttachmentCardData?: (entityType: AiAttachmentEntity, entityId: string) => string | null;
  streamingAssistantMessage?: {
    text: string;
    isCompressing: boolean;
    isThinking: boolean;
    isToolCalling: boolean;
    toolName?: string | null;
    toolPreview?: string | null;
    errorMessage?: string | null;
  };
}

export function MessageList({
  conversation,
  currentUserId,
  onAcceptConversation,
  onRejectConversation,
  resolveAttachmentCardData,
  streamingAssistantMessage,
}: MessageListProps) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [
    conversation.messages,
    streamingAssistantMessage?.text,
    streamingAssistantMessage?.isCompressing,
    streamingAssistantMessage?.isThinking,
    streamingAssistantMessage?.isToolCalling,
    streamingAssistantMessage?.toolName,
    streamingAssistantMessage?.errorMessage,
  ]);

  const otherUser = getOtherParticipant(conversation, currentUserId);
  const otherParticipantName =
    [otherUser?.first_name, otherUser?.last_name].filter(Boolean).join(' ') ||
    t('common.labels.unspecifiedUser');
  const hasUserRepliedToAssistant = conversation.messages.some(
    message => message.sender?.id === currentUserId
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-4 p-4">
        {conversation.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">
              {t('features.messages.conversation.noMessagesYet')}
            </p>
          </div>
        ) : (
          conversation.messages.map((message: Message) => {
            const isOwnMessage = message.sender?.id === currentUserId;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={isOwnMessage}
                resolveAttachmentCardData={resolveAttachmentCardData}
              />
            );
          })
        )}

        {/* Aria & Kai Tutorial Actions - Show only in Aria & Kai conversation */}
        {isAssistantConversation(conversation) && currentUserId && !hasUserRepliedToAssistant && (
          <AriaKaiMessageActions conversationId={conversation.id} currentUserId={currentUserId} />
        )}

        {streamingAssistantMessage && otherUser && (
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
                      <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
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
                          : t('features.messages.ai.toolCalling', 'Aria & Kai is using a tool...')}
                      </span>
                    </div>
                    <div className="bg-background/70 border-border/60 overflow-hidden rounded-md border px-3 py-2">
                      <div className="text-muted-foreground mb-1 text-[11px] font-medium tracking-[0.18em] uppercase">
                        {t('features.messages.ai.toolCallLabel', 'Tool call')}
                      </div>
                      <div className="text-foreground font-mono text-xs leading-5 break-all">
                        {streamingAssistantMessage.toolPreview ??
                          streamingAssistantMessage.toolName ??
                          'tool()'}
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
                      <span>
                        {t(
                          'features.messages.ai.compressingHistory',
                          'Aria & Kai is compressing the chat history...'
                        )}
                      </span>
                    </div>
                    <div className="bg-background/70 border-border/60 rounded-md border px-3 py-3">
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
                  <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{streamingAssistantMessage.errorMessage}</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground flex items-center gap-3 text-sm">
                    <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{t('features.messages.ai.thinking', 'Aria & Kai is thinking...')}</span>
                      <span className="bg-primary/40 h-1.5 w-1.5 animate-pulse rounded-full" />
                      <span className="bg-primary/40 h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:120ms]" />
                      <span className="bg-primary/40 h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:240ms]" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Conversation Request - Only for direct messages */}
        {conversation.type !== 'group' && conversation.status === 'pending' && (
          <div className="border-t pt-4">
            <Card className="bg-muted/50">
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

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
