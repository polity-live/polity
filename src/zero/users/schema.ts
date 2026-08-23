import { z } from 'zod';
import { jsonSchema, timestampSchema } from '../shared/helpers';
import {
  hasExclusiveUserPrimaryMedia,
  primaryMediaValidationMessage,
} from '../shared/primaryMedia';

export const userGenderSchema = z.enum(['male', 'female', 'diverse']);

// ── user ──────────────────────────────────────────────────────────────
const userBaseSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  contact_email: z.string().nullable(),
  handle: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  bio: z.string().nullable(),
  gender: userGenderSchema.nullable(),
  about: jsonSchema.nullable(),
  avatar: z.string().nullable(),
  video_url: z.string().nullable(),
  x: z.string().nullable(),
  youtube: z.string().nullable(),
  linkedin: z.string().nullable(),
  website: z.string().nullable(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  twitter: z.string().nullable(),
  facebook: z.string().nullable(),
  snapchat: z.string().nullable(),
  tiktok: z.string().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  post_code: z.string().nullable(),
  city: z.string().nullable(),
  street: z.string().nullable(),
  house_number: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  location_kind: z.string().nullable().optional(),
  location_place_id: z.string().nullable().optional(),
  location_boundary_source: z.string().nullable().optional(),
  location_geometry: jsonSchema.nullable().optional(),
  location_bounds: jsonSchema.nullable().optional(),
  visibility: z.string(),
  subscriber_count: z.number(),
  amendment_count: z.number(),
  group_count: z.number(),
  tutorial_step: z.number().nullable(),
  assistant_introduction: z.boolean().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const userSelectSchema = userBaseSchema;
export const userCreateSchema = userBaseSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    subscriber_count: true,
    amendment_count: true,
    group_count: true,
  })
  .extend({ id: z.string(), gender: userGenderSchema.nullable().optional() })
  .refine(hasExclusiveUserPrimaryMedia, {
    message: primaryMediaValidationMessage,
    path: ['video_url'],
  });
export const userUpdateSchema = userBaseSchema
  .pick({
    first_name: true,
    last_name: true,
    contact_email: true,
    bio: true,
    gender: true,
    whatsapp: true,
    instagram: true,
    twitter: true,
    facebook: true,
    snapchat: true,
    tiktok: true,
    about: true,
    avatar: true,
    video_url: true,
    handle: true,
    x: true,
    youtube: true,
    linkedin: true,
    website: true,
    country: true,
    region: true,
    post_code: true,
    city: true,
    street: true,
    house_number: true,
    latitude: true,
    longitude: true,
    location_kind: true,
    location_place_id: true,
    location_boundary_source: true,
    location_geometry: true,
    location_bounds: true,
    visibility: true,
    tutorial_step: true,
    assistant_introduction: true,
  })
  .partial()
  .extend({ id: z.string().optional() })
  .refine(hasExclusiveUserPrimaryMedia, {
    message: primaryMediaValidationMessage,
    path: ['video_url'],
  });
export const userDeleteSchema = z.object({ id: z.string() });
export type User = z.infer<typeof userSelectSchema>;

// ── file ──────────────────────────────────────────────────────────────
const fileBaseSchema = z.object({
  id: z.string(),
  path: z.string().nullable(),
  url: z.string().nullable(),
  created_at: timestampSchema,
});

export const fileSelectSchema = fileBaseSchema;
export type File = z.infer<typeof fileSelectSchema>;
