import { z } from 'zod';
import { DEFAULT_AI_TOOL_NAMES } from '@/lib/ai/defaultAiTools';

export const aiProviderSchema = z.enum(['openrouter', 'openai', 'anthropic']);
export const aiReasoningEffortSchema = z.enum(['low', 'medium', 'high']);
export const aiToolNameSchema = z.enum(DEFAULT_AI_TOOL_NAMES);
export const aiAttachmentEntitySchema = z.enum([
  'user',
  'group',
  'statement',
  'blog',
  'amendment',
  'event',
  'todo',
  'vote',
  'election',
  'election_candidate',
  'role',
  'payment',
  'link',
  'document',
  'agenda_item',
  'skill',
]);

export const aiChatAttachmentSchema = z.object({
  entityType: aiAttachmentEntitySchema,
  entityId: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  prompt_context: z.string().nullable().optional(),
  card_data_json: z.string().nullable().optional(),
  href: z
    .string()
    .regex(/^\/(?!\/)/)
    .nullable()
    .optional(),
});

export const aiModelDescriptorSchema = z.object({
  provider: aiProviderSchema,
  id: z.string().min(1),
});

export type AiProvider = z.infer<typeof aiProviderSchema>;
export type AiReasoningEffort = z.infer<typeof aiReasoningEffortSchema>;
export type AiToolName = z.infer<typeof aiToolNameSchema>;
export type AiAttachmentEntity = z.infer<typeof aiAttachmentEntitySchema>;
export type AiChatAttachment = z.infer<typeof aiChatAttachmentSchema>;
export type AiModelDescriptor = z.infer<typeof aiModelDescriptorSchema>;
