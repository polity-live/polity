import { Card } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';
import { Conversation } from '../types/message.types';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';
import { AssistantMessageView } from './AssistantMessageView';

interface MessageViewProps {
  conversation?: Conversation;
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
  className?: string;
}

export function MessageView({
  conversation,
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
  className,
}: MessageViewProps) {
  const { t } = useTranslation();

  if (conversation && isAssistantConversation(conversation)) {
    return (
      <AssistantMessageView
        conversation={conversation}
        currentUserId={currentUserId}
        onBack={onBack}
        onTogglePin={onTogglePin}
        onDeleteClick={onDeleteClick}
        onMembersClick={onMembersClick}
        onRenameConversation={onRenameConversation}
        onAcceptConversation={onAcceptConversation}
        onRejectConversation={onRejectConversation}
        className={className}
      />
    );
  }

  return (
    <Card
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden md:col-span-2',
        !conversation && 'hidden md:flex',
        className
      )}
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
          <MessageList
            conversation={conversation}
            currentUserId={currentUserId}
            onAcceptConversation={onAcceptConversation}
            onRejectConversation={onRejectConversation}
          />
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
