import { defineMutator } from '@rocicorp/zero';
import { can } from '../rbac/can';
import { zql } from '../schema';
import {
  createGroupConnectionSchema,
  updateGroupConnectionSchema,
  deleteGroupConnectionSchema,
  proposeGroupConnectionChangeSchema,
  approveGroupConnectionRequestSchema,
  rejectGroupConnectionRequestSchema,
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
  approveGroupConnectionRequest,
  deleteGroupConnectionAndRequests,
  proposeGroupConnectionChange,
  rejectGroupConnectionRequest,
  syncGroupConnectionChildren,
} from './mutator-helpers';
import {
  approveWorkflowApproval,
  deleteWorkflowDefinition,
  rejectWorkflowApproval,
  saveWorkflowDefinition,
} from './workflow-mutator-helpers';

async function assertCanManageGroupRelationship(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  groupId: string | null | undefined
) {
  if (!groupId) return;
  await can(tx, ctx, {
    action: 'manage',
    resource: 'groupRelationships',
    groupId,
  });
}

async function assertCanManageConnection(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  connection: {
    group_a_id?: string | null;
    group_b_id?: string | null;
    parent_group_id?: string | null;
    child_group_id?: string | null;
  }
) {
  const groupIds = new Set(
    [
      connection.group_a_id,
      connection.group_b_id,
      connection.parent_group_id,
      connection.child_group_id,
    ].filter(Boolean)
  );

  for (const groupId of groupIds) {
    await assertCanManageGroupRelationship(tx, ctx, groupId);
  }
}

function assertGroupBelongsToConnection(
  connection: {
    group_a_id?: string | null;
    group_b_id?: string | null;
    parent_group_id?: string | null;
    child_group_id?: string | null;
  },
  groupId: string
) {
  const groupIds = new Set(
    [
      connection.group_a_id,
      connection.group_b_id,
      connection.parent_group_id,
      connection.child_group_id,
    ].filter(Boolean)
  );

  if (!groupIds.has(groupId)) {
    throw new Error('Acting group is not part of this connection');
  }
}

async function assertCanDeleteConnectionFromActingGroup(
  tx: Parameters<typeof can>[0],
  ctx: Parameters<typeof can>[1],
  connection: {
    group_a_id?: string | null;
    group_b_id?: string | null;
    parent_group_id?: string | null;
    child_group_id?: string | null;
  },
  actingGroupId: string
) {
  assertGroupBelongsToConnection(connection, actingGroupId);
  await assertCanManageGroupRelationship(tx, ctx, actingGroupId);
}

