import { table, string, number, boolean, json } from '@rocicorp/zero';
import type { NetworkLinkRightSnapshot } from './request-types';

export const follow = table('follow')
  .columns({
    id: string(),
    follower_id: string(),
    followee_id: string(),
    created_at: number(),
  })
  .primaryKey('id');

export const networkLink = table('network_link')
  .columns({
    id: string(),
    source_group_id: string(),
    target_group_id: string(),
    structural_relation: string(),
    status: string(),
    created_by_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const networkLinkRight = table('network_link_right')
  .columns({
    id: string(),
    network_link_id: string(),
    right_key: string(),
    direction: string(),
    status: string(),
    initiator_group_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const networkLinkMembershipRule = table('network_link_membership_rule')
  .columns({
    id: string(),
    network_link_id: string(),
    membership_direction: string().optional(),
    membership_mode: string(),
    role_id: string().optional(),
    source_group_ids: json<string[]>().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const networkLinkChangeRequest = table('network_link_change_request')
  .columns({
    id: string(),
    active_network_link_id: string().optional(),
    proposed_network_link_id: string(),
    source_group_id: string(),
    target_group_id: string(),
    structural_relation: string(),
    status: string(),
    initiator_group_id: string(),
    desired_rights: json<readonly NetworkLinkRightSnapshot[]>(),
    desired_membership_direction: string().optional(),
    desired_membership_mode: string(),
    desired_role_id: string().optional(),
    desired_source_group_ids: json<string[]>().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const subscriber = table('subscriber')
  .columns({
    id: string(),
    subscriber_id: string(),
    user_id: string().optional(),
    group_id: string().optional(),
    amendment_id: string().optional(),
    event_id: string().optional(),
    blog_id: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const groupWorkflow = table('group_workflow')
  .columns({
    id: string(),
    group_id: string(),
    start_group_id: string().optional(),
    name: string().optional(),
    description: string().optional(),
    is_default_entry: boolean(),
    status: string().optional(),
    created_by_id: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupWorkflowStep = table('group_workflow_step')
  .columns({
    id: string(),
    workflow_id: string(),
    group_id: string(),
    order_index: number(),
    label: string().optional(),
    step_kind: string(),
    selection_mode: string(),
    merge_strategy: string().optional(),
    event_rule: string().optional(),
    auto_task_on_missing_event: boolean(),
    target_workflow_id: string().optional(),
    created_at: number(),
  })
  .primaryKey('id');

export const groupWorkflowApproval = table('group_workflow_approval')
  .columns({
    id: string(),
    workflow_id: string(),
    group_id: string(),
    requested_by_group_id: string(),
    status: string(),
    responded_at: number().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');
