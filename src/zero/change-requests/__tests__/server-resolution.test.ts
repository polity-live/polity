import { afterEach, describe, expect, it, vi } from 'vitest';

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
      amendment_process_branch: {
        update: vi.fn(),
      },
      change_request: {
        update: vi.fn(),
      },
    },
  };
}

describe('resolveChangeRequestByVoteResult', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a passed change request vote and applies the linked suggestion', async () => {
    const originalContent = [
      {
        type: 'p',
        children: [
          { text: 'original ' },
          { text: 'inserted', suggestion_insert: { id: 'suggestion-1', type: 'insert' } },
        ],
      },
    ];
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
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-1',
        status: 'accepted',
        voting_status: 'completed',
        resolved_in_mode: 'event_final_closing_vote',
        resolution_method: null,
        visibility_scope: 'public',
        change_type: 'insert',
        new_text: 'inserted',
        updated_at: 1_000,
      })
    );
  });

  it('matches a discussion by title and backfills the persisted change request link', async () => {
    const originalContent = [
      {
        type: 'p',
        children: [
          { text: 'original ' },
          { text: 'replacement', suggestion_replace: { id: 'suggestion-1', type: 'replace' } },
        ],
      },
    ];
    const tx = createTx([
      {
        id: 'cr-1',
        amendment_id: 'amendment-1',
        title: 'Replace dieser',
      },
      {
        id: 'amendment-1',
        document_id: 'doc-1',
        discussions: [
          {
            id: 'suggestion-1',
            crId: 'CR-1',
            title: 'Replace dieser',
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
      voteResult: 'rejected',
      now: 1_000,
    });

    expect(applySuggestionToContentMock).toHaveBeenCalledWith(
      originalContent,
      'suggestion-1',
      'reject'
    );
    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'amendment-1',
        discussions: [
          expect.objectContaining({
            id: 'suggestion-1',
            changeRequestEntityId: 'cr-1',
            status: 'rejected',
          }),
        ],
      })
    );
  });

  it('applies a branch-scoped change request only to the branch document and discussions', async () => {
    const originalContent = [
      {
        type: 'p',
        children: [
          { text: 'branch original ' },
          {
            text: 'branch insert',
            suggestion_insert: { id: 'suggestion-branch', type: 'insert' },
          },
        ],
      },
    ];
    const tx = createTx([
      {
        id: 'cr-branch',
        amendment_id: 'amendment-1',
        process_branch_id: 'branch-1',
        title: 'CR-B1',
      },
      {
        id: 'amendment-1',
        origin_amendment_id: 'amendment-1',
        document_id: 'doc-main',
        discussions: [],
      },
      {
        id: 'branch-1',
        process_run_id: 'run-1',
        document_id: 'doc-branch',
        discussions: [
          {
            id: 'suggestion-branch',
            crId: 'CR-B1',
            changeRequestEntityId: 'cr-branch',
          },
        ],
      },
      {
        id: 'run-1',
        amendment_id: 'amendment-1',
      },
      {
        id: 'doc-branch',
        content: originalContent,
      },
      {
        version_number: 2,
      },
    ]);

    await resolveChangeRequestByVoteResult({
      tx: tx as never,
      ctx: { userID: 'user-1' },
      changeRequestId: 'cr-branch',
      voteResult: 'passed',
      now: 2_000,
    });

    expect(applySuggestionToContentMock).toHaveBeenCalledWith(
      originalContent,
      'suggestion-branch',
      'accept'
    );
    expect(tx.mutate.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-branch',
      })
    );
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'branch-1',
        discussions: [expect.objectContaining({ id: 'suggestion-branch', status: 'accepted' })],
      })
    );
    expect(tx.mutate.amendment.update).not.toHaveBeenCalled();
  });

  it('does not close the change request when the linked suggestion marker is missing', async () => {
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
        content: [{ type: 'p', children: [{ text: 'plain content' }] }],
      },
    ]);

    await expect(
      resolveChangeRequestByVoteResult({
        tx: tx as never,
        ctx: { userID: 'user-1' },
        changeRequestId: 'cr-1',
        voteResult: 'passed',
        now: 1_000,
      })
    ).rejects.toThrow('linked suggestion is not present');

    expect(tx.mutate.document_version.insert).not.toHaveBeenCalled();
    expect(tx.mutate.document.update).not.toHaveBeenCalled();
    expect(tx.mutate.change_request.update).not.toHaveBeenCalled();
  });
});
