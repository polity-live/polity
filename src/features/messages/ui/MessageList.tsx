import { Conversation, Message } from '../types/message.types';
import type { AiAttachmentEntity } from '@/lib/ai/schemas';
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
interface MessageListProps {
  conversation: Conversation;
  messages?: Message[];
  hasMoreOlderMessages?: boolean;
  onLoadOlderMessages?: () => void;
  onAtEndChange?: (isAtEnd: boolean) => void;
  currentUserId?: string;
  onAcceptConversation: (conversation: Conversation) => void;
  onRejectConversation: (conversation: Conversation) => void;
  resolveAttachmentCardData?: (entityType: AiAttachmentEntity, entityId: string) => string | null;
  streamingAssistantMessage?: StreamingAssistantMessage;
}

import { useMessageListController } from './useMessageListController';
import { MessageListView } from './MessageListView';

export function MessageList({
  conversation,
  messages,
  hasMoreOlderMessages = false,
  onLoadOlderMessages,
  onAtEndChange,
  currentUserId,
  onAcceptConversation,
  onRejectConversation,
  resolveAttachmentCardData,
  streamingAssistantMessage,
}: MessageListProps) {
  const viewProps = useMessageListController({
    conversation,
    messages,
    hasMoreOlderMessages,
    onLoadOlderMessages,
    onAtEndChange,
    currentUserId,
    onAcceptConversation,
    onRejectConversation,
    resolveAttachmentCardData,
    streamingAssistantMessage,
  });

  return <MessageListView {...viewProps} />;
}
