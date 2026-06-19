'use client';

import type { Conversation, Message } from '../types/message.types';
import { useAssistantChat } from '../hooks/useAssistantChat';
import { AssistantMessageContentView } from './AssistantMessageContentView';
import type { SwipeNavigationHandlers } from '@/features/shared/hooks/useSwipeNavigation';

interface AssistantMessageViewProps {
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
  swipeHandlers?: SwipeNavigationHandlers;
  className?: string;
}

export function AssistantMessageView({
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
  swipeHandlers,
  className,
}: AssistantMessageViewProps) {
  const assistantChat = useAssistantChat(conversation, currentUserId);
  const streamingAssistantMessage =
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
      : undefined;

  return (
    <AssistantMessageContentView
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
      assistantChat={assistantChat}
      streamingAssistantMessage={streamingAssistantMessage}
    />
  );
}
