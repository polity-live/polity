import { defineMutator } from '@rocicorp/zero';
import {
  createAmendmentSchema,
  updateAmendmentSchema,
  deleteAmendmentSchema,
  createAmendmentCollaboratorSchema,
  updateAmendmentCollaboratorSchema,
  deleteAmendmentCollaboratorSchema,
  createAmendmentPathSchema,
  deleteAmendmentPathSchema,
  createAmendmentPathSegmentSchema,
  deleteAmendmentPathSegmentSchema,
  createSupportConfirmationSchema,
  updateSupportConfirmationSchema,
  createAmendmentProcessRunSchema,
  updateAmendmentProcessRunSchema,
  createAmendmentProcessBranchSchema,
  updateAmendmentProcessBranchSchema,
  createAmendmentProcessStepRunSchema,
  updateAmendmentProcessStepRunSchema,
  createProcessTaskSchema,
  updateProcessTaskSchema,
  deleteProcessRuntimeRecordSchema,
} from './schema';
import { createChangeRequestSchema, updateChangeRequestSchema } from '../change-requests/schema';
import {
  createChangeRequestVoteSchema,
  createAmendmentSupportVoteSchema,
  updateAmendmentSupportVoteSchema,
  deleteAmendmentSupportVoteSchema,
} from '../votes/schema';

