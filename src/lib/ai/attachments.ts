import { z } from 'zod';
import { aiChatAttachmentSchema, type AiChatAttachment } from './schemas';

const attachmentResultSchema = z.object({
  attachments: z.array(aiChatAttachmentSchema).default([]),
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
