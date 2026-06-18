import { z } from 'zod';
import { timestampSchema } from '../shared/helpers';
import type { DerivedNetworkRelationshipRow } from './derived';

// ============================================
// Follow Schemas
// ============================================

const followBaseSchema = z.object({
  id: z.string(),
  follower_id: z.string(),
  followee_id: z.string(),
  created_at: timestampSchema,
});

export const followSelectSchema = followBaseSchema;
export const followCreateSchema = followBaseSchema
  .omit({ id: true, created_at: true, follower_id: true })
  .extend({ id: z.string() });
export const followDeleteSchema = z.object({ id: z.string() });

// ============================================
// Group graph schemas
// ============================================

export const groupRightKeySchema = z.enum([
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
]);
export const groupConnectionTypeSchema = z.enum(['hierarchy', 'peer']);
export const groupConnectionKindSchema = z.enum([
  'hierarchy',
  'sibling',
  'parliament',
  'committee',
  'institution',
]);
export const groupMembershipModeSchema = z.enum([
  'all_members',
  'role_members',
  'selected_source_groups',
]);
export const groupConnectionStatusSchema = z.enum(['active', 'pending', 'rejected']);
export const groupRequestItemStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export const groupRequestStatusSchema = z.enum([
  'pending',
  'partially_approved',
  'approved',
  'rejected',
]);
export const workflowStatusSchema = z.enum(['pending_approval', 'active', 'rejected', 'archived']);
export const workflowApprovalStatusSchema = z.enum(['pending', 'accepted', 'rejected']);

