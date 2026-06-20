import { describe, expect, it, vi } from 'vitest';

const { applySuggestionToContentMock } = vi.hoisted(() => ({
  applySuggestionToContentMock: vi.fn(() => [{ type: 'p', children: [{ text: 'updated' }] }]),
}));

vi.mock('@/features/change-requests/logic/applySuggestionToContent', () => ({
  applySuggestionToContent: applySuggestionToContentMock,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (_key: string, _params?: unknown, fallback?: string) => fallback ?? 'Change Request',
}));

import { resolveChangeRequestByVoteResult } from '../server-resolution';

function createTx(rows: unknown[]) {
  const remainingRows = [...rows];

  return {
    run: vi.fn(async () => {
      if (remainingRows.length === 0) {
        throw new Error('Unexpected query');
      }
      return remainingRows.shift();
    }),
    mutate: {
      document_version: {
        insert: vi.fn(),
      },
      document: {
        update: vi.fn(),
      },
      amendment: {
        update: vi.fn(),
      },
      change_request: {
        update: vi.fn(),
      },
    },
  };
}

describe('resolveChangeRequestByVoteResult', () => {
  it('accepts a passed change request vote and applies the linked suggestion', async () => {
    const originalContent = [{ type: 'p', children: [{ text: 'original' }] }];
    const tx = createTx([
      {
        id: 'cr-1',
        amendment_id: 'amendment-1',
        title: 'CR-1',
      },
      {
        id: 'amendment-1',
        document_id: 'doc-1',
        discussions: [
          {
            id: 'suggestion-1',
            crId: 'CR-1',
            changeRequestEntityId: 'cr-1',
          },
        ],
      },
      {
        id: 'doc-1',
        content: originalContent,
      },
      {
        version_number: 4,
      },
    ]);

    await resolveChangeRequestByVoteResult({
      tx: tx as never,
      ctx: { userID: 'user-1' },
      changeRequestId: 'cr-1',
      voteResult: 'passed',
      now: 1_000,
    });

    expect(applySuggestionToContentMock).toHaveBeenCalledWith(
      originalContent,
      'suggestion-1',
      'accept'
    );
    expect(tx.mutate.document_version.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 'doc-1',
        amendment_id: 'amendment-1',
        version_number: 5,
        author_id: 'user-1',
      })
    );
    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'amendment-1',
        discussions: [expect.objectContaining({ id: 'suggestion-1', status: 'accepted' })],
      })
    );
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith({
      id: 'cr-1',
      status: 'accepted',
      voting_status: 'completed',
      resolved_in_mode: 'vote_event',
      resolution_method: 'event_vote',
      visibility_scope: 'public',
      updated_at: 1_000,
    });
  });
});
