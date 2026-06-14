import type { AiChatAttachment } from '@/lib/ai/schemas';

const ASSISTANT_ERROR_CONTEXT_KIND = 'assistant-error';

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

export function buildAssistantErrorContextJson(): string {
  return JSON.stringify({ kind: ASSISTANT_ERROR_CONTEXT_KIND });
}

export function isAssistantErrorContext(contextJson?: string | null): boolean {
  if (!contextJson) {
    return false;
  }

  try {
    const parsed: unknown = JSON.parse(contextJson);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return false;
    }

    return (parsed as { kind?: unknown }).kind === ASSISTANT_ERROR_CONTEXT_KIND;
  } catch {
    return false;
  }
}

export function hasRenderableContextCards(contextJson?: string | null): boolean {
  return parseContextAttachments(contextJson).some(attachment => attachment.entityType !== 'skill');
}
