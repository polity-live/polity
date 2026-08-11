import { beforeEach, describe, expect, it, vi } from 'vitest';

const helpers = vi.hoisted(() => ({
  approveGroupConnectionRequest: vi.fn(),
  deleteGroupConnectionAndRequests: vi.fn(),
  proposeGroupConnectionChange: vi.fn(),
  rejectGroupConnectionRequest: vi.fn(),
  syncGroupConnectionChildren: vi.fn(),
  approveWorkflowApproval: vi.fn(),
  deleteWorkflowDefinition: vi.fn(),
  rejectWorkflowApproval: vi.fn(),
  saveWorkflowDefinition: vi.fn(),
}));
const can = vi.hoisted(() => vi.fn());

vi.mock('../../rbac/can', () => ({ can }));
vi.mock('../mutator-helpers', () => ({
  approveGroupConnectionRequest: helpers.approveGroupConnectionRequest,
  deleteGroupConnectionAndRequests: helpers.deleteGroupConnectionAndRequests,
  proposeGroupConnectionChange: helpers.proposeGroupConnectionChange,
  rejectGroupConnectionRequest: helpers.rejectGroupConnectionRequest,
  syncGroupConnectionChildren: helpers.syncGroupConnectionChildren,
}));
vi.mock('../workflow-mutator-helpers', () => ({
  approveWorkflowApproval: helpers.approveWorkflowApproval,
  deleteWorkflowDefinition: helpers.deleteWorkflowDefinition,
  rejectWorkflowApproval: helpers.rejectWorkflowApproval,
  saveWorkflowDefinition: helpers.saveWorkflowDefinition,
}));

import { networkSharedMutators } from '../shared-mutators';

function createTx(location: 'client' | 'server' = 'server') {
  const tables = ['group_connection', 'group_workflow', 'group_workflow_step'];
  return {
    location,
    run: vi.fn(),
    mutate: Object.fromEntries(
      tables.map(table => [table, { insert: vi.fn(), update: vi.fn(), delete: vi.fn() }])
    ) as Record<string, Record<string, ReturnType<typeof vi.fn>>>,
  };
}

const ctx = { userID: 'user-1', email: 'user@example.com' };

function connectionArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'connection-1',
    group_a_id: 'group-a',
    group_b_id: 'group-b',
    connection_type: 'hierarchy',
    parent_group_id: 'group-a',
    child_group_id: 'group-b',
    status: 'active',
    grants: [],
    membership_rule: null,
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('networkSharedMutators full branch contract', () => {
  it('creates a connection while deduplicating endpoint authorization', async () => {
    const tx = createTx();
    await networkSharedMutators.createGroupConnection.fn({
      tx: tx as never,
      ctx,
      args: connectionArgs({ parent_group_id: 'group-a', child_group_id: null }) as never,
    });
    expect(can).toHaveBeenCalledTimes(2);
    expect(tx.mutate.group_connection.insert).toHaveBeenCalled();
    expect(helpers.syncGroupConnectionChildren).toHaveBeenCalled();
  });

  it('throws for a missing update and merges explicit/fallback connection fields', async () => {
    const missingTx = createTx();
    missingTx.run.mockResolvedValue(null);
    await expect(
      networkSharedMutators.updateGroupConnection.fn({
        tx: missingTx as never,
        ctx,
        args: { id: 'missing' },
      })
    ).rejects.toThrow('not found');

    const existing = connectionArgs({ status: 'requested' });
    const fallbackTx = createTx();
    fallbackTx.run.mockResolvedValue(existing);
    await networkSharedMutators.updateGroupConnection.fn({
      tx: fallbackTx as never,
      ctx,
      args: { id: 'connection-1' },
    });
    expect(fallbackTx.mutate.group_connection.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'requested', group_a_id: 'group-a' })
    );

    const explicitTx = createTx();
    explicitTx.run.mockResolvedValue(existing);
    await networkSharedMutators.updateGroupConnection.fn({
      tx: explicitTx as never,
      ctx,
      args: {
        id: 'connection-1',
        group_a_id: 'new-a',
        group_b_id: 'new-b',
        connection_type: 'peer',
        parent_group_id: 'new-a',
        child_group_id: 'new-b',
        status: 'active',
      },
    });
    expect(explicitTx.mutate.group_connection.update).toHaveBeenCalledWith(
      expect.objectContaining({ group_a_id: 'new-a', connection_type: 'peer' })
    );
  });

  it('allows a server delete with no persisted connection and proposes as the initiator', async () => {
    const tx = createTx();
    tx.run.mockResolvedValue(null);
    await networkSharedMutators.deleteGroupConnection.fn({
      tx: tx as never,
      ctx,
      args: { id: 'missing', acting_group_id: 'group-a' },
    });
    await networkSharedMutators.proposeGroupConnectionChange.fn({
      tx: tx as never,
      ctx,
      args: { initiator_group_id: 'group-a' } as never,
    });
    expect(helpers.deleteGroupConnectionAndRequests).toHaveBeenCalled();
    expect(helpers.proposeGroupConnectionChange).toHaveBeenCalled();
  });

  it.each(['approveGroupConnectionRequest', 'rejectGroupConnectionRequest'] as const)(
    'checks found/missing server requests and skips reads on client for %s',
    async name => {
      const serverTx = createTx();
      serverTx.run.mockResolvedValueOnce(connectionArgs()).mockResolvedValueOnce(null);
      const args = {
        id: 'request-1',
        grant_request_ids: ['grant-1'],
        approve_membership: true,
        reject_membership: true,
        reject_structure: false,
      };
      await (networkSharedMutators[name].fn as any)({ tx: serverTx, ctx, args });
      await (networkSharedMutators[name].fn as any)({ tx: serverTx, ctx, args });

      const clientTx = createTx('client');
      await (networkSharedMutators[name].fn as any)({ tx: clientTx, ctx, args });
      expect(clientTx.run).not.toHaveBeenCalled();
      expect(helpers[name]).toHaveBeenCalled();
    }
  );

  it('creates and saves workflows with default and explicit entry flags', async () => {
    const tx = createTx();
    await networkSharedMutators.createWorkflow.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'workflow-default',
        group_id: 'group-a',
        start_group_id: null,
        is_default_entry: undefined,
      } as never,
    });
    await networkSharedMutators.createWorkflow.fn({
      tx: tx as never,
      ctx,
      args: {
        id: 'workflow-explicit',
        group_id: 'group-a',
        start_group_id: 'group-b',
        is_default_entry: true,
      } as never,
    });
    await networkSharedMutators.saveWorkflowDefinition.fn({
      tx: tx as never,
      ctx,
      args: { editing_group_id: 'group-a', start_group_id: 'group-b' } as never,
    });
    expect(tx.mutate.group_workflow.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'workflow-default', is_default_entry: false })
    );
    expect(helpers.saveWorkflowDefinition).toHaveBeenCalled();
  });

  it.each(['updateWorkflow', 'deleteWorkflow'] as const)(
    'executes client and server paths for %s including absent workflow groups',
    async name => {
      const clientTx = createTx('client');
      await (networkSharedMutators[name].fn as any)({
        tx: clientTx,
        ctx,
        args: { id: 'workflow-client' },
      });
      const serverTx = createTx();
      serverTx.run.mockResolvedValueOnce({ group_id: 'group-a' }).mockResolvedValueOnce(null);
      await (networkSharedMutators[name].fn as any)({
        tx: serverTx,
        ctx,
        args: { id: 'workflow-server' },
      });
      await (networkSharedMutators[name].fn as any)({
        tx: serverTx,
        ctx,
        args: { id: 'workflow-missing' },
      });
    }
  );

  it.each(['approveWorkflowApproval', 'rejectWorkflowApproval'] as const)(
    'executes client/server approval authorization for %s',
    async name => {
      const clientTx = createTx('client');
      await (networkSharedMutators[name].fn as any)({
        tx: clientTx,
        ctx,
        args: { approval_id: 'client-approval' },
      });
      const serverTx = createTx();
      serverTx.run.mockResolvedValueOnce({ group_id: 'group-a' }).mockResolvedValueOnce(null);
      await (networkSharedMutators[name].fn as any)({
        tx: serverTx,
        ctx,
        args: { approval_id: 'server-approval' },
      });
      await (networkSharedMutators[name].fn as any)({
        tx: serverTx,
        ctx,
        args: { approval_id: 'missing-approval' },
      });
      expect(helpers[name]).toHaveBeenCalled();
    }
  );

  it('creates workflow steps with defaults and explicit advanced values', async () => {
    const tx = createTx();
    const base = { id: 'step', group_id: 'group-a' };
    await networkSharedMutators.createWorkflowStep.fn({
      tx: tx as never,
      ctx,
      args: base as never,
    });
    await networkSharedMutators.createWorkflowStep.fn({
      tx: tx as never,
      ctx,
      args: {
        ...base,
        id: 'advanced-step',
        step_kind: 'merge_vote',
        selection_mode: 'explicit_workflow',
        merge_strategy: 'winner_continues',
        event_rule: 'required',
        auto_task_on_missing_event: true,
        target_workflow_id: 'target',
      } as never,
    });
    expect(tx.mutate.group_workflow_step.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'step', step_kind: 'group_vote', merge_strategy: null })
    );
  });

  it.each(['updateWorkflowStep', 'deleteWorkflowStep'] as const)(
    'executes client/server step ownership paths for %s',
    async name => {
      const clientTx = createTx('client');
      await (networkSharedMutators[name].fn as any)({
        tx: clientTx,
        ctx,
        args: { id: 'step-client', group_id: 'group-explicit' },
      });
      const serverTx = createTx();
      serverTx.run
        .mockResolvedValueOnce({ group_id: 'group-fallback' })
        .mockResolvedValueOnce(null);
      await (networkSharedMutators[name].fn as any)({
        tx: serverTx,
        ctx,
        args: {
          id: 'step-server',
          group_id: name === 'updateWorkflowStep' ? 'group-explicit' : undefined,
        },
      });
      await (networkSharedMutators[name].fn as any)({
        tx: serverTx,
        ctx,
        args: { id: 'step-missing', group_id: undefined },
      });
    }
  );
});
