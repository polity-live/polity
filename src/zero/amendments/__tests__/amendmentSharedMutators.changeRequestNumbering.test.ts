import { describe, expect, it, vi } from 'vitest';

import { amendmentSharedMutators } from '../shared-mutators';

function createArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cr-new',
    amendment_id: 'amendment-1',
    process_branch_id: null,
    discussion_id: 'suggestion-new',
    title: 'Draft label',
    description: null,
    status: 'open',
    reason: null,
    source_type: null,
    source_id: null,
    source_title: null,
    change_type: 'insert',
    original_text: null,
    new_text: 'new',
    original_properties: null,
    new_properties: null,
    changed_character_count: 3,
    voting_status: 'open',
    voting_deadline: 0,
    voting_majority_type: null,
    quorum_required: null,
    ...overrides,
  } as unknown as Parameters<typeof amendmentSharedMutators.createChangeRequest.fn>[0]['args'];
}

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      amendment: {
        update: vi.fn(),
      },
      amendment_process_branch: {
        update: vi.fn(),
      },
      change_request: {
        insert: vi.fn(),
      },
    },
  } as any;
}

const ctx = { userID: 'user-1' } as any;

describe('amendmentSharedMutators.createChangeRequest numbering', () => {
  it('assigns CR-1 in an empty process branch and syncs the branch discussion', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({ id: 'amendment-1', discussions: [] })
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        document_id: 'document-1',
        discussions: [{ id: 'suggestion-new', crId: 'CR-1' }],
        status: 'active',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce([]);

    await amendmentSharedMutators.createChangeRequest.fn({
      tx,
      ctx,
      args: createArgs({ process_branch_id: 'branch-1', title: 'CR-1' }),
    });

    expect(tx.mutate.change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-new',
        title: 'CR-1',
        branch_sequence_number: 1,
        process_branch_id: 'branch-1',
      })
    );
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'branch-1',
        discussions: [
          expect.objectContaining({
            id: 'suggestion-new',
            crId: 'CR-1',
            changeRequestEntityId: 'cr-new',
            branchSequenceNumber: 1,
            branchScopedCrNumber: 1,
          }),
        ],
      })
    );
  });

  it('keeps the next preassigned discussion number after an existing change request', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({ id: 'amendment-1', discussions: [] })
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        document_id: 'document-1',
        discussions: [{ id: 'suggestion-new', crId: 'CR-2' }],
        status: 'active',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce([
        {
          id: 'cr-1',
          process_branch_id: 'branch-1',
          title: 'CR-1',
          branch_sequence_number: 1,
        },
      ]);

    await amendmentSharedMutators.createChangeRequest.fn({
      tx,
      ctx,
      args: createArgs({ process_branch_id: 'branch-1', title: 'CR-2' }),
    });

    expect(tx.mutate.change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'CR-2', branch_sequence_number: 2 })
    );
  });

  it('does not let another preassigned discussion displace the current reservation', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({ id: 'amendment-1', discussions: [] })
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        document_id: 'document-1',
        discussions: [
          { id: 'suggestion-new', crId: 'CR-1' },
          { id: 'suggestion-next', crId: 'CR-2' },
        ],
        status: 'active',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce([]);

    await amendmentSharedMutators.createChangeRequest.fn({
      tx,
      ctx,
      args: createArgs({ process_branch_id: 'branch-1', title: 'CR-1' }),
    });

    expect(tx.mutate.change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'CR-1', branch_sequence_number: 1 })
    );
  });

  it('advances when the current discussion reserved an already persisted number', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({ id: 'amendment-1', discussions: [] })
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        document_id: 'document-1',
        discussions: [{ id: 'suggestion-new', crId: 'CR-1' }],
        status: 'active',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce([
        {
          id: 'cr-1',
          process_branch_id: 'branch-1',
          title: 'CR-1',
          branch_sequence_number: 1,
        },
      ]);

    await amendmentSharedMutators.createChangeRequest.fn({
      tx,
      ctx,
      args: createArgs({ process_branch_id: 'branch-1', title: 'CR-1' }),
    });

    expect(tx.mutate.change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'CR-2', branch_sequence_number: 2 })
    );
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        discussions: [expect.objectContaining({ id: 'suggestion-new', crId: 'CR-2' })],
      })
    );
  });

  it('continues after legacy discussion labels in the main amendment scope', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({
        id: 'amendment-1',
        discussions: [{ id: 'legacy', crId: 'CR-3' }, { id: 'suggestion-new' }],
      })
      .mockResolvedValueOnce([]);

    await amendmentSharedMutators.createChangeRequest.fn({
      tx,
      ctx,
      args: createArgs({ title: 'Change Request' }),
    });

    expect(tx.mutate.change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'CR-4',
        branch_sequence_number: 4,
        process_branch_id: null,
      })
    );
    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'amendment-1',
        discussions: expect.arrayContaining([
          expect.objectContaining({
            id: 'suggestion-new',
            crId: 'CR-4',
            branchSequenceNumber: 4,
          }),
        ]),
      })
    );
  });

  it('keeps numbering scoped to the selected process branch', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({ id: 'amendment-1', discussions: [] })
      .mockResolvedValueOnce({
        id: 'branch-2',
        process_run_id: 'run-1',
        document_id: 'document-2',
        discussions: [{ id: 'suggestion-new' }],
        status: 'active',
        editing_mode: 'suggest_event',
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce([
        {
          id: 'branch-1-cr-1',
          process_branch_id: 'branch-1',
          title: 'CR-1',
          branch_sequence_number: 1,
        },
      ]);

    await amendmentSharedMutators.createChangeRequest.fn({
      tx,
      ctx,
      args: createArgs({ process_branch_id: 'branch-2', title: 'CR-1' }),
    });

    expect(tx.mutate.change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'CR-1',
        branch_sequence_number: 1,
        process_branch_id: 'branch-2',
      })
    );
  });
});
