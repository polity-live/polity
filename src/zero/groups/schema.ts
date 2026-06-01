import { z } from 'zod';
import {
  jsonNumberArraySchema,
  jsonSchema,
  nullableTimestampSchema,
  timestampSchema,
} from '../shared/helpers';

const groupTypeSchema = z.enum(['base', 'hierarchical', 'sibling']);
const groupSiblingMembershipModeSchema = z.enum(['open', 'elected', 'parliament']);
const roleAssigneeKindSchema = z.enum(['member', 'guest']);
const groupGuestStatusSchema = z.enum(['invited', 'active', 'revoked']);

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
  connected_group_id: z.string().nullable(),
  sibling_membership_mode: groupSiblingMembershipModeSchema.nullable(),
  sibling_role_id: z.string().nullable(),
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
  .extend({
    id: z.string(),
    connected_group_id: z.string().nullable().optional(),
    sibling_membership_mode: groupSiblingMembershipModeSchema.nullable().optional(),
    sibling_role_id: z.string().nullable().optional(),
    parliament_source_group_ids: z.array(z.string()).optional(),
  });
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
    connected_group_id: true,
    sibling_membership_mode: true,
    sibling_role_id: true,
  })
  .partial()
  .extend({
    id: z.string(),
    parliament_source_group_ids: z.array(z.string()).optional(),
  });
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

