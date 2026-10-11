import { ConversationDisplay } from '../types/message.types';
import { ARIA_KAI_AVATAR_URL, ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import { resolveAssistantAvatar } from '@/features/assistant/logic/assistantHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface UnreadMessageLike {
  is_read: boolean;
  sender?: {
    id?: string | null;
  } | null;
}

interface ConversationUserLike {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar?: string | null;
  handle?: string | null;
}

interface UnreadParticipantLike {
  last_read_at?: number | null;
  unread_count?: number | null;
  user_id?: string | null;
  user?: ConversationUserLike | null;
}

interface UnreadConversationLike {
  type?: string | null;
  status?: string | null;
  requested_by_id?: string | null;
  created_at?: number | null;
  messages: readonly UnreadMessageLike[];
  participants: readonly UnreadParticipantLike[];
}

interface ConversationDisplayLike {
  type?: string | null;
  name?: string | null;
  group?: {
    id?: string | null;
    name?: string | null;
    image_url?: string | null;
  } | null;
  event?: {
    id?: string | null;
    title?: string | null;
    image_url?: string | null;
  } | null;
  participants: readonly {
    user_id?: string | null;
    user?: ConversationUserLike | null;
  }[];
  assistant_for_user_id?: string | null;
}

interface ConversationRequesterLike {
  requested_by_id?: string | null;
}

export const isConversationRequester = (
  conversation: ConversationRequesterLike,
  currentUserId?: string
) => Boolean(currentUserId && conversation.requested_by_id === currentUserId);

function isAssistantConversationLike(conversation: ConversationDisplayLike) {
  if (conversation.type === 'project_ai' || conversation.assistant_for_user_id) {
    return true;
  }

  return conversation.participants.some(
    participant =>
      participant.user_id === ARIA_KAI_USER_ID || participant.user?.id === ARIA_KAI_USER_ID
  );
}

export const getConversationDisplay = (
  conversation: ConversationDisplayLike,
  currentUserId?: string
): ConversationDisplay => {
  if (conversation.type === 'project_ai') {
    return {
      name: conversation.name?.trim() || 'Project chat',
      avatar: ARIA_KAI_AVATAR_URL,
      handle: 'aria-kai',
      isGroup: false,
      isEvent: false,
      isCollective: false,
    };
  }

  if (conversation.type === 'group') {
    return {
      name:
        conversation.group?.name ||
        conversation.name ||
        translateText('features.messages.fallbacks.groupChat'),
      avatar: conversation.group?.image_url || null,
      handle: null,
      isGroup: true,
      isEvent: false,
      isCollective: true,
      participantCount: conversation.participants.length,
    };
  }

  if (conversation.type === 'event') {
    return {
      name:
        conversation.event?.title ||
        conversation.name ||
        translateText('features.messages.fallbacks.eventChat'),
      avatar: conversation.event?.image_url || null,
      handle: null,
      isGroup: false,
      isEvent: true,
      isCollective: true,
      participantCount: conversation.participants.length,
    };
  }

  const otherUser = conversation.participants.find(p => p.user?.id !== currentUserId)?.user;

  if (isAssistantConversationLike(conversation)) {
    const assistantName =
      [otherUser?.first_name, otherUser?.last_name].filter(Boolean).join(' ') ||
      'Assistent Aria & Kai';

    return {
      name: conversation.name?.trim() || assistantName,
      avatar: resolveAssistantAvatar(ARIA_KAI_USER_ID, otherUser?.avatar),
      handle: otherUser?.handle,
      isGroup: false,
      isEvent: false,
      isCollective: false,
    };
  }

  return {
    name:
      [otherUser?.first_name, otherUser?.last_name].filter(Boolean).join(' ') ||
      conversation.name ||
      translateText('common.unknownUser'),
    avatar: otherUser?.avatar,
    handle: otherUser?.handle,
    isGroup: false,
    isEvent: false,
    isCollective: false,
  };
};

export const getOtherParticipant = (
  conversation: ConversationDisplayLike,
  currentUserId?: string
) => {
  if (conversation.type === 'group' || conversation.type === 'event') return null;
  return conversation.participants.find(p => p.user?.id !== currentUserId)?.user;
};

// Project local calendar fields into UTC so these formatters can be reused even
// when the system timezone changes. The leap year also preserves February 29.
const messageTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});
const messageDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export const formatTime = (date: string | number) => {
  const now = new Date();
  const messageDate = new Date(date);

  if (Number.isNaN(messageDate.getTime())) {
    return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Check if message is from today
  const isToday =
    now.getDate() === messageDate.getDate() &&
    now.getMonth() === messageDate.getMonth() &&
    now.getFullYear() === messageDate.getFullYear();

  if (isToday) {
    // Show time if today (e.g., "2:30 PM")
    return messageTimeFormatter.format(
      Date.UTC(2000, 0, 1, messageDate.getHours(), messageDate.getMinutes())
    );
  } else {
    // Show date if before today (e.g., "Jan 15")
    return messageDateFormatter.format(
      Date.UTC(2000, messageDate.getMonth(), messageDate.getDate())
    );
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
  const participant = getCurrentParticipant(conversation, currentUserId);
  if (typeof participant?.unread_count === 'number') {
    return participant.unread_count;
  }

  return conversation.messages.filter(msg => !msg.is_read && msg.sender?.id !== currentUserId)
    .length;
};

export const hasUnreadConversationRequest = (
  conversation: UnreadConversationLike,
  currentUserId?: string
) => {
  if (
    !currentUserId ||
    conversation.type === 'group' ||
    conversation.type === 'event' ||
    conversation.status !== 'pending'
  ) {
    return false;
  }

  if (isConversationRequester(conversation, currentUserId)) {
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
