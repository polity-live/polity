import { z } from 'zod';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { timestampSchema, jsonSchema } from '../shared/helpers';
import { createTimelineEventSchema } from '../common/schema';
import { hasExclusivePrimaryMedia, primaryMediaValidationMessage } from '../shared/primaryMedia';

// ============================================
// Blog Zod Schemas
// ============================================

const baseBlogSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  content: jsonSchema.nullable(),
  date: z.string().nullable(),
  image_url: z.string().nullable(),
  video_url: z.string().nullable(),
  visibility: z.string(),
  subscriber_count: z.number(),
  supporter_count: z.number(),
  like_count: z.number(),
  comment_count: z.number(),
  upvotes: z.number(),
  downvotes: z.number(),
  editing_mode: z.string().nullable(),
  discussions: jsonSchema.nullable(),
  group_id: z.string().nullable(),
  updated_at: timestampSchema,
  created_at: timestampSchema,
});

export const selectBlogSchema = baseBlogSchema;

export const createBlogSchema = baseBlogSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    subscriber_count: true,
    supporter_count: true,
  })
  .extend({ id: z.string() })
  .refine(hasExclusivePrimaryMedia, {
    message: primaryMediaValidationMessage,
    path: ['video_url'],
  });

export const createBlogFullSchema = z.object({
  blog: createBlogSchema,
  hashtags: z.array(z.string()).optional(),
  timeline_event: createTimelineEventSchema.nullable().optional(),
});

export const updateBlogSchema = baseBlogSchema
  .pick({
    title: true,
    description: true,
    content: true,
    date: true,
    image_url: true,
    video_url: true,
    visibility: true,
    editing_mode: true,
    discussions: true,
    upvotes: true,
    downvotes: true,
  })
  .partial()
  .extend({ id: z.string() })
  .refine(hasExclusivePrimaryMedia, {
    message: primaryMediaValidationMessage,
    path: ['video_url'],
  });

export const deleteBlogSchema = z.object({ id: z.string() });

// ============================================
// BlogBlogger Zod Schemas
// ============================================

const baseBlogBloggerSchema = z.object({
  id: z.string(),
  blog_id: z.string(),
  user_id: z.string(),
  role_id: z.string().nullable(),
  status: z.string().nullable(),
  visibility: z.string().nullable(),
  created_at: timestampSchema,
});

export const selectBlogBloggerSchema = baseBlogBloggerSchema;

export const createBlogBloggerSchema = baseBlogBloggerSchema
  .omit({ id: true, created_at: true })
  .extend({ id: z.string() });

export const updateBlogBloggerSchema = baseBlogBloggerSchema
  .pick({ role_id: true, status: true, visibility: true })
  .partial()
  .extend({ id: z.string() });

export const deleteBlogBloggerSchema = z.object({ id: z.string() });

// ============================================
// Inferred Types
// ============================================

export type Blog = z.infer<typeof selectBlogSchema>;
export type BlogFullCreateInput = z.infer<typeof createBlogFullSchema>;
export const createBlogFullMutatorSchema = createBlogFullSchema as StandardSchemaV1<
  BlogFullCreateInput,
  BlogFullCreateInput
>;
export type BlogBlogger = z.infer<typeof selectBlogBloggerSchema>;
