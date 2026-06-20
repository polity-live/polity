import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  applyChangeRequestVoteResultToContentMock,
  findChangeRequestDiscussionMock,
  getChangeRequestResolutionStatusMock,
  resolveChangeRequestByVoteResultMock,
} = vi.hoisted(() => ({
  applyChangeRequestVoteResultToContentMock: vi.fn((content, suggestionId, voteResult) => [
    ...content,
    { type: 'p', children: [{ text: `${suggestionId}:${voteResult}` }] },
  ]),
  findChangeRequestDiscussionMock: vi.fn((discussions, changeRequest) =>
    discussions.find(
      (discussion: any) =>
        discussion.changeRequestEntityId === changeRequest.id ||
        (changeRequest.title && discussion.crId === changeRequest.title)
    )
  ),
  getChangeRequestResolutionStatusMock: vi.fn(voteResult =>
    voteResult === 'passed' ? 'accepted' : 'rejected'
  ),
  resolveChangeRequestByVoteResultMock: vi.fn(),
}));

vi.mock('../server-resolution', () => ({
  applyChangeRequestVoteResultToContent: applyChangeRequestVoteResultToContentMock,
  findChangeRequestDiscussion: findChangeRequestDiscussionMock,
  getChangeRequestResolutionStatus: getChangeRequestResolutionStatusMock,
  resolveChangeRequestByVoteResult: resolveChangeRequestByVoteResultMock,
}));

import {
  finalizeInternalChangeRequestsForEventPhaseTransition,
  maybeFinalizeInternalChangeRequestVote,
  normalizeInternalCRVotingCloseTrigger,
} from '../internal-voting';

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
      change_request: {
        update: vi.fn(),
      },
      change_request_vote: {
        delete: vi.fn(),
      },
      document: {
        update: vi.fn(),
      },
      document_version: {
        insert: vi.fn(),
      },
      amendment: {
        update: vi.fn(),
      },
    },
  };
}

const openChangeRequest = {
  id: 'cr-1',
  amendment_id: 'amendment-1',
  status: 'open',
  voting_status: 'open',
};

