import { describe, expect, it, vi } from 'vitest';

import { PermissionError } from '../../rbac/errors';
import { amendmentSharedMutators } from '../shared-mutators';

type AmendmentMutatorInput = Parameters<typeof amendmentSharedMutators.createProcessRun.fn>[0];
type AmendmentMutatorTx = AmendmentMutatorInput['tx'];
type AmendmentMutatorCtx = AmendmentMutatorInput['ctx'];

function createTx(location: AmendmentMutatorTx['location'] = 'server') {
  return {
    clientID: 'client-1',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      amendment_path: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
      amendment_path_segment: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
      support_confirmation: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      amendment_group_decision: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      amendment_process_run: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      amendment_process_branch: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      amendment_process_step_run: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      process_task: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function createCtx(): AmendmentMutatorCtx {
  return {
    userID: 'user-1',
    email: 'user@example.com',
  };
}

const processRunArgs = {
  id: 'process-run-1',
  amendment_id: 'amendment-1',
  root_workflow_id: null,
  selected_source_group_id: null,
  selected_target_group_id: null,
  selected_target_workflow_id: null,
  active_branch_id: null,
  terminal_step_run_id: null,
  status: 'pending_event' as const,
  evaluation_mode: null,
  evaluation_date: null,
  evaluation_offset_months: null,
  evaluation_offset_years: null,
  implementation_status: null,
};

const supportConfirmationArgs = {
  id: 'support-confirmation-1',
  amendment_id: 'amendment-1',
  process_run_id: null,
  process_step_run_id: null,
  process_task_id: null,
  group_id: 'group-1',
  event_id: null,
  confirmed_by_id: 'user-1',
  status: 'pending',
  confirmed_at: 0,
};

describe('amendmentSharedMutators process authorization', () => {
  it('rejects direct process run creation on the server', async () => {
    const tx = createTx('server');

    await expect(
      amendmentSharedMutators.createProcessRun.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: processRunArgs,
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.mutate.amendment_process_run.insert).not.toHaveBeenCalled();
  });

  it('keeps process run creation optimistic on the client', async () => {
    const tx = createTx('client');

    await expect(
      amendmentSharedMutators.createProcessRun.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: processRunArgs,
      })
    ).resolves.toBeUndefined();

    expect(tx.mutate.amendment_process_run.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'process-run-1',
        amendment_id: 'amendment-1',
        created_by_id: 'user-1',
      })
    );
  });

  it('rejects direct support confirmation creation on the server', async () => {
    const tx = createTx('server');

    await expect(
      amendmentSharedMutators.createSupportConfirmation.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: supportConfirmationArgs,
      })
    ).rejects.toThrow(PermissionError);

    expect(tx.mutate.support_confirmation.insert).not.toHaveBeenCalled();
  });

  it('keeps support confirmation creation optimistic on the client', async () => {
    const tx = createTx('client');

    await expect(
      amendmentSharedMutators.createSupportConfirmation.fn({
        tx: tx as never,
        ctx: createCtx(),
        args: supportConfirmationArgs,
      })
    ).resolves.toBeUndefined();

    expect(tx.mutate.support_confirmation.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'support-confirmation-1',
        amendment_id: 'amendment-1',
      })
    );
  });
});
