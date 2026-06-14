import { z } from 'zod';
import {
  timestampSchema,
  nullableTimestampSchema,
  jsonSchema,
  jsonStringArraySchema,
} from '../shared/helpers';

// ============================================
// Amendment Zod Schemas
// ============================================

const baseAmendmentSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  title: z.string().nullable(),
  reason: z.string().nullable(),
  category: z.string().nullable(),
  preamble: z.string().nullable(),
  created_by_id: z.string(),
  group_id: z.string().nullable(),
  event_id: z.string().nullable(),
  clone_source_id: z.string().nullable(),
  origin_amendment_id: z.string().nullable(),
  document_id: z.string().nullable(),
  supporters: z.number(),
  supporters_required: z.number().nullable(),
  supporters_percentage: z.number().nullable(),
  upvotes: z.number(),
  downvotes: z.number(),
  tags: jsonStringArraySchema.nullable(),
  visibility: z.string(),
  subscriber_count: z.number(),
  clone_count: z.number(),
  change_request_count: z.number(),
  editing_mode: z.string().nullable(),
  discussions: jsonSchema.nullable(),
  comment_count: z.number(),
  collaborator_count: z.number(),
  image_url: z.string().nullable(),
  x: z.string().nullable(),
  youtube: z.string().nullable(),
  linkedin: z.string().nullable(),
  website: z.string().nullable(),
  current_process_run_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectAmendmentSchema = baseAmendmentSchema;

export const createAmendmentSchema = baseAmendmentSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    created_by_id: true,
    supporters: true,
    supporters_required: true,
    supporters_percentage: true,
    upvotes: true,
    downvotes: true,
    subscriber_count: true,
    clone_count: true,
    change_request_count: true,
    comment_count: true,
    collaborator_count: true,
    current_process_run_id: true,
  })
  .extend({
    id: z.string(),
    current_process_run_id: z.string().nullable().optional(),
    origin_amendment_id: z.string().nullable().optional(),
  });

export const updateAmendmentSchema = baseAmendmentSchema
  .pick({
    title: true,
    reason: true,
    category: true,
    preamble: true,
    visibility: true,
    editing_mode: true,
    tags: true,
    event_id: true,
    group_id: true,
    x: true,
    youtube: true,
    linkedin: true,
    website: true,
    upvotes: true,
    downvotes: true,
    discussions: true,
    code: true,
    clone_source_id: true,
    origin_amendment_id: true,
    document_id: true,
    image_url: true,
    supporters: true,
    supporters_required: true,
    supporters_percentage: true,
    current_process_run_id: true,
  })
  .partial()
  .extend({ id: z.string() });

export const deleteAmendmentSchema = z.object({ id: z.string() });

// ============================================
// Amendment Collaborator Schemas
// ============================================

const baseAmendmentCollaboratorSchema = z.object({
  id: z.string(),
  amendment_id: z.string(),
  user_id: z.string(),
  role_id: z.string().nullable(),
  status: z.string().nullable(),
  visibility: z.string().nullable(),
  created_at: timestampSchema,
});

export const selectAmendmentCollaboratorSchema = baseAmendmentCollaboratorSchema;

export const createAmendmentCollaboratorSchema = baseAmendmentCollaboratorSchema
  .omit({ id: true, created_at: true })
  .extend({ id: z.string() });

export const updateAmendmentCollaboratorSchema = baseAmendmentCollaboratorSchema
  .pick({ role_id: true, status: true, visibility: true })
  .partial()
  .extend({ id: z.string() });

export const deleteAmendmentCollaboratorSchema = z.object({ id: z.string() });

// ============================================
// Amendment Street Design Schemas
// ============================================

