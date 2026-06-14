import { featureThemeClassName } from '@/features/shared/theme';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { AlertCircle } from 'lucide-react';
import { MessageContent } from '@/features/messages/ui/MessageContent.tsx';
import { cn } from '@/features/shared/utils/utils';
import { isAssistantUser } from '@/features/assistant/logic/assistantHelpers';
import { Message } from '../types/message.types';
import { formatTime } from '../logic/messageUtils';
import { hasRenderableContextCards, isAssistantErrorContext } from '../logic/contextAttachments';
import { AiContextCards } from './AiContextCards';
import type { AiAttachmentEntity } from '@/lib/ai/schemas';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  resolveAttachmentCardData?: (entityType: AiAttachmentEntity, entityId: string) => string | null;
}

export function MessageBubble({
  message,
  isOwnMessage,
  resolveAttachmentCardData,
}: MessageBubbleProps) {
  const contextLabel = isAssistantUser(message.sender?.id ?? '') ? 'output' : 'input';
  const hasContent = Boolean(message.content?.trim());
  const isAssistantError = isAssistantErrorContext(message.context_json);
  const hidePolityLinkPreviews =
    contextLabel === 'output' && hasRenderableContextCards(message.context_json);

  return (
    <div className={cn('flex items-end gap-2', isOwnMessage && 'flex-row-reverse')}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={message.sender?.avatar ?? undefined} />
        <AvatarFallback>{message.sender?.first_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
      </Avatar>
      <div className="max-w-[70%] space-y-2">
        {hasContent && (
          <div
            className={cn(
              'rounded-lg px-4 py-2 break-words',
              isOwnMessage
                ? 'bg-primary text-primary-foreground'
                : isAssistantError
                  ? featureThemeClassName('messageMessageBubbleDangerBadge')
                  : 'bg-muted'
            )}
          >
            {isAssistantError ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <MessageContent content={message.content ?? ''} />
                  </div>
                </div>
              </div>
            ) : (
              <MessageContent
                content={message.content ?? ''}
                hidePolityLinkPreviews={hidePolityLinkPreviews}
              />
            )}
            <p
              className={cn(
                'mt-1 text-xs',
                isOwnMessage
                  ? 'text-primary-foreground/70'
                  : isAssistantError
                    ? featureThemeClassName('messageMessageBubbleDangerText')
                    : 'text-muted-foreground'
              )}
            >
              {formatTime(message.created_at)}
            </p>
          </div>
        )}

        <AiContextCards
          contextJson={message.context_json}
          contextLabel={contextLabel}
          resolveAttachmentCardData={resolveAttachmentCardData}
          className={cn(isOwnMessage && 'justify-self-end')}
        />

        {!hasContent && (
          <p className={cn('text-muted-foreground px-1 text-xs', isOwnMessage && 'text-right')}>
            {formatTime(message.created_at)}
          </p>
        )}
      </div>
    </div>
  );
}
