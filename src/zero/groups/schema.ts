import { z } from 'zod';
import {
  jsonNumberArraySchema,
  jsonSchema,
  nullableTimestampSchema,
  timestampSchema,
} from '../shared/helpers';

const groupTypeSchema = z.enum(['base', 'hierarchical']);

// ── group ─────────────────────────────────────────────────────────────
const groupBaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  description: jsonSchema.nullable(),
  email: z.string().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  post_code: z.string().nullable(),
  city: z.string().nullable(),
  street: z.string().nullable(),
  house_number: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  image_url: z.string().nullable(),
  member_count: z.number(),
  subscriber_count: z.number(),
  event_count: z.number(),
  amendment_count: z.number(),
  document_count: z.number(),
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
  visibility: z.string(),
  group_type: groupTypeSchema,
  owner_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const groupSelectSchema = groupBaseSchema;
export const groupCreateSchema = groupBaseSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    member_count: true,
    subscriber_count: true,
    event_count: true,
    amendment_count: true,
    document_count: true,
  })
  .extend({ id: z.string() });
export const groupUpdateSchema = groupBaseSchema
  .pick({
    name: true,
    description: true,
    email: true,
    country: true,
    region: true,
    whatsapp: true,
    instagram: true,
    twitter: true,
    facebook: true,
    snapchat: true,
    tiktok: true,
    post_code: true,
    city: true,
    street: true,
    house_number: true,
    latitude: true,
    longitude: true,
    image_url: true,
    x: true,
    youtube: true,
    linkedin: true,
    website: true,
    visibility: true,
    group_type: true,
  })
  .partial()
  .extend({ id: z.string() });
export const groupDeleteSchema = z.object({ id: z.string() });
export type Group = z.infer<typeof groupSelectSchema>;

// ── group_membership ──────────────────────────────────────────────────
const groupMembershipBaseSchema = z.object({
  id: z.string(),
  group_id: z.string(),
  user_id: z.string(),
  status: z.string().nullable(),
  visibility: z.string(),
  source: z.string(),
  source_group_id: z.string().nullable(),
  created_at: timestampSchema,
});

export const groupMembershipSelectSchema = groupMembershipBaseSchema;
export const groupMembershipCreateSchema = groupMembershipBaseSchema
  .omit({ id: true, created_at: true, user_id: true, source: true, source_group_id: true })
  .extend({
    id: z.string(),
    user_id: z.string().optional(),
    source: z.string().optional(),
    source_group_id: z.string().nullable().optional(),
    initial_role_id: z.string().nullable().optional(),
  });
export const groupMembershipUpdateSchema = groupMembershipBaseSchema
  .pick({ status: true, visibility: true, source: true, source_group_id: true })
  .partial()
  .extend({ id: z.string() });
export const groupMembershipLegacyRoleUpdateSchema = groupMembershipUpdateSchema.extend({
  role_id: z.string().nullable().optional(),
});
export const groupMembershipDeleteSchema = z.object({ id: z.string() });
export type GroupMembership = z.infer<typeof groupMembershipSelectSchema>;

// ── group_membership_role ────────────────────────────────────────────
const groupMembershipRoleBaseSchema = z.object({
  id: z.string(),
  group_membership_id: z.string(),
  role_id: z.string(),
  assigned_at: timestampSchema,
  assigned_by_id: z.string().nullable(),
  created_at: timestampSchema,
});

export const groupMembershipRoleSelectSchema = groupMembershipRoleBaseSchema;
export const groupMembershipRoleCreateSchema = groupMembershipRoleBaseSchema
  .omit({ id: true, assigned_at: true, created_at: true })
  .extend({
    id: z.string(),
    assigned_at: nullableTimestampSchema.optional(),
    assigned_by_id: z.string().nullable().optional(),
  });
