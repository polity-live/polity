import { ARIA_KAI_AVATAR_URL, ARIA_KAI_USER_ID } from '../constants';

/**
 * Check if a user ID belongs to the Aria & Kai system assistant.
 */
export function isAssistantUser(userId: string | null | undefined): boolean {
  return userId === ARIA_KAI_USER_ID;
}

/**
 * Keep the Aria & Kai system avatar consistent even when an older user row has
 * no avatar yet. Other users retain the avatar value supplied by their profile.
 */
export function resolveAssistantAvatar<T extends string | null | undefined>(
  userId: string | null | undefined,
  avatar: T
): T | typeof ARIA_KAI_AVATAR_URL {
  return isAssistantUser(userId) ? ARIA_KAI_AVATAR_URL : avatar;
}

/**
 * Check if a conversation includes the Aria & Kai assistant as a participant.
 * Works with any conversation shape that has a `participants` array with `user_id` or nested `user.id`.
 */
export function isAssistantConversation(conversation: {
  assistant_for_user_id?: string | null;
  participants: readonly { user_id?: string; user?: { id: string } | null }[];
}): boolean {
  if (conversation.assistant_for_user_id) {
    return true;
  }

  return conversation.participants.some(
    p => p.user_id === ARIA_KAI_USER_ID || p.user?.id === ARIA_KAI_USER_ID
  );
}
