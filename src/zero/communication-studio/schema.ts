import { z } from 'zod';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
export const createStudioProjectSchema = z.object({
  groupId: z.string().uuid().nullable(),
  visibility: z.enum(['public', 'authenticated', 'private']).default('private'),
  title: z.string().trim().min(1).max(200),
  kind: studioDocumentV3Schema.shape.kind,
  themeId: z.string().uuid(),
  themeMode: z.enum(['light', 'dark']),
  template: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('builtin'),
      id: z.enum(['announcement', 'explanation', 'checklist', 'invitation', 'quote', 'blank']),
    }),
    z.object({ kind: z.literal('project'), id: z.string().uuid() }),
  ]),
  campaign: z
    .object({
      weeks: z.number().int().min(1).max(12),
      core: z.number().int().min(1).max(3),
      stories: z.number().int().min(0).max(3),
    })
    .default({ weeks: 4, core: 3, stories: 2 }),
});
export const exportStudioSchema = z.object({
  projectId: z.string().uuid(),
  format: z.enum(['png', 'pdf', 'pptx', 'canva', 'mp4', 'xlsx', 'zip']),
  pageIds: z.array(z.string().uuid()).max(300).default([]),
  revision: z.number().int().nonnegative(),
});
export const studioProjectSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  group_id: z.string().uuid().nullable(),
  title: z.string().max(200),
  kind: studioDocumentV3Schema.shape.kind,
  visibility: z.enum(['public', 'authenticated', 'private']),
  is_template: z.boolean(),
  version: z.number().int(),
  document_schema_version: z.literal(5),
  created_at: z.number(),
  updated_at: z.number(),
});
