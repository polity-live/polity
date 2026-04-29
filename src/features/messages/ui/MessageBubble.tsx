import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { MessageContent } from '@/features/messages/ui/MessageContent.tsx';
import { cn } from '@/features/shared/utils/utils';
import { isAssistantUser } from '@/features/assistant/logic/assistantHelpers';
import { Message } from '../types/message.types';
import { formatTime } from '../logic/messageUtils';
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

  return (
    <div className={cn('flex items-end gap-2', isOwnMessage && 'flex-row-reverse')}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={message.sender?.avatar ?? undefined} />
        <AvatarFallback>{message.sender?.first_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
      </Avatar>
      <div className="max-w-[70%] space-y-2">
        <div
          className={cn(
            'rounded-lg px-4 py-2 break-words',
            isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}
        >
          <MessageContent content={message.content ?? ''} />
          <p
            className={cn(
              'mt-1 text-xs',
              isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {formatTime(message.created_at)}
          </p>
        </div>

        <AiContextCards
          contextJson={message.context_json}
          contextLabel={contextLabel}
          resolveAttachmentCardData={resolveAttachmentCardData}
          className={cn(isOwnMessage && 'justify-self-end')}
        />
      </div>
    </div>
  );
}
