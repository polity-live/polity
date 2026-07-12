import { z } from 'zod';
import { aiChatAttachmentSchema, type AiChatAttachment } from './schemas';

export const aiFindingToneSchema = z.enum(['neutral', 'info', 'success', 'warning', 'danger']);

export const aiFindingItemSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(800),
  badge: z.string().trim().min(1).max(48).nullable().optional(),
  tone: aiFindingToneSchema.default('neutral'),
});

export const aiFindingsPresentationSchema = z.object({
  type: z.literal('findings'),
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(800).nullable().optional(),
  items: z.array(aiFindingItemSchema).min(2).max(12),
});

export const aiPresentationBlockSchema = aiFindingsPresentationSchema;
export type AiPresentationBlock = z.infer<typeof aiPresentationBlockSchema>;
export type AiFindingItem = z.infer<typeof aiFindingItemSchema>;
export type AiFindingTone = z.infer<typeof aiFindingToneSchema>;

export const aiMessageContextV1Schema = z.object({
  version: z.literal(1),
  attachments: z.array(aiChatAttachmentSchema).default([]),
  presentations: z.array(aiPresentationBlockSchema).default([]),
});

export interface AiMessageContextV1 {
  version: 1;
  attachments: AiChatAttachment[];
  presentations: AiPresentationBlock[];
}

export function dedupeAiPresentations(
  presentations: readonly AiPresentationBlock[]
): AiPresentationBlock[] {
  const unique = new Map<string, AiPresentationBlock>();
  for (const presentation of presentations) {
    unique.set(`${presentation.type}:${presentation.id}`, presentation);
  }
  return [...unique.values()];
}

export function createAiMessageContext(
  attachments: readonly AiChatAttachment[] = [],
  presentations: readonly AiPresentationBlock[] = []
): AiMessageContextV1 {
  const uniqueAttachments = new Map<string, AiChatAttachment>();
  for (const attachment of attachments) {
    uniqueAttachments.set(`${attachment.entityType}:${attachment.entityId}`, attachment);
  }

  return {
    version: 1,
    attachments: [...uniqueAttachments.values()],
    presentations: dedupeAiPresentations(presentations),
  };
}

export function parseAiMessageContext(value?: string | null): AiMessageContextV1 {
  if (!value) return createAiMessageContext();

  try {
    const parsed: unknown = JSON.parse(value);
    const legacyAttachments = aiChatAttachmentSchema.array().safeParse(parsed);
    if (legacyAttachments.success) {
      return createAiMessageContext(legacyAttachments.data);
    }

    if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) {
      return createAiMessageContext();
    }

    const record = parsed as { attachments?: unknown; presentations?: unknown };
    const attachments = aiChatAttachmentSchema.array().safeParse(record.attachments);
    const presentationValues = z.array(z.unknown()).safeParse(record.presentations);
    const presentations = presentationValues.success
      ? presentationValues.data.flatMap(presentation => {
          const result = aiPresentationBlockSchema.safeParse(presentation);
          return result.success ? [result.data] : [];
        })
      : [];

    return createAiMessageContext(attachments.success ? attachments.data : [], presentations);
  } catch {
    return createAiMessageContext();
  }
}

export function serializeAiMessageContext(context: AiMessageContextV1): string {
  return JSON.stringify(aiMessageContextV1Schema.parse(context));
}
