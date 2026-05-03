import { Conversation, ConversationDisplay } from '../types/message.types';

interface UnreadMessageLike {
  is_read: boolean;
  sender?: {
    id?: string | null;
  } | null;
}

interface UnreadParticipantLike {
  last_read_at?: number | null;
  user_id?: string | null;
  user?: {
    id?: string | null;
  } | null;
}

interface UnreadConversationLike {
  type?: string | null;
  status?: string | null;
  requested_by_id?: string | null;
  created_at?: number | null;
  messages: readonly UnreadMessageLike[];
  participants: readonly UnreadParticipantLike[];
}

export const getConversationDisplay = (
  conversation: Conversation,
  currentUserId?: string
): ConversationDisplay => {
  if (conversation.type === 'group') {
    return {
      name: conversation.name || conversation.group?.name || 'Group Chat',
      avatar: conversation.group?.image_url || null,
      handle: null,
      isGroup: true,
      participantCount: conversation.participants.length,
    };
  } else {
    const otherUser = conversation.participants.find(p => p.user?.id !== currentUserId)?.user;
    return {
      name:
        [otherUser?.first_name, otherUser?.last_name].filter(Boolean).join(' ') || 'Unknown User',
      avatar: otherUser?.avatar,
      handle: otherUser?.handle,
      isGroup: false,
    };
  }
};

export const getOtherParticipant = (conversation: Conversation, currentUserId?: string) => {
  if (conversation.type === 'group') return null;
  return conversation.participants.find(p => p.user?.id !== currentUserId)?.user;
};

export const formatTime = (date: string | number) => {
  const now = new Date();
  const messageDate = new Date(date);

  // Check if message is from today
  const isToday =
    now.getDate() === messageDate.getDate() &&
    now.getMonth() === messageDate.getMonth() &&
    now.getFullYear() === messageDate.getFullYear();

  if (isToday) {
    // Show time if today (e.g., "2:30 PM")
    return messageDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } else {
    // Show date if before today (e.g., "Jan 15")
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
};

const getCurrentParticipant = (conversation: UnreadConversationLike, currentUserId?: string) => {
  if (!currentUserId) {
    return undefined;
  }

  return conversation.participants.find(
    participant => participant.user_id === currentUserId || participant.user?.id === currentUserId
  );
};

export const getUnreadMessageCount = (
  conversation: UnreadConversationLike,
  currentUserId?: string
) => {
  return conversation.messages.filter(msg => !msg.is_read && msg.sender?.id !== currentUserId)
    .length;
};

export const hasUnreadConversationRequest = (
  conversation: UnreadConversationLike,
  currentUserId?: string
) => {
  if (!currentUserId || conversation.type === 'group' || conversation.status !== 'pending') {
    return false;
  }

  if (conversation.requested_by_id === currentUserId) {
    return false;
  }

  const participant = getCurrentParticipant(conversation, currentUserId);
  if (!participant) {
    return false;
  }

  const requestCreatedAt = conversation.created_at ?? 0;
  const lastReadAt = participant.last_read_at ?? 0;

  return requestCreatedAt > 0 && lastReadAt < requestCreatedAt;
};

export const getUnreadCount = (conversation: UnreadConversationLike, currentUserId?: string) => {
  return (
    getUnreadMessageCount(conversation, currentUserId) +
    (hasUnreadConversationRequest(conversation, currentUserId) ? 1 : 0)
  );
};
