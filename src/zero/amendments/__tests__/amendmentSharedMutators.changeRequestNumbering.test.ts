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
  it('assigns CR-1 through CR-4 when each no-path suggestion is submitted twice', async () => {
    const amendment = { id: 'amendment-1', discussions: [] as Record<string, unknown>[] };
    const changeRequests: Record<string, unknown>[] = [];
    let runCall = 0;
    const tx = createTx();
    tx.run.mockImplementation(async () => {
      runCall += 1;
      return runCall % 2 === 1 ? amendment : changeRequests;
    });
    tx.mutate.amendment.update.mockImplementation(async (update: Record<string, unknown>) => {
      Object.assign(amendment, update);
    });
    tx.mutate.change_request.insert.mockImplementation(
      async (changeRequest: Record<string, unknown>) => {
        changeRequests.push(changeRequest);
      }
    );

    for (let sequenceNumber = 1; sequenceNumber <= 4; sequenceNumber += 1) {
      amendment.discussions.push({
        id: `suggestion-${sequenceNumber}`,
        crId: `CR-${sequenceNumber}`,
        changeRequestEntityId: `cr-${sequenceNumber}`,
      });

      await amendmentSharedMutators.createChangeRequest.fn({
        tx,
        ctx,
        args: createArgs({
          id: `cr-${sequenceNumber}`,
          discussion_id: `suggestion-${sequenceNumber}`,
          title: `CR-${sequenceNumber}`,
        }),
      });
      await amendmentSharedMutators.createChangeRequest.fn({
        tx,
        ctx,
        args: createArgs({
          id: `duplicate-cr-${sequenceNumber}`,
          discussion_id: `suggestion-${sequenceNumber}`,
          title: `CR-${sequenceNumber}`,
        }),
      });
    }

    expect(changeRequests).toHaveLength(4);
    expect(
      changeRequests.map(changeRequest => ({
        title: changeRequest.title,
        sequence: changeRequest.branch_sequence_number,
        suggestionId: changeRequest.suggestion_id,
      }))
    ).toEqual([
      { title: 'CR-1', sequence: 1, suggestionId: 'suggestion-1' },
      { title: 'CR-2', sequence: 2, suggestionId: 'suggestion-2' },
      { title: 'CR-3', sequence: 3, suggestionId: 'suggestion-3' },
      { title: 'CR-4', sequence: 4, suggestionId: 'suggestion-4' },
    ]);
  });

  it('reuses the existing change request when the same suggestion is submitted twice', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({
        id: 'amendment-1',
        discussions: [
          {
            id: 'suggestion-new',
            crId: 'CR-2',
            changeRequestEntityId: 'duplicate-cr',
          },
        ],
      })
      .mockResolvedValueOnce([
        {
          id: 'existing-cr',
          amendment_id: 'amendment-1',
          process_branch_id: null,
          suggestion_id: 'suggestion-new',
          title: 'CR-1',
          branch_sequence_number: 1,
          status: 'open',
          voting_status: 'open',
        },
      ]);

    await amendmentSharedMutators.createChangeRequest.fn({
      tx,
      ctx,
      args: createArgs({ id: 'duplicate-cr', title: 'CR-2' }),
    });

    expect(tx.mutate.change_request.insert).not.toHaveBeenCalled();
    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'amendment-1',
        discussions: [
          expect.objectContaining({
            id: 'suggestion-new',
            crId: 'CR-1',
            changeRequestEntityId: 'existing-cr',
            branchSequenceNumber: 1,
          }),
        ],
      })
    );
  });

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
        suggestion_id: 'suggestion-new',
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

  it('does not insert a document change request when its suggestion link is missing', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({ id: 'amendment-1', discussions: [] })
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        document_id: 'document-1',
        discussions: [],
        status: 'active',
        editing_mode: 'suggest_internal',
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' });

    await expect(
      amendmentSharedMutators.createChangeRequest.fn({
        tx,
        ctx,
        args: createArgs({ process_branch_id: 'branch-1' }),
      })
    ).rejects.toThrow('linked document suggestion not found');

    expect(tx.mutate.change_request.insert).not.toHaveBeenCalled();
  });

  it('allows a city design change request without a document suggestion link', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce({ id: 'amendment-1', discussions: [] })
      .mockResolvedValueOnce({
        id: 'branch-1',
        process_run_id: 'run-1',
        document_id: 'document-1',
        discussions: [],
        status: 'active',
        editing_mode: 'suggest_internal',
      })
      .mockResolvedValueOnce({ id: 'run-1', amendment_id: 'amendment-1' })
      .mockResolvedValueOnce([]);

    await amendmentSharedMutators.createChangeRequest.fn({
      tx,
      ctx,
      args: createArgs({
        process_branch_id: 'branch-1',
        discussion_id: null,
        source_type: 'city_design_object',
      }),
    });

    expect(tx.mutate.change_request.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-new',
        source_type: 'city_design_object',
        suggestion_id: null,
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
