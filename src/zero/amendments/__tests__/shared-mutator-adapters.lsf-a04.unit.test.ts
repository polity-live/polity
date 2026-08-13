import { describe, expect, it, vi } from 'vitest';

import { amendmentSharedMutators } from '../shared-mutators';

function createTx() {
  const operation = { insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
  return {
    location: 'client',
    run: vi.fn().mockResolvedValue(null),
    mutate: new Proxy({}, { get: () => operation }),
    operation,
  };
}

const args = {
  id: 'record-1',
  amendment_id: 'amendment-1',
  group_id: 'group-1',
  status: 'active',
  amendment: { id: 'amendment-1', title: 'Test amendment' },
};

describe('amendment shared mutator LSF adapters', () => {
  it('executes every remaining persistence and server-delegation adapter', async () => {
    const tx = createTx();
    const input = { tx: tx as any, ctx: { userID: 'user-1' }, args: args as any };
    const names = [
      'createFull',
      'update',
      'delete',
      'addCollaborator',
      'removeCollaborator',
      'deleteCityDesign',
      'finalizeInternalChangeRequestVote',
      'finalizeExpiredInternalChangeRequestVotes',
      'repairInternalChangeRequestResolution',
      'supportAmendment',
      'updateSupportVote',
      'deleteSupportVote',
      'deletePath',
      'deletePathSegment',
      'updateSupportConfirmation',
      'deleteGroupDecision',
      'updateProcessRun',
      'deleteProcessRun',
      'updateProcessBranch',
      'deleteProcessBranch',
      'updateProcessStepRun',
      'deleteProcessStepRun',
      'updateProcessTask',
      'deleteProcessTask',
      'initializeProcessPath',
      'resolveProcessVote',
      'completeProcessTaskWithEvent',
      'replanProcessBranchEvents',
      'updateCollaborator',
      'updateChangeRequest',
      'deleteChangeRequest',
    ] as const;

    for (const name of names) {
      await amendmentSharedMutators[name].fn(input as never);
    }

    expect(tx.operation.update).toHaveBeenCalled();
    expect(tx.operation.delete).toHaveBeenCalled();
    expect(tx.operation.insert).toHaveBeenCalled();
  });
});
