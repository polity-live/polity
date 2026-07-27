import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  applyChangeRequestVoteResultToContentMock,
  findChangeRequestDiscussionMock,
  getChangeRequestResolutionStatusMock,
  isCityDesignSourceTypeMock,
  resolveChangeRequestByVoteResultMock,
} = vi.hoisted(() => ({
  applyChangeRequestVoteResultToContentMock: vi.fn((content, suggestionId, voteResult) => [
    ...content,
    { type: 'p', children: [{ text: `${suggestionId}:${voteResult}` }] },
  ]),
  findChangeRequestDiscussionMock: vi.fn(
    (discussions, changeRequest) =>
      discussions.find(
        (discussion: any) =>
          discussion.id === changeRequest.suggestion_id ||
          discussion.changeRequestEntityId === changeRequest.id ||
          (changeRequest.title &&
            (discussion.crId === changeRequest.title || discussion.title === changeRequest.title))
      ) ?? (changeRequest.suggestion_id ? { id: changeRequest.suggestion_id } : undefined)
  ),
  getChangeRequestResolutionStatusMock: vi.fn(voteResult =>
    voteResult === 'passed' ? 'accepted' : 'rejected'
  ),
  isCityDesignSourceTypeMock: vi.fn<(sourceType?: string | null) => boolean>(() => false),
  resolveChangeRequestByVoteResultMock: vi.fn(),
}));

vi.mock('../server-resolution', () => ({
  applyChangeRequestVoteResultToContent: applyChangeRequestVoteResultToContentMock,
  findChangeRequestDiscussion: findChangeRequestDiscussionMock,
  getChangeRequestResolutionStatus: getChangeRequestResolutionStatusMock,
  isCityDesignSourceType: isCityDesignSourceTypeMock,
  resolveChangeRequestByVoteResult: resolveChangeRequestByVoteResultMock,
}));

