import { Card } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';
import type { Conversation, Message } from '../types/message.types';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { AssistantMessageInput } from './AssistantMessageInput';

interface AssistantMessageContentViewProps {
  conversation: Conversation;
  messages?: Message[];
  hasMoreOlderMessages?: boolean;
  onLoadOlderMessages?: () => void;
  onAtEndChange?: (isAtEnd: boolean) => void;
  currentUserId?: string;
  onBack: () => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onDeleteClick: (id: string) => void;
  onMembersClick: () => void;
  onRenameConversation: (id: string, name: string | null) => Promise<boolean>;
  onAcceptConversation: (conversation: Conversation) => void;
  onRejectConversation: (conversation: Conversation) => void;
  className?: string;
  assistantChat: any;
  streamingAssistantMessage: any;
}

export function AssistantMessageContentView({
  conversation,
  messages,
  hasMoreOlderMessages,
  onLoadOlderMessages,
  onAtEndChange,
  currentUserId,
  onBack,
  onTogglePin,
  onDeleteClick,
  onMembersClick,
  onRenameConversation,
  onAcceptConversation,
  onRejectConversation,
  className,
  assistantChat,
  streamingAssistantMessage,
}: AssistantMessageContentViewProps) {
  return (
    <Card className={cn('flex h-full min-h-0 flex-col overflow-hidden md:col-span-2', className)}>
      <div className="flex h-full min-h-0 flex-col">
        <ConversationHeader
          conversation={conversation}
          currentUserId={currentUserId}
          isOnline={false}
          onBack={onBack}
          onTogglePin={onTogglePin}
          onDeleteClick={onDeleteClick}
          onMembersClick={onMembersClick}
          onRenameConversation={onRenameConversation}
        />

        <MessageList
          conversation={conversation}
          messages={messages}
          hasMoreOlderMessages={hasMoreOlderMessages}
          onLoadOlderMessages={onLoadOlderMessages}
          onAtEndChange={onAtEndChange}
          currentUserId={currentUserId}
          onAcceptConversation={onAcceptConversation}
          onRejectConversation={onRejectConversation}
          resolveAttachmentCardData={assistantChat.resolveAttachmentCardData}
          streamingAssistantMessage={streamingAssistantMessage}
        />

        <AssistantMessageInput assistantChat={assistantChat} />
      </div>
    </Card>
  );
}
