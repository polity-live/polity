import { z } from 'zod';
import { documentSchema } from '@/features/communication-studio/logic/document';
export const createStudioProjectSchema = z.object({
  groupId: z.string().uuid().nullable(),
  document: documentSchema,
});
export const exportStudioSchema = z.object({
  projectId: z.string().uuid(),
  format: z.enum(['png', 'pdf', 'pptx', 'canva', 'mp4', 'xlsx', 'zip']),
  pageIds: z.array(z.string().uuid()).max(300).default([]),
  state: z.string().max(16000000),
});
export const studioProjectSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  group_id: z.string().uuid().nullable(),
  title: z.string().max(200),
  kind: documentSchema.shape.kind,
  is_template: z.boolean(),
  version: z.number().int(),
  created_at: z.number(),
  updated_at: z.number(),
});
