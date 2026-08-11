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

import {
  applyChangeRequestVoteResultToContent,
  findChangeRequestDiscussion,
  getChangeRequestResolutionStatus,
  isCityDesignSourceType,
  resolveChangeRequestByVoteResult,
} from '../server-resolution';

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
          { id: 'other-suggestion', crId: 'CR-99' },
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
        discussions: expect.arrayContaining([
          expect.objectContaining({ id: 'suggestion-1', status: 'accepted' }),
          expect.objectContaining({ id: 'other-suggestion' }),
        ]),
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

  it('resolves a change request by its durable suggestion id without discussion metadata', async () => {
    const originalContent = [
      {
        type: 'p',
        children: [
          { text: 'removed', suggestion_remove: { id: 'suggestion-durable', type: 'remove' } },
        ],
      },
    ];
    const tx = createTx([
      {
        id: 'cr-1',
        amendment_id: 'amendment-1',
        suggestion_id: 'suggestion-durable',
        title: 'CR-1',
      },
      {
        id: 'amendment-1',
        document_id: 'doc-1',
        discussions: { malformed: true },
      },
      {
        id: 'doc-1',
        content: originalContent,
      },
      {
        version_number: 1,
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
      'suggestion-durable',
      'reject'
    );
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-1',
        status: 'rejected',
        voting_status: 'completed',
      })
    );
  });

  it('covers status, discussion lookup, content action, and CityDesign source contracts', () => {
    expect(getChangeRequestResolutionStatus('passed')).toBe('accepted');
    expect(getChangeRequestResolutionStatus('rejected')).toBe('rejected');
    expect(getChangeRequestResolutionStatus('tie')).toBe('rejected');

    const discussions = [
      { id: 'suggestion', crId: 'CR-1' },
      { id: 'entity-discussion', changeRequestEntityId: 'entity' },
      { id: 'title-cr-id', crId: 'Title' },
      { id: 'title-title', title: 'Other title' },
    ];
    expect(
      findChangeRequestDiscussion(discussions, {
        id: 'row',
        suggestion_id: 'suggestion',
      })?.id
    ).toBe('suggestion');
    expect(findChangeRequestDiscussion(discussions, { id: 'entity' })?.id).toBe(
      'entity-discussion'
    );
    expect(findChangeRequestDiscussion(discussions, { id: 'row', title: 'Title' })?.id).toBe(
      'title-cr-id'
    );
    expect(findChangeRequestDiscussion(discussions, { id: 'row', title: 'Other title' })?.id).toBe(
      'title-title'
    );
    expect(findChangeRequestDiscussion([], { id: 'row' })).toBeUndefined();
    expect(findChangeRequestDiscussion([], { id: 'row', suggestion_id: 'durable' })).toEqual({
      id: 'durable',
    });

    applyChangeRequestVoteResultToContent([] as never, 'suggestion', 'tie');
    expect(applySuggestionToContentMock).toHaveBeenLastCalledWith([], 'suggestion', 'reject');

    for (const type of [
      'city_design_object',
      'CITY_DESIGN_SCENE',
      ' city_design_area ',
      'city_design_layer',
      'city_design_custom',
    ]) {
      expect(isCityDesignSourceType(type)).toBe(true);
    }
    expect(isCityDesignSourceType('document')).toBe(false);
    expect(isCityDesignSourceType(null)).toBe(false);
  });

  it('returns null when the change request no longer exists', async () => {
    const tx = createTx([null]);

    await expect(
      resolveChangeRequestByVoteResult({
        tx: tx as never,
        ctx: { userID: 'user-1' },
        changeRequestId: 'missing',
        voteResult: 'passed',
      })
    ).resolves.toBeNull();
    expect(tx.mutate.change_request.update).not.toHaveBeenCalled();
  });

  it('rejects a missing main document, linked suggestion, or document content', async () => {
    const cases = [
      {
        rows: [
          { id: 'cr', amendment_id: 'amendment', title: null },
          { id: 'amendment', document_id: null, discussions: [] },
        ],
        message: 'document not found',
      },
      {
        rows: [
          { id: 'cr', amendment_id: 'amendment', title: 'CR-1' },
          { id: 'amendment', document_id: 'doc', discussions: [] },
        ],
        message: 'linked document suggestion not found',
      },
      {
        rows: [
          {
            id: 'cr',
            amendment_id: 'amendment',
            suggestion_id: 'suggestion',
            title: 'CR-1',
          },
          { id: 'amendment', document_id: 'doc', discussions: [] },
          { id: 'doc', content: null },
        ],
        message: 'document content not found',
      },
    ];

    for (const testCase of cases) {
      const tx = createTx(testCase.rows);
      await expect(
        resolveChangeRequestByVoteResult({
          tx: tx as never,
          ctx: { userID: 'user-1' },
          changeRequestId: 'cr',
          voteResult: 'passed',
          now: 1,
        })
      ).rejects.toThrow(testCase.message);
      expect(tx.mutate.change_request.update).not.toHaveBeenCalled();
    }
  });

  it('rejects missing and foreign process branches', async () => {
    const missingBranch = createTx([
      { id: 'cr', amendment_id: 'amendment', process_branch_id: 'missing' },
      { id: 'amendment', clone_source_id: 'origin' },
      null,
    ]);
    await expect(
      resolveChangeRequestByVoteResult({
        tx: missingBranch as never,
        ctx: { userID: 'user' },
        changeRequestId: 'cr',
        voteResult: 'passed',
      })
    ).rejects.toThrow('Process branch not found');

    for (const processRun of [null, { id: 'run', amendment_id: 'other' }]) {
      const foreignBranch = createTx([
        { id: 'cr', amendment_id: 'amendment', process_branch_id: 'branch' },
        { id: 'amendment', clone_source_id: 'origin' },
        { id: 'branch', process_run_id: 'run' },
        processRun,
      ]);
      await expect(
        resolveChangeRequestByVoteResult({
          tx: foreignBranch as never,
          ctx: { userID: 'user' },
          changeRequestId: 'cr',
          voteResult: 'passed',
        })
      ).rejects.toThrow('does not belong');
    }
  });

  it('rejects a valid branch without a document', async () => {
    const tx = createTx([
      { id: 'cr', amendment_id: 'amendment', process_branch_id: 'branch' },
      { id: 'amendment' },
      { id: 'branch', process_run_id: 'run', document_id: null, discussions: [] },
      { id: 'run', amendment_id: 'amendment' },
    ]);

    await expect(
      resolveChangeRequestByVoteResult({
        tx: tx as never,
        ctx: { userID: 'user' },
        changeRequestId: 'cr',
        voteResult: 'passed',
      })
    ).rejects.toThrow('document not found');
  });

  it('uses branch and version fallbacks with explicit internal-vote metadata', async () => {
    const content = [
      {
        type: 'p',
        children: [{ text: 'new', suggestion_insert: { id: 'durable', type: 'insert' } }],
      },
    ];
    const tx = createTx([
      {
        id: 'cr',
        amendment_id: 'amendment',
        process_branch_id: 'branch',
        suggestion_id: 'durable',
        title: null,
      },
      { id: 'amendment' },
      { id: 'branch', process_run_id: 'run', document_id: 'doc', discussions: null },
      { id: 'run', amendment_id: 'amendment' },
      { id: 'doc', content },
      null,
    ]);

    await resolveChangeRequestByVoteResult({
      tx: tx as never,
      ctx: { userID: 'user' },
      changeRequestId: 'cr',
      voteResult: 'passed',
      now: 5,
      resolutionMethod: 'internal_vote',
      visibilityScope: 'collaborators',
    });

    expect(tx.mutate.document_version.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        version_number: 1,
        change_summary: 'Change Request accepted by vote',
      })
    );
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        resolved_in_mode: 'vote_internal',
        resolution_method: 'internal_vote',
        visibility_scope: 'collaborators',
      })
    );
    expect(tx.mutate.amendment_process_branch.update).not.toHaveBeenCalled();
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