describe('internal change request voting close rules', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    applyChangeRequestVoteResultToContentMock.mockClear();
    findChangeRequestDiscussionMock.mockClear();
    getChangeRequestResolutionStatusMock.mockClear();
    resolveChangeRequestByVoteResultMock.mockReset();
  });

  it('finalizes once every active collaborator has voted', async () => {
    const votes = [
      { id: 'vote-1', user_id: 'user-1', vote: 'accept', created_at: 1_000 },
      { id: 'vote-2', user_id: 'user-2', vote: 'accept', created_at: 1_100 },
    ];
    const tx = createTx([
      openChangeRequest,
      {
        id: 'amendment-1',
        internal_cr_voting_close_trigger: 'all_collaborators_voted',
      },
      votes,
      [
        { user_id: 'user-1', status: 'collaborator' },
        { user_id: 'user-2', status: 'admin' },
      ],
      openChangeRequest,
      votes,
      {
        id: 'amendment-1',
        internal_cr_resolution_visibility: 'public',
      },
    ]);

    await maybeFinalizeInternalChangeRequestVote({
      tx: tx as never,
      ctx: { userID: 'manager-1' },
      changeRequestId: 'cr-1',
      reason: 'after_vote',
      now: 5_000,
    });

    expect(resolveChangeRequestByVoteResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: 'cr-1',
        voteResult: 'passed',
        resolutionMethod: 'internal_vote',
        resolvedInMode: 'vote_internal',
        visibilityScope: 'public',
      })
    );
  });

  it('finalizes expired minute-based votes and rejects ties', async () => {
    const votes = [
      { id: 'vote-1', user_id: 'user-1', vote: 'accept', created_at: 1_000 },
      { id: 'vote-2', user_id: 'user-2', vote: 'reject', created_at: 1_100 },
    ];
    const tx = createTx([
      { ...openChangeRequest, voting_deadline: 4_000 },
      {
        id: 'amendment-1',
        internal_cr_voting_close_trigger: 'after_minutes',
      },
      { ...openChangeRequest, voting_deadline: 4_000 },
      votes,
      {
        id: 'amendment-1',
        internal_cr_resolution_visibility: 'public',
      },
    ]);

    await maybeFinalizeInternalChangeRequestVote({
      tx: tx as never,
      ctx: { userID: 'manager-1' },
      changeRequestId: 'cr-1',
      reason: 'deadline',
      now: 5_000,
    });

    expect(resolveChangeRequestByVoteResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: 'cr-1',
        voteResult: 'rejected',
      })
    );
  });

  it('normalizes the removed event-transition option to the default close trigger', () => {
    expect(normalizeInternalCRVotingCloseTrigger('on_event_phase_transition')).toBe(
      'all_collaborators_voted'
    );
  });

  it('finalizes open internal CRs on event transition with one shared document state', async () => {
    const originalContent = [{ type: 'p', children: [{ text: 'original' }] }];
    const firstAppliedContent = [
      ...originalContent,
      { type: 'p', children: [{ text: 'suggestion-1:passed' }] },
    ];
    const secondAppliedContent = [
      ...firstAppliedContent,
      { type: 'p', children: [{ text: 'suggestion-2:rejected' }] },
    ];
    const votesForFirst = [{ id: 'vote-1', user_id: 'user-1', vote: 'accept', created_at: 1_000 }];
    const votesForSecond = [{ id: 'vote-2', user_id: 'user-1', vote: 'reject', created_at: 1_100 }];
    const secondOpenChangeRequest = {
      ...openChangeRequest,
      id: 'cr-2',
      title: 'CR-2',
      created_at: 2_000,
    };
    const tx = createTx([
      {
        id: 'amendment-1',
        internal_cr_voting_close_trigger: 'after_minutes',
        document_id: 'doc-1',
        discussions: [
          { id: 'suggestion-1', changeRequestEntityId: 'cr-1', crId: 'CR-1' },
          { id: 'suggestion-2', changeRequestEntityId: 'cr-2', crId: 'CR-2' },
        ],
      },
      [
        { ...openChangeRequest, title: 'CR-1', created_at: 1_000, voting_deadline: 99_000 },
        secondOpenChangeRequest,
      ],
      {
        id: 'doc-1',
        content: originalContent,
      },
      votesForFirst,
      { version_number: 4 },
      votesForSecond,
    ]);

    await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx: tx as never,
      ctx: { userID: 'manager-1' },
      amendmentId: 'amendment-1',
      now: 5_000,
    });

    expect(resolveChangeRequestByVoteResultMock).not.toHaveBeenCalled();
    expect(applyChangeRequestVoteResultToContentMock).toHaveBeenNthCalledWith(
      1,
      originalContent,
      'suggestion-1',
      'passed'
    );
    expect(applyChangeRequestVoteResultToContentMock).toHaveBeenNthCalledWith(
      2,
      firstAppliedContent,
      'suggestion-2',
      'rejected'
    );
    expect(tx.mutate.document_version.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 'doc-1',
        amendment_id: 'amendment-1',
        content: originalContent,
        version_number: 5,
      })
    );
    expect(tx.mutate.document.update).toHaveBeenCalledWith({
      id: 'doc-1',
      content: secondAppliedContent,
      updated_at: 5_000,
    });
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-1',
        status: 'accepted',
        voting_status: 'completed',
        resolved_in_mode: 'vote_internal',
        resolution_method: 'internal_vote',
        visibility_scope: 'public',
      })
    );
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-2',
        status: 'rejected',
        voting_status: 'completed',
        resolved_in_mode: 'vote_internal',
        resolution_method: 'internal_vote',
        visibility_scope: 'public',
      })
    );
    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'amendment-1',
        discussions: [
          expect.objectContaining({ id: 'suggestion-1', status: 'accepted' }),
          expect.objectContaining({ id: 'suggestion-2', status: 'rejected' }),
        ],
      })
    );
  });
});
