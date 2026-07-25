import { Card } from '@/features/shared/ui/ui/card';
import type { CSSProperties } from 'react';
import { cn } from '@/features/shared/utils/utils';
import { Conversation, Message } from '../types/message.types';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';
import { AssistantMessageView } from './AssistantMessageView';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import type { SwipeNavigationHandlers } from '@/features/shared/hooks/useSwipeNavigation';

interface MessageViewProps {
  conversation?: Conversation;
  messages?: Message[];
  isThreadLoading?: boolean;
  hasMoreOlderMessages?: boolean;
  onLoadOlderMessages?: () => void;
  onAtEndChange?: (isAtEnd: boolean) => void;
  currentUserId?: string;
  isConversationUserOnline: boolean;
  onBack: () => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onDeleteClick: (id: string) => void;
  onMembersClick: () => void;
  onRenameConversation: (id: string, name: string | null) => Promise<boolean>;
  onSendMessage: (content: string, contextJson: string) => Promise<boolean>;
  onAcceptConversation: (conversation: Conversation) => void;
  onRejectConversation: (conversation: Conversation) => void;
  swipeHandlers?: SwipeNavigationHandlers;
  className?: string;
}

export function MessageView({
  conversation,
  messages,
  isThreadLoading = false,
  hasMoreOlderMessages,
  onLoadOlderMessages,
  onAtEndChange,
  currentUserId,
  isConversationUserOnline,
  onBack,
  onTogglePin,
  onDeleteClick,
  onMembersClick,
  onRenameConversation,
  onSendMessage,
  onAcceptConversation,
  onRejectConversation,
  swipeHandlers,
  className,
}: MessageViewProps) {
  const { t } = useTranslation();

  if (conversation && isAssistantConversation(conversation)) {
    return (
      <AssistantMessageView
        conversation={conversation}
        messages={messages}
        hasMoreOlderMessages={hasMoreOlderMessages}
        onLoadOlderMessages={onLoadOlderMessages}
        onAtEndChange={onAtEndChange}
        currentUserId={currentUserId}
        onBack={onBack}
        onTogglePin={onTogglePin}
        onDeleteClick={onDeleteClick}
        onMembersClick={onMembersClick}
        onRenameConversation={onRenameConversation}
        onAcceptConversation={onAcceptConversation}
        onRejectConversation={onRejectConversation}
        swipeHandlers={swipeHandlers}
        className={className}
      />
    );
  }

  return (
    <Card
      className={cn(
        'md:bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none md:col-span-2 md:rounded-lg md:border md:shadow-[var(--shadow-panel)]',
        !conversation && 'hidden md:flex',
        className
      )}
      style={{ touchAction: 'pan-y' }}
      {...swipeHandlers}
    >
      {conversation ? (
        <div className="flex h-full min-h-0 flex-col">
          <ConversationHeader
            conversation={conversation}
            currentUserId={currentUserId}
            isOnline={isConversationUserOnline}
            onBack={onBack}
            onTogglePin={onTogglePin}
            onDeleteClick={onDeleteClick}
            onMembersClick={onMembersClick}
            onRenameConversation={onRenameConversation}
          />
          {isThreadLoading ? (
            <MessageThreadSkeleton />
          ) : (
            <MessageList
              conversation={conversation}
              messages={messages}
              hasMoreOlderMessages={hasMoreOlderMessages}
              onLoadOlderMessages={onLoadOlderMessages}
              onAtEndChange={onAtEndChange}
              currentUserId={currentUserId}
              onAcceptConversation={onAcceptConversation}
              onRejectConversation={onRejectConversation}
            />
          )}
          <MessageInput
            conversation={conversation}
            currentUserId={currentUserId}
            onSendMessage={onSendMessage}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold">{t('features.messages.conversation.select')}</p>
            <p className="text-muted-foreground text-sm">
              {t('features.messages.conversation.selectDescription')}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function MessageThreadSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-hidden p-4"
      data-slot="message-thread-skeleton"
    >
      {Array.from({ length: 6 }, (_, index) => {
        const own = index % 3 === 1;

        return (
          <div
            key={index}
            className={cn(
              'civic-stagger-item flex items-end gap-2',
              own ? 'justify-end' : 'justify-start'
            )}
            style={{ '--civic-stagger-index': index } as CSSProperties}
          >
            {!own ? <Skeleton className="h-8 w-8 rounded-md" /> : null}
            <div className={cn('space-y-2', own ? 'w-1/2' : 'w-2/3')}>
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-2 w-24 rounded-full" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
