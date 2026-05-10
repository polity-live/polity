'use client';

import { Card } from '@/features/shared/ui/ui/card';
import { cn } from '@/features/shared/utils/utils';
import type { Conversation } from '../types/message.types';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { AssistantMessageInput } from './AssistantMessageInput';
import { useAssistantChat } from '../hooks/useAssistantChat';

interface AssistantMessageViewProps {
  conversation: Conversation;
  currentUserId?: string;
  onBack: () => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onDeleteClick: (id: string) => void;
  onMembersClick: () => void;
  onRenameConversation: (id: string, name: string | null) => Promise<boolean>;
  onAcceptConversation: (conversation: Conversation) => void;
  onRejectConversation: (conversation: Conversation) => void;
  className?: string;
}

export function AssistantMessageView({
  conversation,
  currentUserId,
  onBack,
  onTogglePin,
  onDeleteClick,
  onMembersClick,
  onRenameConversation,
  onAcceptConversation,
  onRejectConversation,
  className,
}: AssistantMessageViewProps) {
  const assistantChat = useAssistantChat(conversation, currentUserId);

  return (
    <Card className={cn('flex flex-col overflow-hidden md:col-span-2', className)}>
      <div className="flex h-full flex-col">
        <ConversationHeader
          conversation={conversation}
          currentUserId={currentUserId}
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
          resolveAttachmentCardData={assistantChat.resolveAttachmentCardData}
          streamingAssistantMessage={
            assistantChat.streamingText ||
            assistantChat.isThinking ||
            assistantChat.isToolCalling ||
            assistantChat.streamError
              ? {
                  text: assistantChat.streamingText,
                  isCompressing: assistantChat.isCompressing,
                  isThinking: assistantChat.isThinking,
                  isToolCalling: assistantChat.isToolCalling,
                  toolName: assistantChat.activeToolName,
                  toolPreview: assistantChat.activeToolCall?.preview ?? null,
                  errorMessage: assistantChat.streamError,
                }
              : undefined
          }
        />

        <AssistantMessageInput assistantChat={assistantChat} />
      </div>
    </Card>
  );
}
