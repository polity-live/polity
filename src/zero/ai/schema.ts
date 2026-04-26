import { z } from 'zod';
import { timestampSchema } from '../shared/helpers';

const skillSlugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9-]+$/i, 'Skill slug may only contain letters, numbers, and hyphens');

const baseAiSkillSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  slug: skillSlugSchema,
  name: z.string().trim().min(1),
  aliases: z.string().nullable(),
  system_prompt: z.string().trim().min(1),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectAiSkillSchema = baseAiSkillSchema;

export const createAiSkillSchema = baseAiSkillSchema
  .omit({ id: true, user_id: true, created_at: true, updated_at: true })
  .extend({
    id: z.string(),
    aliases: z.string().optional(),
  });

export const updateAiSkillSchema = baseAiSkillSchema
  .pick({ slug: true, name: true, aliases: true, system_prompt: true })
  .partial()
  .extend({ id: z.string() });

export const deleteAiSkillSchema = z.object({ id: z.string() });

export type AiSkill = z.infer<typeof selectAiSkillSchema>;
