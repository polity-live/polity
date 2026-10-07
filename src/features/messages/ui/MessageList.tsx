import { Conversation, Message } from '../types/message.types';
import type { AiAttachmentEntity } from '@/lib/ai/schemas';
import type { ReactNode } from 'react';
export interface MessageTimelineItem {
  id: string;
  createdAt: number;
  content: ReactNode;
}
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
  timelineItems?: MessageTimelineItem[];
  active?: boolean;
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
  timelineItems,
  active = true,
}: MessageListProps) {
  const viewProps = useMessageListController({
    active,
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
    timelineItems,
  });

  return <MessageListView {...viewProps} />;
}
