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

function readToolResultPayload(toolResult: unknown): unknown {
  if (!toolResult || typeof toolResult !== 'object') return undefined;

  const resultRecord = toolResult as Record<string, unknown>;
  if ('output' in resultRecord) return resultRecord.output;
  if ('result' in resultRecord) return resultRecord.result;

  return undefined;
}

export function dedupeAiChatAttachments(
  attachments: readonly AiChatAttachment[]
): AiChatAttachment[] {
  const unique = new Map<string, AiChatAttachment>();

  for (const attachment of attachments) {
    const key = `${attachment.entityType}:${attachment.entityId}`;
    const existing = unique.get(key);
    if (existing?.context_type === 'update' && attachment.context_type !== 'update') continue;
    unique.set(key, attachment);
  }

  return [...unique.values()];
}

export function extractAiPresentationsFromToolResults(
  toolResults: readonly unknown[]
): AiPresentationBlock[] {
  const presentations: AiPresentationBlock[] = [];

  for (const toolResult of toolResults) {
    const parsed = presentationResultSchema.safeParse(readToolResultPayload(toolResult));
    if (parsed.success) presentations.push(...parsed.data.presentations);
  }

  return dedupeAiPresentations(presentations);
}

export function extractAiChatAttachmentsFromToolResults(
  toolResults: readonly unknown[]
): AiChatAttachment[] {
  const attachments: AiChatAttachment[] = [];

  for (const toolResult of toolResults) {
    const parsed = attachmentResultSchema.safeParse(readToolResultPayload(toolResult));
    if (parsed.success) {
      attachments.push(...parsed.data.attachments);
    }
  }

  return dedupeAiChatAttachments(attachments);
}
