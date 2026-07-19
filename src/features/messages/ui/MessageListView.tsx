import { featureThemeClassName } from '@/features/shared/theme';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  AlertCircle,
  Archive,
  Check,
  ChevronDown,
  LoaderCircle,
  RotateCcw,
  Wrench,
  X,
} from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { getOtherParticipant, isConversationRequester } from '../logic/messageUtils';
import { AriaKaiMessageActions } from '@/features/assistant/ui/AriaKaiMessageActions.tsx';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { MessageContent } from '@/features/messages/ui/MessageContent.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';
import { rowAttributes, ZeroVirtualSpacer } from '@/features/shared/virtualization';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
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
export function StreamingBubble({
  streamingAssistantMessage,
  otherUser,
  hidePolityLinkPreviews,
}: {
  streamingAssistantMessage: StreamingAssistantMessage;
  otherUser: ReturnType<typeof getOtherParticipant>;
  hidePolityLinkPreviews: boolean;
}) {
  const { t } = useTranslation();
  if (!otherUser) return null;

  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={otherUser.avatar ?? undefined} />
        <AvatarFallback>{otherUser.first_name?.[0]?.toUpperCase() || 'A'}</AvatarFallback>
      </Avatar>
      <div className="max-w-3xl min-w-0 flex-1 space-y-3 py-1">
        {streamingAssistantMessage.text && (
          <MessageContent
            content={streamingAssistantMessage.text}
            hidePolityLinkPreviews={hidePolityLinkPreviews}
            renderMarkdown
          />
        )}

        {(streamingAssistantMessage.isThinking ||
          streamingAssistantMessage.isCompressing ||
          streamingAssistantMessage.isToolCalling) && (
          <Collapsible className="group/activity text-muted-foreground text-sm">
            <CollapsibleTrigger className="hover:text-foreground flex items-center gap-2 transition-colors">
              {streamingAssistantMessage.isToolCalling ? (
                <Wrench className="h-4 w-4 animate-[wiggle_1.2s_ease-in-out_infinite]" />
              ) : streamingAssistantMessage.isCompressing ? (
                <Archive className="h-4 w-4" />
              ) : (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
              <span>
                {streamingAssistantMessage.isToolCalling
                  ? streamingAssistantMessage.toolName
                    ? t('features.messages.ai.toolCallingNamed', {
                        tool: streamingAssistantMessage.toolName,
                      })
                    : t('features.messages.ai.toolCalling')
                  : streamingAssistantMessage.isCompressing
                    ? t('features.messages.ai.compressingHistory')
                    : t('features.messages.ai.thinking')}
              </span>
              {streamingAssistantMessage.toolPreview && (
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/activity:rotate-180" />
              )}
            </CollapsibleTrigger>
            {streamingAssistantMessage.toolPreview && (
              <CollapsibleContent className="border-border/60 bg-muted/40 mt-2 rounded-lg border px-3 py-2 font-mono text-xs break-all">
                {streamingAssistantMessage.toolPreview}
              </CollapsibleContent>
            )}
          </Collapsible>
        )}

        {streamingAssistantMessage.errorMessage && (
          <div className={featureThemeClassName('messageMessageListDangerBadge')}>
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="min-w-0 flex-1">{streamingAssistantMessage.errorMessage}</span>
            {streamingAssistantMessage.canRetry && streamingAssistantMessage.onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 flex-shrink-0"
                onClick={() => void streamingAssistantMessage.onRetry?.()}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                {t('features.messages.ai.retry')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface MessageListViewProps {
  conversation: any;
  currentUserId: any;
  onAcceptConversation: any;
  onRejectConversation: any;
  resolveAttachmentCardData: any;
  t: any;
  scrollRef: any;
  hasNewMessages: any;
  otherUser: any;
  otherParticipantName: any;
  virtualRows: any;
  spaceBefore: number;
  spaceAfter: number;
  rowsEmpty: boolean;
  scrollToBottom: any;
  handleScroll: any;
}

export function MessageListView({
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
  spaceBefore,
  spaceAfter,
  rowsEmpty,
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
        {rowsEmpty && virtualRows.length === 0 ? (
          <div className="flex h-full items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">
              {t('features.messages.conversation.noMessagesYet')}
            </p>
          </div>
        ) : (
          <div className="w-full">
            <div>
              <ZeroVirtualSpacer position="before" size={spaceBefore} />
              {virtualRows
                .filter((row: any) => row.type === 'message')
                .map((row: any) => {
                  return (
                    <div
                      key={row.key}
                      {...rowAttributes(row.index, row.key)}
                      className="w-full px-4 pb-4"
                    >
                      {row.message ? (
                        <MessageBubble
                          message={row.message}
                          isOwnMessage={row.message.sender?.id === currentUserId}
                          isAssistantConversation={isAssistantConversation(conversation)}
                          resolveAttachmentCardData={resolveAttachmentCardData}
                        />
                      ) : (
                        <div className="flex items-start gap-3 py-2" aria-hidden="true">
                          <Skeleton className="h-8 w-8 rounded-md" />
                          <Skeleton className="h-16 max-w-xl flex-1 rounded-2xl" />
                        </div>
                      )}
                    </div>
                  );
                })}
              <ZeroVirtualSpacer position="after" size={spaceAfter} />
            </div>
            {virtualRows
              .filter((row: any) => row.type !== 'message')
              .map((row: any) => (
                <div key={row.key} className="w-full px-4 pb-4">
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
                      hidePolityLinkPreviews={isAssistantConversation(conversation)}
                    />
                  )}

                  {row.type === 'conversation-request' && (
                    <div className="border-t pt-4">
                      <Card surface="muted">
                        <CardContent className="flex flex-col items-center gap-3 p-4">
                          {isConversationRequester(conversation, currentUserId) ? (
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
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
