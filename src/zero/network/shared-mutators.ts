import { defineMutator } from '@rocicorp/zero';
import { zql } from '../schema';
import {
  createNetworkLinkSchema,
  updateNetworkLinkSchema,
  deleteNetworkLinkSchema,
  proposeNetworkLinkChangeSchema,
  approveNetworkLinkChangeRequestSchema,
  rejectNetworkLinkChangeRequestSchema,
  createGroupWorkflowSchema,
  updateGroupWorkflowSchema,
  deleteGroupWorkflowSchema,
  createGroupWorkflowStepSchema,
  updateGroupWorkflowStepSchema,
  deleteGroupWorkflowStepSchema,
  saveWorkflowDefinitionSchema,
  approveWorkflowApprovalSchema,
  rejectWorkflowApprovalSchema,
} from './schema';
import {
  approveNetworkLinkChangeRequest,
  deleteNetworkLinkAndRequests,
  proposeNetworkLinkChange,
  rejectNetworkLinkChangeRequest,
  syncNetworkLinkChildren,
} from './mutator-helpers';
import {
  approveWorkflowApproval,
  deleteWorkflowDefinition,
  rejectWorkflowApproval,
  saveWorkflowDefinition,
} from './workflow-mutator-helpers';

export const networkSharedMutators = {
  createNetworkLink: defineMutator(createNetworkLinkSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.network_link.insert({
      id: args.id,
      source_group_id: args.source_group_id,
      target_group_id: args.target_group_id,
      structural_relation: args.structural_relation,
      status: args.status,
      created_by_id: null,
      created_at: now,
      updated_at: now,
    });

    await syncNetworkLinkChildren(tx, {
      linkId: args.id,
      rights: args.rights,
      membership_rule: args.membership_rule,
    });
  }),

  updateNetworkLink: defineMutator(updateNetworkLinkSchema, async ({ tx, args }) => {
    const now = Date.now();
    const existingLink = await tx.run(zql.network_link.where('id', args.id).one());
    if (!existingLink) {
      throw new Error('Network link not found');
    }

    await tx.mutate.network_link.update({
      id: args.id,
      source_group_id: args.source_group_id ?? existingLink.source_group_id,
      target_group_id: args.target_group_id ?? existingLink.target_group_id,
      structural_relation: args.structural_relation ?? existingLink.structural_relation,
      status: args.status ?? existingLink.status,
      updated_at: now,
    });

    await syncNetworkLinkChildren(tx, {
      linkId: args.id,
      rights: args.rights,
      membership_rule: args.membership_rule,
    });
  }),

  deleteNetworkLink: defineMutator(deleteNetworkLinkSchema, async ({ tx, args }) => {
    await deleteNetworkLinkAndRequests(tx, args.id);
  }),

  proposeNetworkLinkChange: defineMutator(proposeNetworkLinkChangeSchema, async ({ tx, args }) => {
    await proposeNetworkLinkChange(tx, args);
  }),

  approveNetworkLinkChangeRequest: defineMutator(
    approveNetworkLinkChangeRequestSchema,
    async ({ tx, args }) => {
      await approveNetworkLinkChangeRequest(tx, args.id, args.right_ids);
    }
  ),

  rejectNetworkLinkChangeRequest: defineMutator(
    rejectNetworkLinkChangeRequestSchema,
    async ({ tx, args }) => {
      await rejectNetworkLinkChangeRequest(tx, args.id, args.right_ids);
    }
  ),

  // ── Workflow mutators ─────────────────────────────────────────────

  createWorkflow: defineMutator(createGroupWorkflowSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.group_workflow.insert({
      ...args,
      is_default_entry: args.is_default_entry ?? false,
      created_at: now,
      updated_at: now,
    });
  }),

  updateWorkflow: defineMutator(updateGroupWorkflowSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.group_workflow.update({ ...args, updated_at: now });
  }),

  deleteWorkflow: defineMutator(deleteGroupWorkflowSchema, async ({ tx, args }) => {
    await deleteWorkflowDefinition(tx, args.id);
  }),

  saveWorkflowDefinition: defineMutator(saveWorkflowDefinitionSchema, async ({ tx, args }) => {
    await saveWorkflowDefinition(tx, args);
  }),

  approveWorkflowApproval: defineMutator(approveWorkflowApprovalSchema, async ({ tx, args }) => {
    await approveWorkflowApproval(tx, args.approval_id);
  }),

  rejectWorkflowApproval: defineMutator(rejectWorkflowApprovalSchema, async ({ tx, args }) => {
    await rejectWorkflowApproval(tx, args.approval_id);
  }),

  // ── Workflow Step mutators ────────────────────────────────────────

  createWorkflowStep: defineMutator(createGroupWorkflowStepSchema, async ({ tx, args }) => {
    const now = Date.now();
    await tx.mutate.group_workflow_step.insert({
      ...args,
      step_kind: args.step_kind ?? 'group_vote',
      selection_mode: args.selection_mode ?? 'default_target_workflow',
      merge_strategy: args.merge_strategy ?? null,
      event_rule: args.event_rule ?? null,
      auto_task_on_missing_event: args.auto_task_on_missing_event ?? false,
      target_workflow_id: args.target_workflow_id ?? null,
      created_at: now,
    });
  }),

  updateWorkflowStep: defineMutator(updateGroupWorkflowStepSchema, async ({ tx, args }) => {
    await tx.mutate.group_workflow_step.update(args);
  }),

  deleteWorkflowStep: defineMutator(deleteGroupWorkflowStepSchema, async ({ tx, args }) => {
    await tx.mutate.group_workflow_step.delete({ id: args.id });
  }),
};