const baseAmendmentStreetDesignSchema = z.object({
  id: z.string(),
  amendment_id: z.string(),
  created_by_id: z.string(),
  title: z.string().nullable(),
  bbox: jsonSchema.nullable(),
  center_lat: z.number().nullable(),
  center_lon: z.number().nullable(),
  osm_snapshot: jsonSchema.nullable(),
  design_state: jsonSchema.nullable(),
  currency: z.string(),
  estimated_total_cost_minor: z.number(),
  cost_catalog_version: z.string().nullable(),
  cost_summary: jsonSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectAmendmentStreetDesignSchema = baseAmendmentStreetDesignSchema;

export const createAmendmentStreetDesignSchema = baseAmendmentStreetDesignSchema
  .omit({ id: true, created_at: true, updated_at: true, created_by_id: true })
  .extend({ id: z.string() });

export const updateAmendmentStreetDesignSchema = baseAmendmentStreetDesignSchema
  .pick({
    title: true,
    bbox: true,
    center_lat: true,
    center_lon: true,
    osm_snapshot: true,
    design_state: true,
    currency: true,
    estimated_total_cost_minor: true,
    cost_catalog_version: true,
    cost_summary: true,
  })
  .partial()
  .extend({ id: z.string() });

export const deleteAmendmentStreetDesignSchema = z.object({ id: z.string() });

// ============================================
// Amendment Path Schemas
// ============================================

const baseAmendmentPathSchema = z.object({
  id: z.string(),
  amendment_id: z.string(),
  process_run_id: z.string().nullable(),
  title: z.string().nullable(),
  workflow_id: z.string().nullable(),
  created_at: timestampSchema,
});

export const selectAmendmentPathSchema = baseAmendmentPathSchema;

export const createAmendmentPathSchema = baseAmendmentPathSchema
  .omit({ id: true, created_at: true, process_run_id: true })
  .extend({
    id: z.string(),
    process_run_id: z.string().nullable().optional(),
  });

export const deleteAmendmentPathSchema = z.object({ id: z.string() });

// ============================================
// Amendment Path Segment Schemas
// ============================================

const baseAmendmentPathSegmentSchema = z.object({
  id: z.string(),
  path_id: z.string(),
  process_branch_id: z.string().nullable(),
  process_step_run_id: z.string().nullable(),
  group_id: z.string().nullable(),
  event_id: z.string().nullable(),
  order_index: z.number().nullable(),
  status: z.string().nullable(),
  created_at: timestampSchema,
});

export const selectAmendmentPathSegmentSchema = baseAmendmentPathSegmentSchema;

export const createAmendmentPathSegmentSchema = baseAmendmentPathSegmentSchema
  .omit({ id: true, created_at: true, process_branch_id: true, process_step_run_id: true })
  .extend({
    id: z.string(),
    process_branch_id: z.string().nullable().optional(),
    process_step_run_id: z.string().nullable().optional(),
  });

export const deleteAmendmentPathSegmentSchema = z.object({ id: z.string() });

// ============================================
// Support Confirmation Schemas
// ============================================

const baseSupportConfirmationSchema = z.object({
  id: z.string(),
  amendment_id: z.string(),
  process_run_id: z.string().nullable(),
  process_step_run_id: z.string().nullable(),
  process_task_id: z.string().nullable(),
  group_id: z.string().nullable(),
  event_id: z.string().nullable(),
  confirmed_by_id: z.string(),
  status: z.string().nullable(),
  confirmed_at: nullableTimestampSchema,
  created_at: timestampSchema,
});

const amendmentGroupDecisionStatusSchema = z.enum([
  'supported',
  'accepted',
  'rejected',
  'withdrawn',
]);

const baseAmendmentGroupDecisionSchema = z.object({
  id: z.string(),
  amendment_id: z.string(),
  group_id: z.string(),
  process_run_id: z.string().nullable(),
  process_branch_id: z.string().nullable(),
  process_step_run_id: z.string().nullable(),
  status: amendmentGroupDecisionStatusSchema,
  decided_at: nullableTimestampSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectSupportConfirmationSchema = baseSupportConfirmationSchema;
export const selectAmendmentGroupDecisionSchema = baseAmendmentGroupDecisionSchema;

export const createSupportConfirmationSchema = baseSupportConfirmationSchema
  .omit({
    id: true,
    created_at: true,
    process_run_id: true,
    process_step_run_id: true,
    process_task_id: true,
  })
  .extend({
    id: z.string(),
    process_run_id: z.string().nullable().optional(),
    process_step_run_id: z.string().nullable().optional(),
    process_task_id: z.string().nullable().optional(),
  });

export const updateSupportConfirmationSchema = baseSupportConfirmationSchema
  .pick({
    status: true,
    confirmed_at: true,
    confirmed_by_id: true,
    event_id: true,
    process_run_id: true,
    process_step_run_id: true,
    process_task_id: true,
  })
  .partial()
  .extend({ id: z.string() });

export const upsertAmendmentGroupDecisionSchema = baseAmendmentGroupDecisionSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    process_run_id: true,
    process_branch_id: true,
    process_step_run_id: true,
    decided_at: true,
  })
  .extend({
    id: z.string().optional(),
    process_run_id: z.string().nullable().optional(),
    process_branch_id: z.string().nullable().optional(),
    process_step_run_id: z.string().nullable().optional(),
    decided_at: nullableTimestampSchema.optional(),
  });

export const deleteAmendmentGroupDecisionSchema = z.object({ id: z.string() });

// ============================================
// Workflow Runtime Schemas
// ============================================

export const amendmentProcessStatusSchema = z.enum([
  'pending_event',
  'scheduled',
  'in_vote',
  'approved',
  'rejected',
  'merged',
  'withdrawn',
  'completed',
]);

export const workflowStepKindSchema = z.enum(['group_vote', 'merge_vote', 'workflow_handoff']);
export const workflowSelectionModeSchema = z.enum(['default_target_workflow', 'explicit_workflow']);
export const workflowMergeStrategySchema = z.enum(['winner_continues']);
export const processTaskTypeSchema = z.enum([
  'schedule_event',
  'implementation_evaluation',
  'support_confirmation',
]);
export const processTaskStatusSchema = z.enum(['open', 'scheduled', 'completed', 'cancelled']);
export const implementationEvaluationStatusSchema = z.enum([
  'awaiting_evaluation',
  'evaluation_scheduled',
  'evaluation_in_vote',
  'implementation_window',
  'implemented',
  'implementation_failed',
  'withdrawn',
]);
export const evaluationModeSchema = z.enum(['fixed_date', 'relative_to_vote']);

const baseAmendmentProcessRunSchema = z.object({
  id: z.string(),
  amendment_id: z.string(),
  root_workflow_id: z.string().nullable(),
  selected_source_group_id: z.string().nullable(),
  selected_target_group_id: z.string().nullable(),
  selected_target_workflow_id: z.string().nullable(),
  active_branch_id: z.string().nullable(),
  terminal_step_run_id: z.string().nullable(),
  status: amendmentProcessStatusSchema,
  evaluation_mode: evaluationModeSchema.nullable(),
  evaluation_date: z.number().nullable(),
  evaluation_offset_months: z.number().nullable(),
  evaluation_offset_years: z.number().nullable(),
  implementation_status: implementationEvaluationStatusSchema.nullable(),
  created_by_id: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const baseAmendmentProcessBranchSchema = z.object({
  id: z.string(),
  process_run_id: z.string(),
  parent_branch_id: z.string().nullable(),
  merged_into_branch_id: z.string().nullable(),
  source_step_run_id: z.string().nullable(),
  document_version_id: z.string().nullable(),
  title: z.string().nullable(),
  status: amendmentProcessStatusSchema,
  resolution: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const baseAmendmentProcessStepRunSchema = z.object({
  id: z.string(),
  process_run_id: z.string(),
  branch_id: z.string(),
  workflow_id: z.string().nullable(),
  workflow_step_id: z.string().nullable(),
  step_kind: workflowStepKindSchema,
  selection_mode: workflowSelectionModeSchema.nullable(),
  merge_strategy: workflowMergeStrategySchema.nullable(),
  status: amendmentProcessStatusSchema,
  source_group_id: z.string().nullable(),
  target_group_id: z.string().nullable(),
  event_id: z.string().nullable(),
  agenda_item_id: z.string().nullable(),
  vote_id: z.string().nullable(),
  support_confirmation_id: z.string().nullable(),
  decision_status: z.string().nullable(),
  order_index: z.number(),
  starts_at: z.number().nullable(),
  ends_at: z.number().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const baseProcessTaskSchema = z.object({
  id: z.string(),
  process_run_id: z.string(),
  branch_id: z.string().nullable(),
  step_run_id: z.string().nullable(),
  task_type: processTaskTypeSchema,
  status: processTaskStatusSchema,
  title: z.string().nullable(),
  description: z.string().nullable(),
  group_id: z.string().nullable(),
  target_group_id: z.string().nullable(),
  event_id: z.string().nullable(),
  agenda_item_id: z.string().nullable(),
  support_confirmation_id: z.string().nullable(),
  due_at: z.number().nullable(),
  resolved_at: z.number().nullable(),
  metadata: jsonSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const selectAmendmentProcessRunSchema = baseAmendmentProcessRunSchema;
export const selectAmendmentProcessBranchSchema = baseAmendmentProcessBranchSchema;
export const selectAmendmentProcessStepRunSchema = baseAmendmentProcessStepRunSchema;
export const selectProcessTaskSchema = baseProcessTaskSchema;

export const createAmendmentProcessRunSchema = baseAmendmentProcessRunSchema
  .omit({ id: true, created_at: true, updated_at: true, created_by_id: true })
  .extend({ id: z.string() });

export const updateAmendmentProcessRunSchema = baseAmendmentProcessRunSchema
  .pick({
    root_workflow_id: true,
    selected_source_group_id: true,
    selected_target_group_id: true,
    selected_target_workflow_id: true,
    active_branch_id: true,
    terminal_step_run_id: true,
    status: true,
    evaluation_mode: true,
    evaluation_date: true,
    evaluation_offset_months: true,
    evaluation_offset_years: true,
    implementation_status: true,
  })
  .partial()
  .extend({ id: z.string() });

export const createAmendmentProcessBranchSchema = baseAmendmentProcessBranchSchema
  .omit({ id: true, created_at: true, updated_at: true })
  .extend({ id: z.string() });

export const updateAmendmentProcessBranchSchema = baseAmendmentProcessBranchSchema
  .pick({
    parent_branch_id: true,
    merged_into_branch_id: true,
    source_step_run_id: true,
    document_version_id: true,
    title: true,
    status: true,
    resolution: true,
  })
  .partial()
  .extend({ id: z.string() });

export const createAmendmentProcessStepRunSchema = baseAmendmentProcessStepRunSchema
  .omit({ id: true, created_at: true, updated_at: true })
  .extend({ id: z.string() });

export const updateAmendmentProcessStepRunSchema = baseAmendmentProcessStepRunSchema
  .pick({
    workflow_id: true,
    workflow_step_id: true,
    step_kind: true,
    selection_mode: true,
    merge_strategy: true,
    status: true,
    source_group_id: true,
    target_group_id: true,
    event_id: true,
    agenda_item_id: true,
    vote_id: true,
    support_confirmation_id: true,
    decision_status: true,
    order_index: true,
    starts_at: true,
    ends_at: true,
  })
  .partial()
  .extend({ id: z.string() });

export const createProcessTaskSchema = baseProcessTaskSchema
  .omit({ id: true, created_at: true, updated_at: true })
  .extend({ id: z.string() });

export const updateProcessTaskSchema = baseProcessTaskSchema
  .pick({
    branch_id: true,
    step_run_id: true,
    task_type: true,
    status: true,
    title: true,
    description: true,
    group_id: true,
    target_group_id: true,
    event_id: true,
    agenda_item_id: true,
    support_confirmation_id: true,
    due_at: true,
    resolved_at: true,
    metadata: true,
  })
  .partial()
  .extend({ id: z.string() });

export const deleteProcessRuntimeRecordSchema = z.object({ id: z.string() });

export const initializeAmendmentProcessPathSchema = z.object({
  amendment_id: z.string(),
  amendment_title: z.string(),
  amendment_reason: z.string().nullable(),
  enriched_path: z.array(
    z.object({
      groupId: z.string(),
      groupName: z.string(),
      eventId: z.string().nullable(),
      eventTitle: z.string(),
      eventStartDate: z.number().nullable(),
      eventEndDate: z.number().nullable().optional(),
      workflowStepId: z.string().nullable().optional(),
      stepKind: workflowStepKindSchema.optional(),
      selectionMode: workflowSelectionModeSchema.nullable().optional(),
      mergeStrategy: workflowMergeStrategySchema.nullable().optional(),
      eventRule: z.string().nullable().optional(),
      autoTaskOnMissingEvent: z.boolean().optional(),
      targetWorkflowId: z.string().nullable().optional(),
      requiredAfter: z.number().nullable().optional(),
      requiredBefore: z.number().nullable().optional(),
      missingEvent: z.boolean().optional(),
      agendaItemId: z.string().nullable(),
      amendmentVoteId: z.string().nullable(),
      forwardingStatus: z.string(),
    })
  ),
  source_group_id: z.string().nullable().optional(),
  workflow_id: z.string().nullable().optional(),
  path_mode: z.enum(['hierarchy', 'workflow']).optional(),
  evaluation_mode: z.enum(['none', 'fixed_date', 'relative_to_vote']).optional(),
  evaluation_date: z.number().nullable().optional(),
  evaluation_offset_months: z.number().nullable().optional(),
  evaluation_offset_years: z.number().nullable().optional(),
});

export const resolveAmendmentProcessVoteSchema = z.object({
  agenda_item_id: z.string(),
});

export const completeProcessTaskWithEventSchema = z.object({
  process_task_id: z.string(),
  event_id: z.string(),
  description: z.string().nullable().optional(),
});

// ============================================
// Inferred Types
// ============================================

export type Amendment = z.infer<typeof selectAmendmentSchema>;
export type AmendmentCollaborator = z.infer<typeof selectAmendmentCollaboratorSchema>;
export type AmendmentStreetDesign = z.infer<typeof selectAmendmentStreetDesignSchema>;
export type AmendmentPath = z.infer<typeof selectAmendmentPathSchema>;
export type AmendmentPathSegment = z.infer<typeof selectAmendmentPathSegmentSchema>;
export type SupportConfirmation = z.infer<typeof selectSupportConfirmationSchema>;
export type AmendmentGroupDecision = z.infer<typeof selectAmendmentGroupDecisionSchema>;
export type AmendmentProcessRun = z.infer<typeof selectAmendmentProcessRunSchema>;
export type AmendmentProcessBranch = z.infer<typeof selectAmendmentProcessBranchSchema>;
export type AmendmentProcessStepRun = z.infer<typeof selectAmendmentProcessStepRunSchema>;
export type ProcessTask = z.infer<typeof selectProcessTaskSchema>;
