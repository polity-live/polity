export const INITIAL_CONVERSATION_LIMIT = 20;
export const INITIAL_MESSAGE_LIMIT = 80;

export function conversationsArgs(limit?: number) {
  return { limit };
}

export function messagesWindowArgs(conversationId: string, limit = INITIAL_MESSAGE_LIMIT) {
  return { conversation_id: conversationId, limit };
}

export function conversationArgs(conversationId: string) {
  return { id: conversationId };
}
