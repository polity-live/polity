import type { AiChatAttachment } from '@/lib/ai/schemas';
import { parseAiMessageContext, type AiPresentationBlock } from '@/lib/ai/messageContext';

const ASSISTANT_ERROR_CONTEXT_KIND = 'assistant-error';

export function parseContextAttachments(contextJson?: string | null): AiChatAttachment[] {
  return parseAiMessageContext(contextJson).attachments;
}

export function parseContextPresentations(contextJson?: string | null): AiPresentationBlock[] {
  return parseAiMessageContext(contextJson).presentations;
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
  return (
    parseContextAttachments(contextJson).some(attachment => attachment.entityType !== 'skill') ||
    parseContextPresentations(contextJson).length > 0
  );
}
