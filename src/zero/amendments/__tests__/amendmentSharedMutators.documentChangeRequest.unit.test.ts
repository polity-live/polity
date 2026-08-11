import { afterEach, describe, expect, it, vi } from 'vitest';
import { amendmentSharedMutators } from '../shared-mutators';

const baseArgs = {
  id: 'change-request-1',
  amendment_id: 'amendment-1',
  process_branch_id: null,
  discussion_id: 'suggestion-1',
  title: 'CR-1',
  description: '',
  status: 'open',
  source_type: null,
  source_id: null,
  source_title: null,
  reason: null,
  changed_character_count: 3,
  voting_status: 'open',
  voting_deadline: 0,
  voting_majority_type: null,
  quorum_required: null,
  document_content: [
    {
      type: 'p',
      children: [
        {
          text: 'Neu',
          suggestion: true,
          suggestion_suggestion_1: { id: 'suggestion-1', type: 'insert' },
        },
      ],
    },
  ],
  discussions: [{ id: 'suggestion-1', changeRequestEntityId: 'change-request-1' }],
};

function createTx() {
  return {
    run: vi.fn().mockResolvedValue({
      id: 'amendment-1',
      document_id: 'document-1',
      discussions: [],
    }),
    mutate: {
      document: { update: vi.fn() },
      amendment: { update: vi.fn() },
      amendment_process_branch: { update: vi.fn() },
    },
  };
}

function createQueuedTx(values: unknown[]) {
  const tx = createTx();
  tx.run.mockImplementation(async () => values.shift());
  return tx;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('amendmentSharedMutators.createDocumentChangeRequest', () => {
  it('writes content and discussions in the same mutation before creating the row', async () => {
    const tx = createTx();
    const createChangeRequestSpy = vi
      .spyOn(amendmentSharedMutators.createChangeRequest, 'fn')
      .mockResolvedValue(undefined);

    await amendmentSharedMutators.createDocumentChangeRequest.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: baseArgs,
    });

    expect(tx.mutate.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'document-1',
        content: baseArgs.document_content,
      })
    );
    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'amendment-1',
        discussions: baseArgs.discussions,
      })
    );
    expect(createChangeRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.not.objectContaining({
          document_content: expect.anything(),
          discussions: expect.anything(),
        }),
      })
    );
  });

  it('performs no writes when the linked marker is missing', async () => {
    const tx = createTx();
    const createChangeRequestSpy = vi
      .spyOn(amendmentSharedMutators.createChangeRequest, 'fn')
      .mockResolvedValue(undefined);

    await expect(
      amendmentSharedMutators.createDocumentChangeRequest.fn({
        tx: tx as never,
        ctx: { userID: 'user-1' } as never,
        args: {
          ...baseArgs,
          document_content: [{ type: 'p', children: [{ text: 'Ohne Marker' }] }],
        },
      })
    ).rejects.toThrow('linked suggestion is not present in the document');

    expect(tx.mutate.document.update).not.toHaveBeenCalled();
    expect(tx.mutate.amendment.update).not.toHaveBeenCalled();
    expect(createChangeRequestSpy).not.toHaveBeenCalled();
  });

  it('rejects city-design requests and missing amendment documents before writing', async () => {
    const cityDesign = createTx();
    await expect(
      amendmentSharedMutators.createDocumentChangeRequest.fn({
        tx: cityDesign as never,
        ctx: { userID: 'user-1' } as never,
        args: { ...baseArgs, source_type: 'city_design_object' },
      })
    ).rejects.toThrow('cannot be used for city design');
    expect(cityDesign.run).not.toHaveBeenCalled();

    const missingAmendment = createQueuedTx([null]);
    await expect(
      amendmentSharedMutators.createDocumentChangeRequest.fn({
        tx: missingAmendment as never,
        ctx: { userID: 'user-1' } as never,
        args: baseArgs,
      })
    ).rejects.toThrow('Amendment not found');

    const missingDocument = createQueuedTx([{ id: 'amendment-1', document_id: null }]);
    await expect(
      amendmentSharedMutators.createDocumentChangeRequest.fn({
        tx: missingDocument as never,
        ctx: { userID: 'user-1' } as never,
        args: baseArgs,
      })
    ).rejects.toThrow('document not found');
    expect(missingDocument.mutate.document.update).not.toHaveBeenCalled();
  });

  it('writes branch-scoped document discussions through the process branch', async () => {
    const tx = createQueuedTx([
      { id: 'amendment-1', origin_amendment_id: 'amendment-1', document_id: 'main-document' },
      {
        id: 'branch-1',
        process_run_id: 'run-1',
        document_id: 'branch-document',
        status: 'active',
        resolution: null,
      },
      { id: 'run-1', amendment_id: 'amendment-1' },
    ]);
    const createChangeRequestSpy = vi
      .spyOn(amendmentSharedMutators.createChangeRequest, 'fn')
      .mockResolvedValue(undefined);

    await amendmentSharedMutators.createDocumentChangeRequest.fn({
      tx: tx as never,
      ctx: { userID: 'user-1' } as never,
      args: { ...baseArgs, process_branch_id: 'branch-1' },
    });

    expect(tx.mutate.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'branch-document' })
    );
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'branch-1', discussions: baseArgs.discussions })
    );
    expect(tx.mutate.amendment.update).not.toHaveBeenCalled();
    expect(createChangeRequestSpy).toHaveBeenCalledOnce();
  });
});