// ── group_offline_member ─────────────────────────────────────────────
const groupOfflineMemberBaseSchema = z.object({
  id: z.string(),
  group_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  reason_not_signed_up: z.string().nullable(),
  connected_user_id: z.string().nullable(),
  created_by_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const groupOfflineMemberSelectSchema = groupOfflineMemberBaseSchema;
export const groupOfflineMemberCreateSchema = groupOfflineMemberBaseSchema
  .omit({ created_by_id: true, created_at: true, updated_at: true })
  .extend({ id: z.string(), debug_correlation_id: z.string().optional() });
export const groupOfflineMemberUpdateSchema = groupOfflineMemberBaseSchema
  .pick({
    first_name: true,
    last_name: true,
    reason_not_signed_up: true,
    connected_user_id: true,
  })
  .partial()
  .extend({ id: z.string(), debug_correlation_id: z.string().optional() });
export const groupOfflineMemberDeleteSchema = z.object({
  id: z.string(),
  debug_correlation_id: z.string().optional(),
});
export const groupOfflineMemberBulkImportSchema = z.object({
  group_id: z.string(),
  entries: z.array(
    z.object({
      first_name: z.string(),
      last_name: z.string(),
      reason_not_signed_up: z.string().nullable().optional(),
    })
  ),
  debug_correlation_id: z.string().optional(),
});
export type GroupOfflineMember = z.infer<typeof groupOfflineMemberSelectSchema>;

// ── group_offline_membership ────────────────────────────────────────
const groupOfflineMembershipBaseSchema = z.object({
  id: z.string(),
  group_offline_member_id: z.string(),
  group_id: z.string(),
  status: z.string().nullable(),
  visibility: z.string(),
  source: z.string(),
  source_group_id: z.string().nullable(),
  created_at: timestampSchema,
});

export const groupOfflineMembershipSelectSchema = groupOfflineMembershipBaseSchema;
export const groupOfflineMembershipCreateSchema = groupOfflineMembershipBaseSchema
  .omit({ created_at: true })
  .extend({
    id: z.string(),
    status: z.string().nullable().optional(),
    visibility: z.string().optional(),
    source: z.string().optional(),
    source_group_id: z.string().nullable().optional(),
  });
export const groupOfflineMembershipUpdateSchema = groupOfflineMembershipBaseSchema
  .pick({ status: true, visibility: true, source: true, source_group_id: true })
  .partial()
  .extend({ id: z.string() });
export const groupOfflineMembershipDeleteSchema = z.object({ id: z.string() });
export type GroupOfflineMembership = z.infer<typeof groupOfflineMembershipSelectSchema>;

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

// ── group_offline_membership_role ───────────────────────────────────
const groupOfflineMembershipRoleBaseSchema = z.object({
  id: z.string(),
  group_offline_membership_id: z.string(),
  role_id: z.string(),
  assigned_at: timestampSchema,
  assigned_by_id: z.string().nullable(),
  created_at: timestampSchema,
});

export const groupOfflineMembershipRoleSelectSchema = groupOfflineMembershipRoleBaseSchema;
export const groupOfflineMembershipRoleCreateSchema = groupOfflineMembershipRoleBaseSchema
  .omit({ id: true, assigned_at: true, created_at: true })
  .extend({
    id: z.string(),
    assigned_at: nullableTimestampSchema.optional(),
    assigned_by_id: z.string().nullable().optional(),
  });
export const groupOfflineMembershipRoleAssignSchema = z.object({
  group_offline_membership_id: z.string(),
  role_id: z.string(),
  assigned_by_id: z.string().nullable().optional(),
});
export const groupOfflineMembershipRoleUnassignSchema = z.object({
  group_offline_membership_id: z.string(),
  role_id: z.string(),
});
export const groupOfflineMembershipRolesSyncSchema = z.object({
  group_offline_membership_id: z.string(),
  role_ids: z.array(z.string()),
  assigned_by_id: z.string().nullable().optional(),
});
export const groupOfflineMembershipRoleDeleteSchema = z.object({ id: z.string() });
export type GroupOfflineMembershipRole = z.infer<typeof groupOfflineMembershipRoleSelectSchema>;

// ── group_guest_access ─────────────────────────────────────────────
const groupGuestAccessBaseSchema = z.object({
  id: z.string(),
  group_id: z.string(),
  user_id: z.string(),
  status: groupGuestStatusSchema,
  invited_by_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const groupGuestAccessSelectSchema = groupGuestAccessBaseSchema;
export const groupGuestAccessCreateSchema = groupGuestAccessBaseSchema
  .omit({ created_at: true, updated_at: true, invited_by_id: true })
  .extend({
    id: z.string(),
    invited_by_id: z.string().nullable().optional(),
    role_ids: z.array(z.string()).min(1).optional(),
  });
export const groupGuestAccessUpdateSchema = groupGuestAccessBaseSchema
  .pick({ status: true })
  .partial()
  .extend({ id: z.string() });
export const groupGuestAccessAcceptSchema = z.object({ id: z.string() });
export const groupGuestAccessDeleteSchema = z.object({ id: z.string() });
export type GroupGuestAccess = z.infer<typeof groupGuestAccessSelectSchema>;

// ── group_guest_role ───────────────────────────────────────────────
const groupGuestRoleBaseSchema = z.object({
  id: z.string(),
  group_guest_access_id: z.string(),
  role_id: z.string(),
  assigned_at: timestampSchema,
  assigned_by_id: z.string().nullable(),
  created_at: timestampSchema,
});

export const groupGuestRoleSelectSchema = groupGuestRoleBaseSchema;
export const groupGuestRoleCreateSchema = groupGuestRoleBaseSchema
  .omit({ id: true, assigned_at: true, created_at: true })
  .extend({
    id: z.string(),
    assigned_at: nullableTimestampSchema.optional(),
    assigned_by_id: z.string().nullable().optional(),
  });
export const groupGuestRoleAssignSchema = z.object({
  group_guest_access_id: z.string(),
  role_id: z.string(),
  assigned_by_id: z.string().nullable().optional(),
});
export const groupGuestRoleUnassignSchema = z.object({
  group_guest_access_id: z.string(),
  role_id: z.string(),
});
export const groupGuestRolesSyncSchema = z.object({
  group_guest_access_id: z.string(),
  role_ids: z.array(z.string()),
  assigned_by_id: z.string().nullable().optional(),
});
export const groupGuestRoleDeleteSchema = z.object({ id: z.string() });
export type GroupGuestRole = z.infer<typeof groupGuestRoleSelectSchema>;

// ── group_sibling_source ───────────────────────────────────────────
const groupSiblingSourceBaseSchema = z.object({
  id: z.string(),
  group_id: z.string(),
  source_group_id: z.string(),
  created_at: timestampSchema,
});

export const groupSiblingSourceSelectSchema = groupSiblingSourceBaseSchema;
export const groupSiblingSourceCreateSchema = groupSiblingSourceBaseSchema
  .omit({ id: true, created_at: true })
  .extend({ id: z.string() });
export const groupSiblingSourceDeleteSchema = z.object({ id: z.string() });
export const groupSiblingSourceSyncSchema = z.object({
  group_id: z.string(),
  source_group_ids: z.array(z.string()),
});
export type GroupSiblingSource = z.infer<typeof groupSiblingSourceSelectSchema>;

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
  assignee_kind: roleAssigneeKindSchema,
  sort_order: z.number(),
  created_at: timestampSchema,
});

export const roleSelectSchema = roleBaseSchema;
export const roleCreateSchema = roleBaseSchema
  .omit({ id: true, created_at: true })
  .partial()
  .extend({
    id: z.string(),
    assignment_mode: z.enum(['assigned', 'elected']).optional(),
    visibility: z.string().optional(),
    is_recurring: z.boolean().optional(),
    default_request_role: z.boolean().optional(),
    default_invite_role: z.boolean().optional(),
    assignee_kind: roleAssigneeKindSchema.optional(),
    sort_order: z.number().optional(),
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
    assignee_kind: true,
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