export const groupMembershipRoleAssignSchema = z.object({
  group_membership_id: z.string(),
  role_id: z.string(),
  assigned_by_id: z.string().nullable().optional(),
});
export const groupMembershipRoleUnassignSchema = z.object({
  group_membership_id: z.string(),
  role_id: z.string(),
});
export const groupMembershipRolesSyncSchema = z.object({
  group_membership_id: z.string(),
  role_ids: z.array(z.string()),
  assigned_by_id: z.string().nullable().optional(),
});
export const groupMembershipRoleDeleteSchema = z.object({ id: z.string() });
export type GroupMembershipRole = z.infer<typeof groupMembershipRoleSelectSchema>;

// ── role ──────────────────────────────────────────────────────────────
const roleBaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  scope: z.string().nullable(),
  group_id: z.string().nullable(),
  event_id: z.string().nullable(),
  amendment_id: z.string().nullable(),
  blog_id: z.string().nullable(),
  assignment_mode: z.enum(['assigned', 'elected']),
  visibility: z.string(),
  term_start_date: nullableTimestampSchema,
  is_recurring: z.boolean(),
  recurrence_pattern: z.string().nullable(),
  recurrence_rule: z.string().nullable(),
  recurrence_interval: z.number().nullable(),
  recurrence_days: jsonNumberArraySchema.nullable(),
  recurrence_end_date: nullableTimestampSchema,
  scheduled_revote_date: nullableTimestampSchema,
  default_request_role: z.boolean(),
  default_invite_role: z.boolean(),
  sort_order: z.number(),
  created_at: timestampSchema,
});

export const roleSelectSchema = roleBaseSchema;
export const roleCreateSchema = roleBaseSchema.omit({ id: true, created_at: true }).extend({
  id: z.string(),
  default_request_role: z.boolean().optional(),
  default_invite_role: z.boolean().optional(),
});
export const roleUpdateSchema = roleBaseSchema
  .pick({
    name: true,
    description: true,
    assignment_mode: true,
    visibility: true,
    term_start_date: true,
    is_recurring: true,
    recurrence_pattern: true,
    recurrence_rule: true,
    recurrence_interval: true,
    recurrence_days: true,
    recurrence_end_date: true,
    scheduled_revote_date: true,
    default_request_role: true,
    default_invite_role: true,
    sort_order: true,
  })
  .partial()
  .extend({ id: z.string() });
export const roleDeleteSchema = z.object({ id: z.string() });
export type Role = z.infer<typeof roleSelectSchema>;

// ── role_holder_history ─────────────────────────────────────────────
const roleHolderHistoryBaseSchema = z.object({
  id: z.string(),
  role_id: z.string(),
  user_id: z.string(),
  start_date: nullableTimestampSchema,
  end_date: nullableTimestampSchema,
  reason: z.string().nullable(),
  created_at: timestampSchema,
});

export const roleHolderHistorySelectSchema = roleHolderHistoryBaseSchema;
export const roleHolderHistoryCreateSchema = roleHolderHistoryBaseSchema
  .omit({ id: true, created_at: true })
  .extend({ id: z.string(), start_date: z.number() });
export const roleHolderHistoryUpdateSchema = z.object({
  id: z.string(),
  end_date: z.number().optional(),
  reason: z.string().optional(),
});
export type RoleHolderHistory = z.infer<typeof roleHolderHistorySelectSchema>;

// ── action_right ──────────────────────────────────────────────────────
const actionRightBaseSchema = z.object({
  id: z.string(),
  resource: z.string().nullable(),
  action: z.string().nullable(),
  role_id: z.string(),
  group_id: z.string().nullable(),
  event_id: z.string().nullable(),
  amendment_id: z.string().nullable(),
  blog_id: z.string().nullable(),
  created_at: timestampSchema,
});

export const actionRightSelectSchema = actionRightBaseSchema;
export const actionRightCreateSchema = actionRightBaseSchema
  .omit({ id: true, created_at: true })
  .extend({ id: z.string() });
export const actionRightDeleteSchema = z.object({ id: z.string() });
export type ActionRight = z.infer<typeof actionRightSelectSchema>;
