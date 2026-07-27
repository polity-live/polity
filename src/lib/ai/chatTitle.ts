export const DEFAULT_ASSISTANT_CONVERSATION_NAME = 'Assistent Aria & Kai';
export const MAX_ASSISTANT_CONVERSATION_TITLE_LENGTH = 60;

export function normalizeAssistantConversationTitle(title: string): string | null {
  const normalized = title
    .replace(/\\([^\p{L}\p{N}\s])/gu, '$1')
    .replace(/_+/gu, ' ')
    .trim()
    .replace(/^[\s*`"'“”„«»‹›]+|[\s*`"'“”„«»‹›]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

  if (!normalized) {
    return null;
  }

  return Array.from(normalized)
    .slice(0, MAX_ASSISTANT_CONVERSATION_TITLE_LENGTH)
    .join('')
    .trimEnd();
}
