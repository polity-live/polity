import type { AiChatAttachment } from '@/lib/ai/schemas';

function isAiChatAttachment(value: unknown): value is AiChatAttachment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.entityType === 'string' &&
    typeof record.entityId === 'string' &&
    typeof record.title === 'string'
  );
}

export function parseContextAttachments(contextJson?: string | null): AiChatAttachment[] {
  if (!contextJson) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(contextJson);
    return Array.isArray(parsed) ? parsed.filter(isAiChatAttachment) : [];
  } catch {
    return [];
  }
}

export function hasRenderableContextCards(contextJson?: string | null): boolean {
  return parseContextAttachments(contextJson).some(attachment => attachment.entityType !== 'skill');
}
