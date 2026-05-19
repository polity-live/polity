import { table, string, number, boolean, json, type ReadonlyJSONValue } from '@rocicorp/zero';

export const group = table('group')
  .columns({
    id: string(),
    name: string().optional(),
    description: json<ReadonlyJSONValue>().optional(),
    email: string().optional(),
    country: string().optional(),
    region: string().optional(),
    post_code: string().optional(),
    city: string().optional(),
    street: string().optional(),
    house_number: string().optional(),
    latitude: number().optional(),
    longitude: number().optional(),
    image_url: string().optional(),
    member_count: number(),
    subscriber_count: number(),
    event_count: number(),
    amendment_count: number(),
    document_count: number(),
    x: string().optional(),
    youtube: string().optional(),
    linkedin: string().optional(),
    website: string().optional(),
    whatsapp: string().optional(),
    instagram: string().optional(),
    twitter: string().optional(),
    facebook: string().optional(),
    snapchat: string().optional(),
    tiktok: string().optional(),
    visibility: string(),
    group_type: string(),
    owner_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupMembership = table('group_membership')
  .columns({
    id: string(),
    group_id: string(),
    user_id: string(),
    status: string().optional(),
    visibility: string(),
    source: string(),
    source_group_id: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const groupMembershipRole = table('group_membership_role')
  .columns({
    id: string(),
    group_membership_id: string(),
    role_id: string(),
    assigned_at: number(),
    assigned_by_id: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const role = table('role')
  .columns({
    id: string(),
    name: string().optional(),
    description: string().optional(),
    scope: string().optional(),
    group_id: string().optional(),
    event_id: string().optional(),
    amendment_id: string().optional(),
    blog_id: string().optional(),
    assignment_mode: string(),
    visibility: string(),
    term_start_date: number().optional(),
    is_recurring: boolean(),
    recurrence_pattern: string().optional(),
    recurrence_rule: string().optional(),
    recurrence_interval: number().optional(),
    recurrence_days: json<ReadonlyJSONValue>().optional(),
    recurrence_end_date: number().optional(),
    scheduled_revote_date: number().optional(),
    default_request_role: boolean(),
    default_invite_role: boolean(),
    sort_order: number(),
    created_at: number(),
  })
  .primaryKey('id');

export const roleHolderHistory = table('role_holder_history')
  .columns({
    id: string(),
    role_id: string(),
    user_id: string(),
    start_date: number().optional(),
    end_date: number().optional(),
    reason: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const actionRight = table('action_right')
  .columns({
    id: string(),
    resource: string().optional(),
    action: string().optional(),
    role_id: string(),
    group_id: string().optional(),
    event_id: string().optional(),
    amendment_id: string().optional(),
    blog_id: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');
