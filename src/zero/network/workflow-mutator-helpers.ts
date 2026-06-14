import { type Transaction } from '@rocicorp/zero';
import type { Schema } from '../schema';
import { zql } from '../schema';
import { deriveGroupRelationships } from './derived';

type ZeroTransaction = Transaction<Schema>;
type WorkflowStatus = 'pending_approval' | 'active' | 'rejected' | 'archived';
type WorkflowApprovalStatus = 'pending' | 'accepted' | 'rejected';

export interface WorkflowDraftStepInput {
  id?: string;
  group_id: string;
  order_index: number;
  label: string | null;
  step_kind: 'group_vote' | 'merge_vote' | 'workflow_handoff';
  selection_mode: 'default_target_workflow' | 'explicit_workflow';
  merge_strategy: 'winner_continues' | null;
  event_rule: string | null;
  auto_task_on_missing_event: boolean;
  target_workflow_id: string | null;
}

export interface SaveWorkflowDefinitionInput {
  id: string;
  editing_group_id: string;
  start_group_id: string;
  name: string;
  description: string;
  is_default_entry: boolean;
  created_by_id: string;
  steps: WorkflowDraftStepInput[];
}

function sortDraftSteps(steps: readonly WorkflowDraftStepInput[]) {
  return [...steps].sort((left, right) => left.order_index - right.order_index);
}

function getDerivedFinalGroupId(steps: readonly WorkflowDraftStepInput[]) {
  return sortDraftSteps(steps)[steps.length - 1]?.group_id ?? null;
}

async function loadActiveAmendmentRelationships(tx: ZeroTransaction) {
  const [connections, grants, rules] = await Promise.all([
    tx.run(zql.group_connection),
    tx.run(zql.group_right_grant),
    tx.run(zql.group_membership_rule),
  ]);

  return deriveGroupRelationships({
    connections,
    grants,
    rules,
    includeInactive: false,
  }).filter(relationship => relationship.with_right === 'amendmentRight');
}

function hasDirectTraversalBetweenGroups(args: {
  relationships: Awaited<ReturnType<typeof loadActiveAmendmentRelationships>>;
  sourceGroupId: string;
  targetGroupId: string;
}) {
  return args.relationships.some(
    relationship =>
      relationship.group_id === args.sourceGroupId &&
      relationship.related_group_id === args.targetGroupId
  );
}

async function loadWorkflowGroupNameMap(tx: ZeroTransaction, groupIds: readonly string[]) {
  const groups = await tx.run(zql.group.where('id', 'IN', [...new Set(groupIds)]));
  return new Map(groups.map(group => [group.id, group.name?.trim() || group.id] as const));
}

function formatWorkflowGroupLabel(groupId: string, groupNameMap: ReadonlyMap<string, string>) {
  const name = groupNameMap.get(groupId) ?? groupId;
  return `${name} (${groupId})`;
}

function deriveWorkflowStatus(approvalStatuses: readonly WorkflowApprovalStatus[]): WorkflowStatus {
  if (approvalStatuses.includes('rejected')) {
    return 'rejected';
  }
  if (approvalStatuses.every(status => status === 'accepted')) {
    return 'active';
  }
  return 'pending_approval';
}

async function clearDefaultEntryOnSiblingWorkflows(
  tx: ZeroTransaction,
  args: {
    workflowId: string;
    finalGroupId: string;
  }
) {
  const siblingWorkflows = await tx.run(zql.group_workflow.where('group_id', args.finalGroupId));
  for (const workflow of siblingWorkflows) {
    if (workflow.id === args.workflowId || !workflow.is_default_entry) {
      continue;
    }

    await tx.mutate.group_workflow.update({
      id: workflow.id,
      is_default_entry: false,
      updated_at: Date.now(),
    });
  }
}

