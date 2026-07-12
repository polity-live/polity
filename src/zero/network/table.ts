import { table, string, number, boolean, json } from '@rocicorp/zero';
import type { MutableJSONValue } from '../shared/helpers';

export const follow = table('follow')
  .columns({
    id: string(),
    follower_id: string(),
    followee_id: string(),
    created_at: number(),
  })
  .primaryKey('id');

export const groupConnection = table('group_connection')
  .columns({
    id: string(),
    group_a_id: string(),
    group_b_id: string(),
    connection_type: string(),
    from_group_id: string().optional(),
    to_group_id: string().optional(),
    connection_kind: string().optional(),
    parent_group_id: string().optional(),
    child_group_id: string().optional(),
    status: string(),
    created_by_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupRightGrant = table('group_right_grant')
  .columns({
    id: string(),
    connection_id: string(),
    right_key: string(),
    holder_group_id: string(),
    scope_group_id: string(),
    status: string(),
    initiator_group_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupMembershipRule = table('group_membership_rule')
  .columns({
    id: string(),
    connection_id: string(),
    member_source_group_id: string(),
    member_target_group_id: string(),
    membership_mode: string(),
    required_source_role_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupMembershipRuleOrigin = table('group_membership_rule_origin')
  .columns({
    id: string(),
    membership_rule_id: string(),
    eligible_origin_group_id: string(),
    created_at: number(),
  })
  .primaryKey('id');

export const groupHierarchyPath = table('group_hierarchy_path')
  .columns({
    id: string(),
    ancestor_group_id: string(),
    descendant_group_id: string(),
    direct_child_group_id: string().optional(),
    base_group_id: string(),
    depth: number(),
    path_group_ids: json<MutableJSONValue>(),
    status: string(),
    connection_id: string().optional(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupEffectiveRight = table('group_effective_right')
  .columns({
    id: string(),
    holder_group_id: string(),
    scope_group_id: string(),
    right_key: string(),
    source_connection_id: string().optional(),
    source_grant_id: string().optional(),
    status: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupMembershipExclusivityLock = table('group_membership_exclusivity_lock')
  .columns({
    id: string(),
    user_id: string(),
    hierarchy_group_id: string(),
    source_group_id: string(),
    group_membership_id: string(),
    status: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupSiblingSourceLock = table('group_sibling_source_lock')
  .columns({
    id: string(),
    user_id: string(),
    sibling_group_id: string(),
    source_group_id: string(),
    group_membership_id: string(),
    status: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupConnectionRequest = table('group_connection_request')
  .columns({
    id: string(),
    active_connection_id: string().optional(),
    proposed_connection_id: string(),
    group_a_id: string(),
    group_b_id: string(),
    desired_connection_type: string(),
    desired_parent_group_id: string().optional(),
    desired_child_group_id: string().optional(),
    structure_status: string(),
    status: string(),
    initiator_group_id: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupRightGrantRequest = table('group_right_grant_request')
  .columns({
    id: string(),
    connection_request_id: string(),
    existing_grant_id: string().optional(),
    operation: string(),
    right_key: string(),
    holder_group_id: string(),
    scope_group_id: string(),
    status: string(),
    initiator_group_id: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupMembershipRuleRequest = table('group_membership_rule_request')
  .columns({
    id: string(),
    connection_request_id: string(),
    existing_membership_rule_id: string().optional(),
    operation: string(),
    member_source_group_id: string().optional(),
    member_target_group_id: string().optional(),
    membership_mode: string().optional(),
    required_source_role_id: string().optional(),
    status: string(),
    created_at: number(),
    updated_at: number(),
  })
  .primaryKey('id');

export const groupMembershipRuleRequestOrigin = table('group_membership_rule_request_origin')
  .columns({
    id: string(),
    membership_rule_request_id: string(),
    eligible_origin_group_id: string(),
    created_at: number(),
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
