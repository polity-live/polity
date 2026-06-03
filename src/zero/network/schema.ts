import { z } from 'zod';
import { timestampSchema, jsonStringArraySchema } from '../shared/helpers';
import type { DerivedNetworkRelationshipRow } from './derived';

const networkLinkMembershipRuleDirectionConfigSchema = z.object({
  membership_mode: z.enum(['none', 'all_members', 'role_members', 'selected_source_groups']),
  role_id: z.string().nullable(),
  source_group_ids: jsonStringArraySchema.nullable(),
});

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
// Network Link Schemas
// ============================================

export const networkLinkRightKeySchema = z.enum([
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
]);

export const networkLinkDirectionSchema = z.enum(['forward', 'backward', 'bidirectional']);
export const networkLinkRelationSchema = z.enum(['parent_child', 'sibling']);
export const networkLinkMembershipModeSchema = z.enum([
  'none',
  'all_members',
  'role_members',
  'selected_source_groups',
]);
export const networkLinkStatusSchema = z.enum(['active', 'requested', 'pending', 'rejected']);
export const networkLinkMembershipRuleSnapshotSchema = z.object({
  forward: networkLinkMembershipRuleDirectionConfigSchema,
  backward: networkLinkMembershipRuleDirectionConfigSchema,
});

const networkLinkBaseSchema = z.object({
  id: z.string(),
  source_group_id: z.string(),
  target_group_id: z.string(),
  structural_relation: networkLinkRelationSchema,
  status: z.string(),
  created_by_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const networkLinkRightBaseSchema = z.object({
  id: z.string(),
  network_link_id: z.string(),
  right_key: networkLinkRightKeySchema,
  direction: networkLinkDirectionSchema,
  status: networkLinkStatusSchema,
  initiator_group_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const networkLinkMembershipRuleBaseSchema = z.object({
  id: z.string(),
  network_link_id: z.string(),
  membership_mode: networkLinkMembershipModeSchema,
  role_id: z.string().nullable(),
  source_group_ids: jsonStringArraySchema.nullable(),
  forward_membership_mode: networkLinkMembershipModeSchema,
  forward_role_id: z.string().nullable(),
  forward_source_group_ids: jsonStringArraySchema.nullable(),
  backward_membership_mode: networkLinkMembershipModeSchema,
  backward_role_id: z.string().nullable(),
  backward_source_group_ids: jsonStringArraySchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const networkLinkMembershipRuleMutationSchema = z.object({
  id: z.string().optional(),
  membership_mode: networkLinkMembershipModeSchema.optional(),
  role_id: z.string().nullable().optional(),
  source_group_ids: jsonStringArraySchema.nullable().optional(),
  forward: networkLinkMembershipRuleDirectionConfigSchema.optional(),
  backward: networkLinkMembershipRuleDirectionConfigSchema.optional(),
});

const networkLinkChangeRequestRightSnapshotSchema = z.object({
  id: z.string(),
  right_key: networkLinkRightKeySchema,
  direction: networkLinkDirectionSchema,
});

const networkLinkChangeRequestBaseSchema = z.object({
  id: z.string(),
  active_network_link_id: z.string().nullable(),
  proposed_network_link_id: z.string(),
  source_group_id: z.string(),
  target_group_id: z.string(),
  structural_relation: networkLinkRelationSchema,
  status: networkLinkStatusSchema,
  initiator_group_id: z.string(),
  desired_rights: z.array(networkLinkChangeRequestRightSnapshotSchema),
  desired_membership_rules: networkLinkMembershipRuleSnapshotSchema.nullable().optional(),
  desired_membership_mode: networkLinkMembershipModeSchema,
  desired_role_id: z.string().nullable(),
  desired_source_group_ids: jsonStringArraySchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const networkLinkSelectSchema = networkLinkBaseSchema;
export const networkLinkRightSelectSchema = networkLinkRightBaseSchema;
export const networkLinkMembershipRuleSelectSchema = networkLinkMembershipRuleBaseSchema;
export const networkLinkChangeRequestSelectSchema = networkLinkChangeRequestBaseSchema;

export const createNetworkLinkSchema = networkLinkBaseSchema
  .omit({ id: true, created_at: true, updated_at: true, created_by_id: true })
  .extend({
    id: z.string(),
    rights: z.array(
      networkLinkRightBaseSchema
        .omit({ id: true, network_link_id: true, created_at: true, updated_at: true })
        .extend({ id: z.string().optional() })
    ),
    membership_rule: networkLinkMembershipRuleMutationSchema,
  });

export const updateNetworkLinkSchema = networkLinkBaseSchema
  .pick({
    source_group_id: true,
    target_group_id: true,
    structural_relation: true,
    status: true,
  })
  .partial()
  .extend({
    id: z.string(),
    rights: z
      .array(
        networkLinkRightBaseSchema
          .omit({ network_link_id: true, created_at: true, updated_at: true })
          .extend({ id: z.string().optional() })
      )
      .optional(),
    membership_rule: networkLinkMembershipRuleMutationSchema.optional(),
  });

export const deleteNetworkLinkSchema = z.object({ id: z.string() });

export const proposeNetworkLinkChangeSchema = networkLinkChangeRequestBaseSchema
  .omit({ created_at: true, updated_at: true, status: true })
  .extend({
    status: networkLinkStatusSchema.optional(),
  });

export const approveNetworkLinkChangeRequestSchema = z.object({
  id: z.string(),
  right_ids: z.array(z.string()).optional(),
});
export const rejectNetworkLinkChangeRequestSchema = z.object({
  id: z.string(),
  right_ids: z.array(z.string()).optional(),
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
  name: z.string().nullable(),
  description: z.string().nullable(),
  is_default_entry: z.boolean(),
  status: z.string().nullable(),
  created_by_id: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const groupWorkflowSelectSchema = groupWorkflowBaseSchema;

export const createGroupWorkflowSchema = groupWorkflowBaseSchema
  .omit({ id: true, created_at: true, updated_at: true, is_default_entry: true })
  .extend({
    id: z.string(),
    is_default_entry: z.boolean().optional(),
  });

export const updateGroupWorkflowSchema = groupWorkflowBaseSchema
  .pick({ name: true, description: true, is_default_entry: true, status: true })
  .partial()
  .extend({ id: z.string() });

export const deleteGroupWorkflowSchema = z.object({ id: z.string() });

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

// ============================================
// Inferred Types
// ============================================

export type Follow = z.infer<typeof followSelectSchema>;
export type GroupRelationship = DerivedNetworkRelationshipRow;
export type NetworkLink = z.infer<typeof networkLinkSelectSchema>;
export type NetworkLinkRight = z.infer<typeof networkLinkRightSelectSchema>;
export type NetworkLinkMembershipRule = z.infer<typeof networkLinkMembershipRuleSelectSchema>;
export type NetworkLinkMembershipRuleSnapshot = z.infer<
  typeof networkLinkMembershipRuleSnapshotSchema
>;
export type NetworkLinkChangeRequest = z.infer<typeof networkLinkChangeRequestSelectSchema>;
export type Subscriber = z.infer<typeof selectSubscriberSchema>;
export type GroupWorkflow = z.infer<typeof groupWorkflowSelectSchema>;
export type GroupWorkflowStep = z.infer<typeof groupWorkflowStepSelectSchema>;
