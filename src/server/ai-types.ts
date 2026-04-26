import { z } from 'zod';

export const aiProviderSchema = z.enum(['openrouter', 'openai', 'anthropic']);
export const aiReasoningEffortSchema = z.enum(['low', 'medium', 'high']);
export const aiAttachmentEntitySchema = z.enum([
  'user',
  'group',
  'blog',
  'amendment',
  'event',
  'todo',
  'vote',
  'election',
  'skill',
]);

export const aiChatAttachmentSchema = z.object({
  entityType: aiAttachmentEntitySchema,
  entityId: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  prompt_context: z.string().nullable().optional(),
  card_data_json: z.string().nullable().optional(),
});

export const aiModelDescriptorSchema = z.object({
  provider: aiProviderSchema,
  id: z.string().min(1),
});

export const aiChatRequestSchema = z.object({
  conversationId: z.string(),
  content: z.string().trim().min(1),
  model: aiModelDescriptorSchema,
  reasoningEffort: aiReasoningEffortSchema.default('medium'),
  skillSlug: z.string().trim().min(1).nullable().optional(),
  attachments: z.array(aiChatAttachmentSchema).default([]),
});

export const aiCredentialSaveSchema = z.object({
  provider: aiProviderSchema,
  apiKey: z.string().trim().min(1),
});

export const aiCredentialDeleteSchema = z.object({
  provider: aiProviderSchema,
});

export type AiProvider = z.infer<typeof aiProviderSchema>;
export type AiReasoningEffort = z.infer<typeof aiReasoningEffortSchema>;
export type AiAttachmentEntity = z.infer<typeof aiAttachmentEntitySchema>;
export type AiChatAttachment = z.infer<typeof aiChatAttachmentSchema>;
export type AiChatRequest = z.infer<typeof aiChatRequestSchema>;
export type AiModelDescriptor = z.infer<typeof aiModelDescriptorSchema>;
