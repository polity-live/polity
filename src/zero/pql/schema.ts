import { z } from 'zod';
import { timestampSchema } from '../shared/helpers';

const basePqlFilterSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  group_id: z.string().nullable(),
  storage_key: z.string(),
  label: z.string().min(1),
  query: z.string().min(1),
  is_active: z.boolean(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectPqlFilterSchema = basePqlFilterSchema;

export const createPqlFilterSchema = basePqlFilterSchema
  .omit({ user_id: true, created_at: true, updated_at: true })
  .extend({
    group_id: z.string().nullable().optional(),
  });

export const updatePqlFilterSchema = z.object({
  id: z.string(),
  label: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
});

export const deletePqlFilterSchema = z.object({
  id: z.string(),
});

export type StoredPqlFilter = z.infer<typeof selectPqlFilterSchema>;
export type CreatePqlFilter = z.infer<typeof createPqlFilterSchema>;
export type UpdatePqlFilter = z.infer<typeof updatePqlFilterSchema>;
