import { table, string, number, boolean, json } from '@rocicorp/zero';
import type { MutableJSONValue } from '../shared/helpers';

export const group = table('group')
  .columns({
    id: string(),
    name: string().optional(),
    description: json<MutableJSONValue>().optional(),
    email: string().optional(),
    country: string().optional(),
    region: string().optional(),
    post_code: string().optional(),
    city: string().optional(),
    street: string().optional(),
    house_number: string().optional(),
    latitude: number().optional(),
    longitude: number().optional(),
    location_kind: string().optional(),
    location_place_id: string().optional(),
    location_boundary_source: string().optional(),
    location_geometry: json<MutableJSONValue>().optional(),
    location_bounds: json<MutableJSONValue>().optional(),
    image_url: string().optional(),
    video_url: string().optional(),
    member_count: number(),
    subscriber_count: number(),
    event_count: number(),
    amendment_count: number(),
    document_count: number(),
    group_type: string().optional(),
    has_hierarchy_children: boolean().optional(),
    has_sibling_connections: boolean().optional(),
    connected_group_id: string().optional(),
    primary_sibling_membership_mode: string().optional(),
    sibling_membership_mode: string().optional(),
    sibling_role_id: string().optional(),
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
    origin_kind: string().optional(),
    connection_id: string().optional(),
    membership_rule_id: string().optional(),
    part_group_id: string().optional(),
    base_group_id: string().optional(),
    is_auto_managed: boolean().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const groupMembershipOrigin = table('group_membership_origin')
  .columns({
    id: string(),
    group_membership_id: string(),
    origin_kind: string(),
    source_group_id: string().optional(),
    source_membership_id: string().optional(),
    connection_id: string().optional(),
    membership_rule_id: string().optional(),
    source_role_id: string().optional(),
    part_group_id: string().optional(),
    base_group_id: string().optional(),
    depth: number(),
    path_group_ids: json<MutableJSONValue>(),
    created_at: number(),
  })
  .primaryKey('id');

export const groupOfflineMember = table('group_offline_member')
  .columns({
    id: string(),
    group_id: string(),
    first_name: string(),
    last_name: string(),
    reason_not_signed_up: string().optional(),
    connected_user_id: string().optional(),
    created_by_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupOfflineMembership = table('group_offline_membership')
  .columns({
    id: string(),
    group_offline_member_id: string(),
    group_id: string(),
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

export const groupOfflineMembershipRole = table('group_offline_membership_role')
  .columns({
    id: string(),
    group_offline_membership_id: string(),
    role_id: string(),
    assigned_at: number(),
    assigned_by_id: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const groupGuestAccess = table('group_guest_access')
  .columns({
    id: string(),
    group_id: string(),
    user_id: string(),
    status: string(),
    invited_by_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupGuestRole = table('group_guest_role')
  .columns({
    id: string(),
    group_guest_access_id: string(),
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
    recurrence_days: json<MutableJSONValue>().optional(),
    recurrence_end_date: number().optional(),
    scheduled_revote_date: number().optional(),
    default_request_role: boolean(),
    default_invite_role: boolean(),
    assignee_kind: string(),
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