async function validateWorkflowDefinition(tx: ZeroTransaction, args: SaveWorkflowDefinitionInput) {
  const sortedSteps = sortDraftSteps(args.steps);
  const lastStep = sortedSteps[sortedSteps.length - 1] ?? null;
  const finalGroupId = getDerivedFinalGroupId(sortedSteps);

  if (!lastStep || !finalGroupId) {
    throw new Error('Workflow requires at least one step.');
  }

  const participantGroupIds = collectParticipantGroupIds({
    startGroupId: args.start_group_id,
    steps: sortedSteps,
  });
  const groupNameMap = await loadWorkflowGroupNameMap(tx, participantGroupIds);
  if (!participantGroupIds.includes(args.editing_group_id)) {
    throw new Error('The current group must participate in the workflow.');
  }

  const relationships = await loadActiveAmendmentRelationships(tx);
  let previousGroupId = args.start_group_id;

  for (const step of sortedSteps) {
    if (
      !hasDirectTraversalBetweenGroups({
        relationships,
        sourceGroupId: previousGroupId,
        targetGroupId: step.group_id,
      })
    ) {
      throw new Error(
        `No direct amendment-right transition exists between ${formatWorkflowGroupLabel(previousGroupId, groupNameMap)} and ${formatWorkflowGroupLabel(step.group_id, groupNameMap)}.`
      );
    }

    if (step.step_kind === 'workflow_handoff' && step.selection_mode === 'explicit_workflow') {
      if (!step.target_workflow_id) {
        throw new Error('Workflow handoff steps require a target workflow.');
      }

      const targetWorkflow = await tx.run(
        zql.group_workflow.where('id', step.target_workflow_id).one()
      );
      if (!targetWorkflow) {
        throw new Error('Selected handoff workflow does not exist.');
      }
      if (targetWorkflow.group_id !== step.group_id) {
        throw new Error('Explicit handoff workflows must belong to the current step group.');
      }
    }

    previousGroupId = step.group_id;
  }
}

function collectParticipantGroupIds(args: {
  startGroupId: string;
  steps: readonly WorkflowDraftStepInput[];
}) {
  return [...new Set([args.startGroupId, ...args.steps.map(step => step.group_id)])];
}

async function replaceWorkflowApprovals(
  tx: ZeroTransaction,
  args: {
    workflowId: string;
    editingGroupId: string;
    participantGroupIds: readonly string[];
  }
): Promise<WorkflowStatus> {
  const now = Date.now();
  const existingApprovals = await tx.run(
    zql.group_workflow_approval.where('workflow_id', args.workflowId)
  );
  for (const approval of existingApprovals) {
    await tx.mutate.group_workflow_approval.delete({ id: approval.id });
  }

  const statuses: WorkflowApprovalStatus[] = [];
  for (const groupId of args.participantGroupIds) {
    const status: WorkflowApprovalStatus = groupId === args.editingGroupId ? 'accepted' : 'pending';
    statuses.push(status);
    await tx.mutate.group_workflow_approval.insert({
      id: crypto.randomUUID(),
      workflow_id: args.workflowId,
      group_id: groupId,
      requested_by_group_id: args.editingGroupId,
      status,
      responded_at: status === 'accepted' ? now : null,
      created_at: now,
      updated_at: now,
    });
  }

  return deriveWorkflowStatus(statuses);
}

async function replaceWorkflowSteps(
  tx: ZeroTransaction,
  args: {
    workflowId: string;
    steps: readonly WorkflowDraftStepInput[];
  }
) {
  const existingSteps = await tx.run(zql.group_workflow_step.where('workflow_id', args.workflowId));
  for (const step of existingSteps) {
    await tx.mutate.group_workflow_step.delete({ id: step.id });
  }

  const now = Date.now();
  for (const step of sortDraftSteps(args.steps)) {
    await tx.mutate.group_workflow_step.insert({
      id: step.id ?? crypto.randomUUID(),
      workflow_id: args.workflowId,
      group_id: step.group_id,
      order_index: step.order_index,
      label: step.label ?? null,
      step_kind: step.step_kind,
      selection_mode: step.selection_mode,
      merge_strategy: step.merge_strategy ?? null,
      event_rule: step.event_rule ?? null,
      auto_task_on_missing_event: step.auto_task_on_missing_event,
      target_workflow_id: step.target_workflow_id ?? null,
      created_at: now,
    });
  }
}