export const networkSharedMutators = {
  createGroupConnection: defineMutator(createGroupConnectionSchema, async ({ tx, ctx, args }) => {
    await assertCanManageConnection(tx, ctx, args);
    const now = Date.now();
    await tx.mutate.group_connection.insert({
      id: args.id,
      group_a_id: args.group_a_id,
      group_b_id: args.group_b_id,
      connection_type: args.connection_type,
      parent_group_id: args.parent_group_id,
      child_group_id: args.child_group_id,
      status: args.status,
      created_by_id: null,
      created_at: now,
      updated_at: now,
    });

    await syncGroupConnectionChildren(tx, {
      connectionId: args.id,
      grants: args.grants,
      membership_rule: args.membership_rule,
    });
  }),

  updateGroupConnection: defineMutator(updateGroupConnectionSchema, async ({ tx, ctx, args }) => {
    const now = Date.now();
    const existingConnection = await tx.run(zql.group_connection.where('id', args.id).one());
    if (!existingConnection) {
      throw new Error('Group connection not found');
    }
    await assertCanManageConnection(tx, ctx, {
      group_a_id: args.group_a_id ?? existingConnection.group_a_id,
      group_b_id: args.group_b_id ?? existingConnection.group_b_id,
      parent_group_id: args.parent_group_id ?? existingConnection.parent_group_id,
      child_group_id: args.child_group_id ?? existingConnection.child_group_id,
    });

    await tx.mutate.group_connection.update({
      id: args.id,
      group_a_id: args.group_a_id ?? existingConnection.group_a_id,
      group_b_id: args.group_b_id ?? existingConnection.group_b_id,
      connection_type: args.connection_type ?? existingConnection.connection_type,
      parent_group_id: args.parent_group_id ?? existingConnection.parent_group_id,
      child_group_id: args.child_group_id ?? existingConnection.child_group_id,
      status: args.status ?? existingConnection.status,
      updated_at: now,
    });

    await syncGroupConnectionChildren(tx, {
      connectionId: args.id,
      grants: args.grants,
      membership_rule: args.membership_rule,
    });
  }),

  deleteGroupConnection: defineMutator(deleteGroupConnectionSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const existingConnection = await tx.run(zql.group_connection.where('id', args.id).one());
      if (existingConnection) {
        await assertCanDeleteConnectionFromActingGroup(
          tx,
          ctx,
          existingConnection,
          args.acting_group_id
        );
      }
    }
    await deleteGroupConnectionAndRequests(tx, args.id);
  }),

  proposeGroupConnectionChange: defineMutator(
    proposeGroupConnectionChangeSchema,
    async ({ tx, ctx, args }) => {
      await assertCanManageGroupRelationship(tx, ctx, args.initiator_group_id);
      await proposeGroupConnectionChange(tx, args);
    }
  ),

  approveGroupConnectionRequest: defineMutator(
    approveGroupConnectionRequestSchema,
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const request = await tx.run(zql.group_connection_request.where('id', args.id).one());
        if (request) {
          await assertCanManageConnection(tx, ctx, request);
        }
      }

      await approveGroupConnectionRequest(
        tx,
        args.id,
        args.grant_request_ids,
        args.approve_membership
      );
    }
  ),

  rejectGroupConnectionRequest: defineMutator(
    rejectGroupConnectionRequestSchema,
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const request = await tx.run(zql.group_connection_request.where('id', args.id).one());
        if (request) {
          await assertCanManageConnection(tx, ctx, request);
        }
      }

      await rejectGroupConnectionRequest(
        tx,
        args.id,
        args.grant_request_ids,
        args.reject_membership,
        args.reject_structure
      );
    }
  ),

  // ── Workflow mutators ─────────────────────────────────────────────

  createWorkflow: defineMutator(createGroupWorkflowSchema, async ({ tx, ctx, args }) => {
    await assertCanManageGroupRelationship(tx, ctx, args.group_id);
    await assertCanManageGroupRelationship(tx, ctx, args.start_group_id);
    const now = Date.now();
    await tx.mutate.group_workflow.insert({
      ...args,
      is_default_entry: args.is_default_entry ?? false,
      created_at: now,
      updated_at: now,
    });
  }),

  updateWorkflow: defineMutator(updateGroupWorkflowSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const workflow = await tx.run(zql.group_workflow.where('id', args.id).one());
      await assertCanManageGroupRelationship(tx, ctx, workflow?.group_id);
    }
    const now = Date.now();
    await tx.mutate.group_workflow.update({ ...args, updated_at: now });
  }),

  deleteWorkflow: defineMutator(deleteGroupWorkflowSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const workflow = await tx.run(zql.group_workflow.where('id', args.id).one());
      await assertCanManageGroupRelationship(tx, ctx, workflow?.group_id);
    }
    await deleteWorkflowDefinition(tx, args.id);
  }),

  saveWorkflowDefinition: defineMutator(saveWorkflowDefinitionSchema, async ({ tx, ctx, args }) => {
    await assertCanManageGroupRelationship(tx, ctx, args.editing_group_id);
    await assertCanManageGroupRelationship(tx, ctx, args.start_group_id);
    await saveWorkflowDefinition(tx, args);
  }),

  approveWorkflowApproval: defineMutator(
    approveWorkflowApprovalSchema,
    async ({ tx, ctx, args }) => {
      if (tx.location !== 'client') {
        const approval = await tx.run(
          zql.group_workflow_approval.where('id', args.approval_id).one()
        );
        await assertCanManageGroupRelationship(tx, ctx, approval?.group_id);
      }
      await approveWorkflowApproval(tx, args.approval_id);
    }
  ),

  rejectWorkflowApproval: defineMutator(rejectWorkflowApprovalSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const approval = await tx.run(
        zql.group_workflow_approval.where('id', args.approval_id).one()
      );
      await assertCanManageGroupRelationship(tx, ctx, approval?.group_id);
    }
    await rejectWorkflowApproval(tx, args.approval_id);
  }),

  // ── Workflow Step mutators ────────────────────────────────────────

  createWorkflowStep: defineMutator(createGroupWorkflowStepSchema, async ({ tx, ctx, args }) => {
    await assertCanManageGroupRelationship(tx, ctx, args.group_id);
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

  updateWorkflowStep: defineMutator(updateGroupWorkflowStepSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const step = await tx.run(zql.group_workflow_step.where('id', args.id).one());
      await assertCanManageGroupRelationship(tx, ctx, args.group_id ?? step?.group_id);
    }
    await tx.mutate.group_workflow_step.update(args);
  }),

  deleteWorkflowStep: defineMutator(deleteGroupWorkflowStepSchema, async ({ tx, ctx, args }) => {
    if (tx.location !== 'client') {
      const step = await tx.run(zql.group_workflow_step.where('id', args.id).one());
      await assertCanManageGroupRelationship(tx, ctx, step?.group_id);
    }
    await tx.mutate.group_workflow_step.delete({ id: args.id });
  }),
};
