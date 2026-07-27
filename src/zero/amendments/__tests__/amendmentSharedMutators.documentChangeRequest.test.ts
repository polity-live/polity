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
});
