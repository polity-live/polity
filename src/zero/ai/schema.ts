import { z } from 'zod';
import { timestampSchema } from '../shared/helpers';
import { DEFAULT_AI_TOOL_NAMES } from '../../lib/ai/defaultAiTools';

const skillSlugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9-]+$/i, 'Skill slug may only contain letters, numbers, and hyphens');

const toolNameSchema = z.enum(DEFAULT_AI_TOOL_NAMES);

const baseAiSkillSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  slug: skillSlugSchema,
  name: z.string().trim().min(1),
  aliases: z.string().nullable(),
  system_prompt: z.string().trim().min(1),
  enabled: z.boolean(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectAiSkillSchema = baseAiSkillSchema;

export const createAiSkillSchema = baseAiSkillSchema
  .omit({ id: true, user_id: true, created_at: true, updated_at: true })
  .extend({
    id: z.string(),
    aliases: z.string().optional(),
    enabled: z.boolean().optional(),
  });

export const updateAiSkillSchema = baseAiSkillSchema
  .pick({ slug: true, name: true, aliases: true, system_prompt: true, enabled: true })
  .partial()
  .extend({ id: z.string() });

export const deleteAiSkillSchema = z.object({ id: z.string() });

const baseAiToolSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  tool_name: toolNameSchema,
  enabled: z.boolean(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectAiToolSchema = baseAiToolSchema;

export const createAiToolSchema = baseAiToolSchema
  .omit({ id: true, user_id: true, created_at: true, updated_at: true })
  .extend({
    id: z.string(),
    enabled: z.boolean().optional(),
  });

export const updateAiToolSchema = baseAiToolSchema
  .pick({ tool_name: true, enabled: true })
  .partial()
  .extend({ id: z.string() });

export type AiSkill = z.infer<typeof selectAiSkillSchema>;
export type AiTool = z.infer<typeof selectAiToolSchema>;