import {
  finalizeInternalChangeRequestsForEventPhaseTransition,
  maybeFinalizeInternalChangeRequestVote,
  normalizeInternalCRVotingCloseTrigger,
  repairInternalChangeRequestResolution,
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

const amendmentVoteRight = {
  resource: 'amendments',
  action: 'vote',
  amendment_id: 'amendment-1',
};

function votingCollaborator(userId: string, status = 'collaborator') {
  return {
    user_id: userId,
    status,
    role: {
      action_rights: [amendmentVoteRight],
    },
  };
}

describe('internal change request voting close rules', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    applyChangeRequestVoteResultToContentMock.mockClear();
    findChangeRequestDiscussionMock.mockClear();
    getChangeRequestResolutionStatusMock.mockClear();
    isCityDesignSourceTypeMock.mockReset();
    isCityDesignSourceTypeMock.mockReturnValue(false);
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
      [
        votingCollaborator('user-1'),
        votingCollaborator('user-2', 'admin'),
        {
          user_id: 'user-3',
          status: 'member',
          role: { action_rights: [{ resource: 'amendments', action: 'view' }] },
        },
      ],
      votes,
      openChangeRequest,
      [votingCollaborator('user-1'), votingCollaborator('user-2', 'admin')],
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
      [votingCollaborator('user-1'), votingCollaborator('user-2')],
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

  it('does not treat legacy created_in_mode values as internal change requests', async () => {
    const tx = createTx([
      {
        id: 'amendment-1',
        discussions: [],
      },
      [
        {
          ...openChangeRequest,
          created_in_mode: 'internal_suggestion',
        },
      ],
    ]);

    const result = await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx: tx as never,
      ctx: { userID: 'manager-1' },
      amendmentId: 'amendment-1',
      now: 100_000,
    });

    expect(result).toEqual([]);
    expect(tx.mutate.change_request.update).not.toHaveBeenCalled();
  });

  it('finalizes open internal CRs on event transition with one shared document state', async () => {
    const originalContent = [
      {
        type: 'p',
        children: [
          { text: 'first', suggestion_insert: { id: 'suggestion-1', type: 'insert' } },
          { text: 'second', suggestion_remove: { id: 'suggestion-2', type: 'remove' } },
        ],
      },
    ];
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
      created_in_mode: 'suggest_internal',
      created_at: 2_000,
    };
    const tx = createTx([
      {
        id: 'amendment-1',
        internal_cr_voting_close_trigger: 'after_minutes',
        document_id: 'doc-1',
        discussions: [
          { id: 'suggestion-1', changeRequestEntityId: 'cr-1', crId: 'CR-1' },
          { id: 'suggestion-2', crId: 'CR-2' },
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
      [votingCollaborator('user-1')],
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
          expect.objectContaining({
            id: 'suggestion-2',
            changeRequestEntityId: 'cr-2',
            status: 'rejected',
          }),
        ],
      })
    );
  });

  it('finalizes city design internal CRs on event transition through the generic resolver', async () => {
    isCityDesignSourceTypeMock.mockImplementation(
      sourceType => sourceType === 'city_design_object'
    );
    resolveChangeRequestByVoteResultMock.mockResolvedValue({
      changeRequest: { id: 'cr-street' },
      status: 'accepted',
    });
    const tx = createTx([
      {
        id: 'amendment-1',
        internal_cr_voting_close_trigger: 'all_collaborators_voted',
        document_id: null,
        discussions: [],
      },
      [
        {
          ...openChangeRequest,
          id: 'cr-street',
          title: 'CR-1',
          source_type: 'city_design_object',
          created_in_mode: 'suggest_internal',
        },
      ],
      [votingCollaborator('user-1')],
      [{ id: 'vote-1', user_id: 'user-1', vote: 'accept', created_at: 1_000 }],
    ]);

    const result = await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx: tx as never,
      ctx: { userID: 'manager-1' },
      amendmentId: 'amendment-1',
      now: 5_000,
    });

    expect(result).toEqual([{ changeRequest: { id: 'cr-street' }, status: 'accepted' }]);
    expect(resolveChangeRequestByVoteResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        changeRequestId: 'cr-street',
        voteResult: 'passed',
        resolutionMethod: 'internal_vote',
        resolvedInMode: 'vote_internal',
      })
    );
    expect(applyChangeRequestVoteResultToContentMock).not.toHaveBeenCalled();
    expect(tx.mutate.document.update).not.toHaveBeenCalled();
  });

  it('uses the durable suggestion id when branch discussions no longer contain the link', async () => {
    const originalContent = [
      {
        type: 'p',
        children: [{ text: 'inserted', suggestion_insert: { id: 'suggestion-1', type: 'insert' } }],
      },
    ];
    const tx = createTx([
      {
        id: 'amendment-1',
        document_id: 'doc-1',
        discussions: [],
      },
      [
        {
          ...openChangeRequest,
          created_in_mode: 'suggest_internal',
          suggestion_id: 'suggestion-1',
        },
      ],
      { id: 'doc-1', content: originalContent },
      [votingCollaborator('user-1')],
      [{ id: 'vote-1', user_id: 'user-1', vote: 'accept', created_at: 1_000 }],
      { version_number: 1 },
    ]);

    await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx: tx as never,
      ctx: { userID: 'manager-1' },
      amendmentId: 'amendment-1',
      now: 5_000,
    });

    expect(applyChangeRequestVoteResultToContentMock).toHaveBeenCalledWith(
      originalContent,
      'suggestion-1',
      'passed'
    );
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cr-1', status: 'accepted' })
    );
  });

  it('applies duplicated logical CRs only once using the voted row as canonical', async () => {
    const originalContent = [
      {
        type: 'p',
        children: [
          { text: 'original ' },
          { text: 'insert', suggestion_insert: { id: 'suggestion-1', type: 'insert' } },
        ],
      },
    ];
    const votesForCanonical = [
      { id: 'vote-1', user_id: 'user-1', vote: 'accept', created_at: 1_000 },
    ];
    const tx = createTx([
      {
        id: 'amendment-1',
        document_id: 'doc-1',
        discussions: [
          {
            id: 'suggestion-1',
            crId: 'CR-1',
            title: 'Replace dieser',
            changeRequestEntityId: 'cr-duplicate',
          },
        ],
      },
      [
        {
          ...openChangeRequest,
          id: 'cr-duplicate',
          title: 'CR-1',
          created_at: 1_000,
        },
        {
          ...openChangeRequest,
          id: 'cr-voted',
          title: 'Replace dieser',
          votes_for: 1,
          votes_against: 0,
          votes_abstain: 0,
          created_at: 2_000,
        },
      ],
      {
        id: 'doc-1',
        content: originalContent,
      },
      [votingCollaborator('user-1')],
      votesForCanonical,
      { version_number: 4 },
    ]);

    await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx: tx as never,
      ctx: { userID: 'manager-1' },
      amendmentId: 'amendment-1',
      now: 5_000,
    });

    expect(applyChangeRequestVoteResultToContentMock).toHaveBeenCalledTimes(1);
    expect(applyChangeRequestVoteResultToContentMock).toHaveBeenCalledWith(
      originalContent,
      'suggestion-1',
      'passed'
    );
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-voted',
        status: 'accepted',
        votes_for: 1,
        voting_status: 'completed',
      })
    );
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cr-duplicate',
        status: 'accepted',
        votes_for: 1,
        voting_status: 'completed',
      })
    );
    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'amendment-1',
        discussions: [
          expect.objectContaining({
            id: 'suggestion-1',
            changeRequestEntityId: 'cr-voted',
            status: 'accepted',
          }),
        ],
      })
    );
  });

  it('repairs resolved internal CRs by replaying canonical results from the pre-event version', async () => {
    const currentContent = [{ type: 'p', children: [{ text: 'broken' }] }];
    const baseContent = [
      {
        type: 'p',
        children: [
          { text: 'original ' },
          { text: 'insert', suggestion_insert: { id: 'suggestion-1', type: 'insert' } },
        ],
      },
    ];
    const repairedContent = [
      ...baseContent,
      { type: 'p', children: [{ text: 'suggestion-1:passed' }] },
    ];
    const tx = createTx([
      {
        id: 'amendment-1',
        document_id: 'doc-1',
        discussions: [{ id: 'suggestion-1', crId: 'CR-1', title: 'Replace dieser' }],
      },
      {
        id: 'doc-1',
        content: currentContent,
      },
      {
        id: 'version-before-event',
        content: baseContent,
        version_number: 4,
      },
      [
        {
          ...openChangeRequest,
          id: 'cr-voted',
          title: 'Replace dieser',
          status: 'accepted',
          voting_status: 'completed',
          resolution_method: 'internal_vote',
          created_at: 1_000,
          votes_for: 1,
          votes_against: 0,
          votes_abstain: 0,
        },
      ],
      { version_number: 5 },
    ]);

    await repairInternalChangeRequestResolution({
      tx: tx as never,
      ctx: { userID: 'manager-1' },
      amendmentId: 'amendment-1',
      now: 6_000,
    });

    expect(applyChangeRequestVoteResultToContentMock).toHaveBeenCalledWith(
      baseContent,
      'suggestion-1',
      'passed'
    );
    expect(tx.mutate.document_version.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 'doc-1',
        amendment_id: 'amendment-1',
        content: currentContent,
        version_number: 6,
        change_summary: 'Repair internal change request resolution',
      })
    );
    expect(tx.mutate.document.update).toHaveBeenCalledWith({
      id: 'doc-1',
      content: repairedContent,
      updated_at: 6_000,
    });
  });

  it('does not close internal CRs on event transition when the document marker is missing', async () => {
    const tx = createTx([
      {
        id: 'amendment-1',
        document_id: 'doc-1',
        discussions: [{ id: 'suggestion-1', changeRequestEntityId: 'cr-1', crId: 'CR-1' }],
      },
      [
        {
          ...openChangeRequest,
          title: 'CR-1',
          created_in_mode: 'suggest_internal',
          created_at: 1_000,
        },
      ],
      {
        id: 'doc-1',
        content: [{ type: 'p', children: [{ text: 'plain content' }] }],
      },
    ]);

    await expect(
      finalizeInternalChangeRequestsForEventPhaseTransition({
        tx: tx as never,
        ctx: { userID: 'manager-1' },
        amendmentId: 'amendment-1',
        now: 5_000,
      })
    ).rejects.toThrow('linked suggestion is not present');

    expect(tx.mutate.document_version.insert).not.toHaveBeenCalled();
    expect(tx.mutate.document.update).not.toHaveBeenCalled();
    expect(tx.mutate.change_request.update).not.toHaveBeenCalled();
  });
});