export async function saveWorkflowDefinition(
  tx: ZeroTransaction,
  args: SaveWorkflowDefinitionInput
) {
  await validateWorkflowDefinition(tx, args);

  const sortedSteps = sortDraftSteps(args.steps);
  const finalGroupId = getDerivedFinalGroupId(sortedSteps);
  if (!finalGroupId) {
    throw new Error('Workflow requires at least one step.');
  }

  const now = Date.now();
  const existingWorkflow = await tx.run(zql.group_workflow.where('id', args.id).one());

  if (args.is_default_entry) {
    await clearDefaultEntryOnSiblingWorkflows(tx, {
      workflowId: args.id,
      finalGroupId,
    });
  }

  if (!existingWorkflow) {
    await tx.mutate.group_workflow.insert({
      id: args.id,
      group_id: finalGroupId,
      start_group_id: args.start_group_id,
      name: args.name,
      description: args.description,
      is_default_entry: args.is_default_entry,
      status: 'pending_approval',
      created_by_id: args.created_by_id,
      created_at: now,
      updated_at: now,
    });
  }

  const nextStatus = await replaceWorkflowApprovals(tx, {
    workflowId: args.id,
    editingGroupId: args.editing_group_id,
    participantGroupIds: collectParticipantGroupIds({
      startGroupId: args.start_group_id,
      steps: sortedSteps,
    }),
  });

  if (existingWorkflow) {
    await tx.mutate.group_workflow.update({
      id: args.id,
      group_id: finalGroupId,
      start_group_id: args.start_group_id,
      name: args.name,
      description: args.description,
      is_default_entry: args.is_default_entry,
      status: nextStatus ?? 'pending_approval',
      updated_at: now,
    });
  } else {
    await tx.mutate.group_workflow.update({
      id: args.id,
      group_id: finalGroupId,
      start_group_id: args.start_group_id,
      name: args.name,
      description: args.description,
      is_default_entry: args.is_default_entry,
      status: nextStatus ?? 'pending_approval',
      updated_at: now,
    });
  }

  await replaceWorkflowSteps(tx, {
    workflowId: args.id,
    steps: sortedSteps,
  });
}

export async function deleteWorkflowDefinition(tx: ZeroTransaction, workflowId: string) {
  const approvals = await tx.run(zql.group_workflow_approval.where('workflow_id', workflowId));
  for (const approval of approvals) {
    await tx.mutate.group_workflow_approval.delete({ id: approval.id });
  }

  const steps = await tx.run(zql.group_workflow_step.where('workflow_id', workflowId));
  for (const step of steps) {
    await tx.mutate.group_workflow_step.delete({ id: step.id });
  }

  await tx.mutate.group_workflow.delete({ id: workflowId });
}

async function recomputeWorkflowStatus(tx: ZeroTransaction, workflowId: string) {
  const approvals = await tx.run(zql.group_workflow_approval.where('workflow_id', workflowId));
  const statuses = approvals.map(approval => approval.status as WorkflowApprovalStatus);
  const nextStatus = deriveWorkflowStatus(statuses);
  await tx.mutate.group_workflow.update({
    id: workflowId,
    status: nextStatus,
    updated_at: Date.now(),
  });
}

export async function approveWorkflowApproval(tx: ZeroTransaction, approvalId: string) {
  const approval = await tx.run(zql.group_workflow_approval.where('id', approvalId).one());
  if (!approval) {
    throw new Error('Workflow approval not found.');
  }

  const now = Date.now();
  await tx.mutate.group_workflow_approval.update({
    id: approval.id,
    status: 'accepted',
    responded_at: now,
    updated_at: now,
  });

  await recomputeWorkflowStatus(tx, approval.workflow_id);
}

export async function rejectWorkflowApproval(tx: ZeroTransaction, approvalId: string) {
  const approval = await tx.run(zql.group_workflow_approval.where('id', approvalId).one());
  if (!approval) {
    throw new Error('Workflow approval not found.');
  }

  const now = Date.now();
  await tx.mutate.group_workflow_approval.update({
    id: approval.id,
    status: 'rejected',
    responded_at: now,
    updated_at: now,
  });
  await tx.mutate.group_workflow.update({
    id: approval.workflow_id,
    status: 'rejected',
    updated_at: now,
  });
}