/** Shared mutators — run on both client and server. Server mutators may override these. */
export const amendmentSharedMutators = {
  create: defineMutator(createAmendmentSchema, async ({ tx, ctx: { userID }, args }) => {
    const now = Date.now();
    await tx.mutate.amendment.insert({
      ...args,
      created_by_id: userID,
      supporters: 0,
      subscriber_count: 0,
      clone_count: 0,
      change_request_count: 0,
      supporters_required: 0,
      supporters_percentage: 0,
      upvotes: 0,
      downvotes: 0,
      comment_count: 0,
      collaborator_count: 0,
      current_process_run_id: args.current_process_run_id ?? null,
      created_at: now,
      updated_at: now,
    });
  }),

  update: defineMutator(updateAmendmentSchema, async ({ tx, args }) => {
    await tx.mutate.amendment.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  delete: defineMutator(deleteAmendmentSchema, async ({ tx, args }) => {
    await tx.mutate.amendment.delete({ id: args.id });
  }),

  addCollaborator: defineMutator(createAmendmentCollaboratorSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.amendment_collaborator.insert({
      ...args,
      created_at: now,
    });
  }),

  removeCollaborator: defineMutator(deleteAmendmentCollaboratorSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_collaborator.delete({ id: args.id });
  }),

  createChangeRequest: defineMutator(
    createChangeRequestSchema,
    async ({ tx, ctx: { userID }, args }) => {
      const now = Date.now();
      await tx.mutate.change_request.insert({
        ...args,
        user_id: userID,
        votes_for: 0,
        votes_against: 0,
        votes_abstain: 0,
        created_at: now,
        updated_at: now,
      });
    }
  ),

  voteOnChangeRequest: defineMutator(
    createChangeRequestVoteSchema,
    async ({ tx, ctx: { userID }, args }) => {
      const now = Date.now();
      await tx.mutate.change_request_vote.insert({
        ...args,
        user_id: userID,
        created_at: now,
      });
    }
  ),

  supportAmendment: defineMutator(
    createAmendmentSupportVoteSchema,
    async ({ tx, ctx: { userID }, args }) => {
      const now = Date.now();
      await tx.mutate.amendment_support_vote.insert({
        ...args,
        user_id: userID,
        created_at: now,
      });
    }
  ),

  updateSupportVote: defineMutator(updateAmendmentSupportVoteSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_support_vote.update(args);
  }),

  deleteSupportVote: defineMutator(deleteAmendmentSupportVoteSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_support_vote.delete({ id: args.id });
  }),

  // Amendment Path mutators
  createPath: defineMutator(createAmendmentPathSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.amendment_path.insert({
      ...args,
      process_run_id: args.process_run_id ?? null,
      created_at: now,
    });
  }),

  deletePath: defineMutator(deleteAmendmentPathSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_path.delete({ id: args.id });
  }),

  // Amendment Path Segment mutators
  createPathSegment: defineMutator(createAmendmentPathSegmentSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.amendment_path_segment.insert({
      ...args,
      process_branch_id: args.process_branch_id ?? null,
      process_step_run_id: args.process_step_run_id ?? null,
      created_at: now,
    });
  }),

  deletePathSegment: defineMutator(deleteAmendmentPathSegmentSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_path_segment.delete({ id: args.id });
  }),

  // Support Confirmation mutators
  createSupportConfirmation: defineMutator(
    createSupportConfirmationSchema,
    async ({ tx, args }) => {
      const now = Date.now();
      await tx.mutate.support_confirmation.insert({
        ...args,
        process_run_id: args.process_run_id ?? null,
        process_step_run_id: args.process_step_run_id ?? null,
        process_task_id: args.process_task_id ?? null,
        created_at: now,
      });
    }
  ),

  updateSupportConfirmation: defineMutator(
    updateSupportConfirmationSchema,
    async ({ tx, args }) => {
      await tx.mutate.support_confirmation.update(args);
    }
  ),

  // Workflow runtime mutators
  createProcessRun: defineMutator(createAmendmentProcessRunSchema, async ({ tx, ctx, args }) => {
    const now = Date.now();
    await tx.mutate.amendment_process_run.insert({
      ...args,
      root_workflow_id: args.root_workflow_id ?? null,
      selected_source_group_id: args.selected_source_group_id ?? null,
      selected_target_group_id: args.selected_target_group_id ?? null,
      selected_target_workflow_id: args.selected_target_workflow_id ?? null,
      active_branch_id: args.active_branch_id ?? null,
      terminal_step_run_id: args.terminal_step_run_id ?? null,
      evaluation_mode: args.evaluation_mode ?? null,
      evaluation_date: args.evaluation_date ?? null,
      evaluation_offset_months: args.evaluation_offset_months ?? null,
      evaluation_offset_years: args.evaluation_offset_years ?? null,
      implementation_status: args.implementation_status ?? null,
      created_by_id: ctx.userID,
      created_at: now,
      updated_at: now,
    });
  }),

  updateProcessRun: defineMutator(updateAmendmentProcessRunSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_process_run.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  deleteProcessRun: defineMutator(deleteProcessRuntimeRecordSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_process_run.delete({ id: args.id });
  }),

  createProcessBranch: defineMutator(createAmendmentProcessBranchSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.amendment_process_branch.insert({
      ...args,
      parent_branch_id: args.parent_branch_id ?? null,
      merged_into_branch_id: args.merged_into_branch_id ?? null,
      source_step_run_id: args.source_step_run_id ?? null,
      document_version_id: args.document_version_id ?? null,
      title: args.title ?? null,
      resolution: args.resolution ?? null,
      created_at: now,
      updated_at: now,
    });
  }),

  updateProcessBranch: defineMutator(updateAmendmentProcessBranchSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_process_branch.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  deleteProcessBranch: defineMutator(deleteProcessRuntimeRecordSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_process_branch.delete({ id: args.id });
  }),

  createProcessStepRun: defineMutator(createAmendmentProcessStepRunSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.amendment_process_step_run.insert({
      ...args,
      workflow_id: args.workflow_id ?? null,
      workflow_step_id: args.workflow_step_id ?? null,
      selection_mode: args.selection_mode ?? null,
      merge_strategy: args.merge_strategy ?? null,
      source_group_id: args.source_group_id ?? null,
      target_group_id: args.target_group_id ?? null,
      event_id: args.event_id ?? null,
      agenda_item_id: args.agenda_item_id ?? null,
      vote_id: args.vote_id ?? null,
      support_confirmation_id: args.support_confirmation_id ?? null,
      decision_status: args.decision_status ?? null,
      starts_at: args.starts_at ?? null,
      ends_at: args.ends_at ?? null,
      created_at: now,
      updated_at: now,
    });
  }),

  updateProcessStepRun: defineMutator(updateAmendmentProcessStepRunSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_process_step_run.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  deleteProcessStepRun: defineMutator(deleteProcessRuntimeRecordSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_process_step_run.delete({ id: args.id });
  }),

  createProcessTask: defineMutator(createProcessTaskSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.process_task.insert({
      ...args,
      branch_id: args.branch_id ?? null,
      step_run_id: args.step_run_id ?? null,
      title: args.title ?? null,
      description: args.description ?? null,
      group_id: args.group_id ?? null,
      target_group_id: args.target_group_id ?? null,
      event_id: args.event_id ?? null,
      agenda_item_id: args.agenda_item_id ?? null,
      support_confirmation_id: args.support_confirmation_id ?? null,
      due_at: args.due_at ?? null,
      resolved_at: args.resolved_at ?? null,
      metadata: args.metadata ?? null,
      created_at: now,
      updated_at: now,
    });
  }),

  updateProcessTask: defineMutator(updateProcessTaskSchema, async ({ tx, args }) => {
    await tx.mutate.process_task.update({
      ...args,
      updated_at: Date.now(),
    });
  }),

  deleteProcessTask: defineMutator(deleteProcessRuntimeRecordSchema, async ({ tx, args }) => {
    await tx.mutate.process_task.delete({ id: args.id });
  }),

  // Amendment Collaborator update
  updateCollaborator: defineMutator(updateAmendmentCollaboratorSchema, async ({ tx, args }) => {
    await tx.mutate.amendment_collaborator.update(args);
  }),

  // Change Request update
  updateChangeRequest: defineMutator(updateChangeRequestSchema, async ({ tx, args }) => {
    await tx.mutate.change_request.update({
      ...args,
      updated_at: Date.now(),
    });
  }),
};
