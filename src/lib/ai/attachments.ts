import { z } from 'zod';
import { aiChatAttachmentSchema, type AiChatAttachment } from './schemas';
import {
  aiPresentationBlockSchema,
  dedupeAiPresentations,
  type AiPresentationBlock,
} from './messageContext';

const attachmentResultSchema = z.object({
  attachments: z.array(aiChatAttachmentSchema).default([]),
});

const presentationResultSchema = z.object({
  presentations: z.array(aiPresentationBlockSchema).default([]),
});

export function dedupeAiChatAttachments(
  attachments: readonly AiChatAttachment[]
): AiChatAttachment[] {
  const unique = new Map<string, AiChatAttachment>();

  for (const attachment of attachments) {
    unique.set(`${attachment.entityType}:${attachment.entityId}`, attachment);
  }

  return [...unique.values()];
}

export function extractAiPresentationsFromToolResults(
  toolResults: readonly unknown[]
): AiPresentationBlock[] {
  const presentations: AiPresentationBlock[] = [];

  for (const toolResult of toolResults) {
    if (!toolResult || typeof toolResult !== 'object' || !('result' in toolResult)) continue;
    const parsed = presentationResultSchema.safeParse((toolResult as { result?: unknown }).result);
    if (parsed.success) presentations.push(...parsed.data.presentations);
  }

  return dedupeAiPresentations(presentations);
}

export function extractAiChatAttachmentsFromToolResults(
  toolResults: readonly unknown[]
): AiChatAttachment[] {
  const attachments: AiChatAttachment[] = [];

  for (const toolResult of toolResults) {
    if (!toolResult || typeof toolResult !== 'object' || !('result' in toolResult)) {
      continue;
    }

    const result = (toolResult as { result?: unknown }).result;
    const parsed = attachmentResultSchema.safeParse(result);
    if (parsed.success) {
      attachments.push(...parsed.data.attachments);
    }
  }

  return dedupeAiChatAttachments(attachments);
}
