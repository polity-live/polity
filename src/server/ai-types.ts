import { z } from 'zod';

import {
  aiChatAttachmentSchema,
  aiModelDescriptorSchema,
  aiProviderSchema,
  aiReasoningEffortSchema,
  aiToolNameSchema,
} from '@/lib/ai/schemas';

export {
  aiAttachmentEntitySchema,
  aiChatAttachmentSchema,
  aiModelDescriptorSchema,
  aiProviderSchema,
  aiReasoningEffortSchema,
  aiToolNameSchema,
} from '@/lib/ai/schemas';
export type {
  AiAttachmentEntity,
  AiChatAttachment,
  AiModelDescriptor,
  AiProvider,
  AiReasoningEffort,
  AiToolName,
} from '@/lib/ai/schemas';

export const aiChatRequestSchema = z.object({
  conversationId: z.string(),
  content: z.string().trim().min(1),
  model: aiModelDescriptorSchema,
  reasoningEffort: aiReasoningEffortSchema.default('medium'),
  skillSlugs: z.array(z.string().trim().min(1)).default([]),
  toolNames: z.array(aiToolNameSchema).default([]),
  attachments: z.array(aiChatAttachmentSchema).default([]),
  timeZone: z.string().trim().min(1).default('UTC'),
});

export const aiCredentialSaveSchema = z.object({
  provider: aiProviderSchema,
  apiKey: z.string().trim().min(1),
});

export const aiCredentialDeleteSchema = z.object({
  provider: aiProviderSchema,
});

export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;