const groupConnectionBaseSchema = z.object({
  id: z.string(),
  group_a_id: z.string(),
  group_b_id: z.string(),
  connection_type: groupConnectionTypeSchema,
  from_group_id: z.string().nullable().optional(),
  to_group_id: z.string().nullable().optional(),
  connection_kind: groupConnectionKindSchema.nullable().optional(),
  parent_group_id: z.string().nullable(),
  child_group_id: z.string().nullable(),
  status: z.string(),
  created_by_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const groupRightGrantBaseSchema = z.object({
  id: z.string(),
  connection_id: z.string(),
  right_key: groupRightKeySchema,
  holder_group_id: z.string(),
  scope_group_id: z.string(),
  status: groupConnectionStatusSchema,
  initiator_group_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const groupMembershipRuleBaseSchema = z.object({
  id: z.string(),
  connection_id: z.string(),
  member_source_group_id: z.string(),
  member_target_group_id: z.string(),
  membership_mode: groupMembershipModeSchema,
  required_source_role_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const groupHierarchyPathBaseSchema = z.object({
  id: z.string(),
  ancestor_group_id: z.string(),
  descendant_group_id: z.string(),
  direct_child_group_id: z.string().nullable(),
  base_group_id: z.string(),
  depth: z.number(),
  path_group_ids: z.array(z.string()),
  status: z.string(),
  connection_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const groupEffectiveRightBaseSchema = z.object({
  id: z.string(),
  holder_group_id: z.string(),
  scope_group_id: z.string(),
  right_key: groupRightKeySchema,
  source_connection_id: z.string().nullable(),
  source_grant_id: z.string().nullable(),
  status: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const groupMembershipExclusivityLockBaseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  hierarchy_group_id: z.string(),
  source_group_id: z.string(),
  group_membership_id: z.string(),
  status: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const groupSiblingSourceLockBaseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  sibling_group_id: z.string(),
  source_group_id: z.string(),
  group_membership_id: z.string(),
  status: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const groupMembershipRuleMutationSchema = z.object({
  id: z.string().optional(),
  member_source_group_id: z.string(),
  member_target_group_id: z.string(),
  membership_mode: groupMembershipModeSchema,
  required_source_role_id: z.string().nullable(),
  eligible_origin_group_ids: z.array(z.string()).default([]),
});

const groupRightGrantMutationSchema = z.object({
  id: z.string(),
  existing_grant_id: z.string().nullable().optional(),
  operation: z.enum(['upsert', 'remove']).default('upsert'),
  right_key: groupRightKeySchema,
  holder_group_id: z.string(),
  scope_group_id: z.string(),
});

const groupConnectionRequestBaseSchema = z.object({
  id: z.string(),
  active_connection_id: z.string().nullable(),
  proposed_connection_id: z.string(),
  group_a_id: z.string(),
  group_b_id: z.string(),
  desired_connection_type: groupConnectionTypeSchema,
  desired_parent_group_id: z.string().nullable(),
  desired_child_group_id: z.string().nullable(),
  structure_status: z.enum(['pending', 'approved', 'rejected']),
  status: groupRequestStatusSchema,
  initiator_group_id: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const groupConnectionSelectSchema = groupConnectionBaseSchema;
export const groupRightGrantSelectSchema = groupRightGrantBaseSchema;
export const groupMembershipRuleSelectSchema = groupMembershipRuleBaseSchema;
export const groupHierarchyPathSelectSchema = groupHierarchyPathBaseSchema;
export const groupEffectiveRightSelectSchema = groupEffectiveRightBaseSchema;
export const groupMembershipExclusivityLockSelectSchema = groupMembershipExclusivityLockBaseSchema;
export const groupSiblingSourceLockSelectSchema = groupSiblingSourceLockBaseSchema;
export const groupConnectionRequestSelectSchema = groupConnectionRequestBaseSchema;

export const createGroupConnectionSchema = groupConnectionBaseSchema
  .omit({ id: true, created_at: true, updated_at: true, created_by_id: true })
  .extend({
    id: z.string(),
    grants: z.array(
      groupRightGrantBaseSchema
        .omit({ id: true, connection_id: true, created_at: true, updated_at: true })
        .extend({ id: z.string().optional() })
    ),
    membership_rule: groupMembershipRuleMutationSchema.nullable(),
  });

export const updateGroupConnectionSchema = groupConnectionBaseSchema
  .pick({
    group_a_id: true,
    group_b_id: true,
    connection_type: true,
    parent_group_id: true,
    child_group_id: true,
    status: true,
  })
  .partial()
  .extend({
    id: z.string(),
    grants: z
      .array(
        groupRightGrantBaseSchema
          .omit({ connection_id: true, created_at: true, updated_at: true })
          .extend({ id: z.string().optional() })
      )
      .optional(),
    membership_rule: groupMembershipRuleMutationSchema.nullable().optional(),
  });

export const deleteGroupConnectionSchema = z.object({
  id: z.string(),
  acting_group_id: z.string(),
});

export const proposeGroupConnectionChangeSchema = groupConnectionRequestBaseSchema
  .omit({ created_at: true, updated_at: true, status: true, structure_status: true })
  .extend({
    grants: z.array(groupRightGrantMutationSchema),
    membership_rule: groupMembershipRuleMutationSchema
      .extend({
        existing_membership_rule_id: z.string().nullable().optional(),
        operation: z.enum(['upsert', 'remove']).default('upsert'),
      })
      .nullable(),
  });

export const approveGroupConnectionRequestSchema = z.object({
  id: z.string(),
  grant_request_ids: z.array(z.string()).optional(),
  approve_membership: z.boolean().optional(),
});
export const rejectGroupConnectionRequestSchema = z.object({
  id: z.string(),
  grant_request_ids: z.array(z.string()).optional(),
  reject_membership: z.boolean().optional(),
  reject_structure: z.boolean().optional(),
});

// ============================================
// Subscriber Schemas
// ============================================

const baseSubscriberSchema = z.object({
  id: z.string(),
  subscriber_id: z.string(),
  user_id: z.string().nullable(),
  group_id: z.string().nullable(),
  amendment_id: z.string().nullable(),
  event_id: z.string().nullable(),
  blog_id: z.string().nullable(),
  created_at: timestampSchema,
});

export const selectSubscriberSchema = baseSubscriberSchema;

export const createSubscriberSchema = baseSubscriberSchema
  .omit({ id: true, created_at: true, subscriber_id: true })
  .extend({ id: z.string() });

export const deleteSubscriberSchema = z.object({ id: z.string() });

// ============================================
// Group Workflow Schemas
// ============================================

const groupWorkflowBaseSchema = z.object({
  id: z.string(),
  group_id: z.string(),
  start_group_id: z.string().nullable(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  is_default_entry: z.boolean(),
  status: workflowStatusSchema.nullable(),
  created_by_id: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const groupWorkflowSelectSchema = groupWorkflowBaseSchema;

export const createGroupWorkflowSchema = groupWorkflowBaseSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    is_default_entry: true,
    start_group_id: true,
    status: true,
  })
  .extend({
    id: z.string(),
    start_group_id: z.string(),
    is_default_entry: z.boolean().optional(),
    status: workflowStatusSchema.optional(),
  });

export const updateGroupWorkflowSchema = groupWorkflowBaseSchema
  .pick({
    start_group_id: true,
    name: true,
    description: true,
    is_default_entry: true,
    status: true,
  })
  .partial()
  .extend({ id: z.string() });

export const deleteGroupWorkflowSchema = z.object({ id: z.string() });

const groupWorkflowApprovalBaseSchema = z.object({
  id: z.string(),
  workflow_id: z.string(),
  group_id: z.string(),
  requested_by_group_id: z.string(),
  status: workflowApprovalStatusSchema,
  responded_at: timestampSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const groupWorkflowApprovalSelectSchema = groupWorkflowApprovalBaseSchema;

// ============================================
// Group Workflow Step Schemas
// ============================================

const groupWorkflowStepBaseSchema = z.object({
  id: z.string(),
  workflow_id: z.string(),
  group_id: z.string(),
  order_index: z.number(),
  label: z.string().nullable(),
  step_kind: z.enum(['group_vote', 'merge_vote', 'workflow_handoff']),
  selection_mode: z.enum(['default_target_workflow', 'explicit_workflow']),
  merge_strategy: z.enum(['winner_continues']).nullable(),
  event_rule: z.string().nullable(),
  auto_task_on_missing_event: z.boolean(),
  target_workflow_id: z.string().nullable(),
  created_at: timestampSchema,
});

export const groupWorkflowStepSelectSchema = groupWorkflowStepBaseSchema;

export const createGroupWorkflowStepSchema = groupWorkflowStepBaseSchema
  .omit({
    id: true,
    created_at: true,
    step_kind: true,
    selection_mode: true,
    merge_strategy: true,
    event_rule: true,
    auto_task_on_missing_event: true,
    target_workflow_id: true,
  })
  .extend({
    id: z.string(),
    step_kind: groupWorkflowStepBaseSchema.shape.step_kind.optional(),
    selection_mode: groupWorkflowStepBaseSchema.shape.selection_mode.optional(),
    merge_strategy: groupWorkflowStepBaseSchema.shape.merge_strategy.optional(),
    event_rule: groupWorkflowStepBaseSchema.shape.event_rule.optional(),
    auto_task_on_missing_event: z.boolean().optional(),
    target_workflow_id: z.string().nullable().optional(),
  });

export const updateGroupWorkflowStepSchema = groupWorkflowStepBaseSchema
  .pick({
    group_id: true,
    order_index: true,
    label: true,
    step_kind: true,
    selection_mode: true,
    merge_strategy: true,
    event_rule: true,
    auto_task_on_missing_event: true,
    target_workflow_id: true,
  })
  .partial()
  .extend({ id: z.string() });

export const deleteGroupWorkflowStepSchema = z.object({ id: z.string() });

const workflowDraftStepInputSchema = z.object({
  id: z.string().optional(),
  group_id: z.string(),
  order_index: z.number().int().nonnegative(),
  label: z.string().nullable(),
  step_kind: z.enum(['group_vote', 'merge_vote', 'workflow_handoff']),
  selection_mode: z.enum(['default_target_workflow', 'explicit_workflow']),
  merge_strategy: z.enum(['winner_continues']).nullable(),
  event_rule: z.string().nullable(),
  auto_task_on_missing_event: z.boolean(),
  target_workflow_id: z.string().nullable(),
});

export const saveWorkflowDefinitionSchema = z.object({
  id: z.string(),
  editing_group_id: z.string(),
  start_group_id: z.string(),
  name: z.string().trim().min(1),
  description: z.string().trim(),
  is_default_entry: z.boolean(),
  created_by_id: z.string(),
  steps: z.array(workflowDraftStepInputSchema).min(1),
});

export const approveWorkflowApprovalSchema = z.object({
  approval_id: z.string(),
});

export const rejectWorkflowApprovalSchema = z.object({
  approval_id: z.string(),
});

// ============================================
// Inferred Types
// ============================================

export type Follow = z.infer<typeof followSelectSchema>;
export type GroupRelationship = DerivedNetworkRelationshipRow;
export type GroupConnection = z.infer<typeof groupConnectionSelectSchema>;
export type GroupRightGrant = z.infer<typeof groupRightGrantSelectSchema>;
export type GroupMembershipRule = z.infer<typeof groupMembershipRuleSelectSchema>;
export type GroupHierarchyPath = z.infer<typeof groupHierarchyPathSelectSchema>;
export type GroupEffectiveRight = z.infer<typeof groupEffectiveRightSelectSchema>;
export type GroupMembershipExclusivityLock = z.infer<
  typeof groupMembershipExclusivityLockSelectSchema
>;
export type GroupSiblingSourceLock = z.infer<typeof groupSiblingSourceLockSelectSchema>;
export type GroupConnectionRequest = z.infer<typeof groupConnectionRequestSelectSchema>;
export type Subscriber = z.infer<typeof selectSubscriberSchema>;
export type GroupWorkflow = z.infer<typeof groupWorkflowSelectSchema>;
export type GroupWorkflowStep = z.infer<typeof groupWorkflowStepSelectSchema>;
export type GroupWorkflowApproval = z.infer<typeof groupWorkflowApprovalSelectSchema>;
