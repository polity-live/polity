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
  finalizeExpiredInternalChangeRequestVotesForAmendment,
  finalizeInternalChangeRequestsForEventPhaseTransition,
  initializeInternalChangeRequestVotingForAmendment,
  maybeFinalizeInternalChangeRequestVote,
  normalizeInternalChangeRequestVoteCounts,
  normalizeInternalCRVotingCloseTrigger,
  normalizeInternalCRVotingDurationMinutes,
  repairInternalChangeRequestResolution,
  resolveInternalChangeRequestVote,
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
      amendment_process_branch: {
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

  it('normalizes close triggers and voting durations at every boundary', () => {
    expect(normalizeInternalCRVotingCloseTrigger('after_minutes')).toBe('after_minutes');
    expect(normalizeInternalCRVotingCloseTrigger(null)).toBe('all_collaborators_voted');
    expect(normalizeInternalCRVotingDurationMinutes(2.9)).toBe(2);
    expect(normalizeInternalCRVotingDurationMinutes(0.5)).toBe(1);
    expect(normalizeInternalCRVotingDurationMinutes(0)).toBe(5);
    expect(normalizeInternalCRVotingDurationMinutes(Number.NaN)).toBe(5);
    expect(normalizeInternalCRVotingDurationMinutes(undefined)).toBe(5);
    expect(normalizeInternalCRVotingDurationMinutes('5' as never)).toBe(5);
  });

  it('keeps only the latest eligible vote, removes duplicates, and counts abstentions', async () => {
    const votes = [
      { id: 'vote-a', user_id: 'user-1', vote: 'reject', created_at: null },
      { id: 'vote-z', user_id: 'user-1', vote: 'accept', created_at: null },
      { id: 'vote-2', user_id: 'user-2', vote: 'abstain', created_at: 2 },
      { id: 'vote-3', user_id: 'ineligible', vote: 'accept', created_at: 3 },
    ];
    const tx = createTx([votes]);

    const result = await normalizeInternalChangeRequestVoteCounts(
      tx as never,
      'cr-1',
      10,
      new Set(['user-1', 'user-2'])
    );

    expect(result.counts).toEqual({ votes_for: 1, votes_against: 0, votes_abstain: 1 });
    expect(tx.mutate.change_request_vote.delete).toHaveBeenCalledWith({ id: 'vote-a' });
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith({
      id: 'cr-1',
      votes_for: 1,
      votes_against: 0,
      votes_abstain: 1,
      updated_at: 10,
    });

    const unrestricted = createTx([[{ id: 'vote', user_id: 'any', vote: 'reject' }]]);
    const unrestrictedResult = await normalizeInternalChangeRequestVoteCounts(
      unrestricted as never,
      'cr-2'
    );
    expect(unrestrictedResult.counts.votes_against).toBe(1);
  });

  it('returns early for missing or completed direct resolutions', async () => {
    for (const changeRequest of [null, { ...openChangeRequest, status: 'approved' }]) {
      const tx = createTx([changeRequest]);
      await expect(
        resolveInternalChangeRequestVote({
          tx: tx as never,
          ctx: { userID: 'manager' },
          changeRequestId: 'cr-1',
        })
      ).resolves.toBeNull();
    }
  });

  it('deduplicates eligible collaborators and honors scoped vote rights', async () => {
    const collaborators = [
      { user_id: 'missing-role' },
      { user_id: 'missing-rights', role: {} },
      {
        user_id: 'wrong-resource',
        role: { action_rights: [{ resource: 'blogs', action: 'vote' }] },
      },
      {
        user_id: 'wrong-action',
        role: { action_rights: [{ resource: 'amendments', action: 'view' }] },
      },
      {
        user_id: 'wrong-amendment',
        role: {
          action_rights: [{ resource: 'amendments', action: 'vote', amendment_id: 'other' }],
        },
      },
      {
        user_id: 'wrong-nested-amendment',
        role: {
          action_rights: [{ resource: 'amendments', action: 'vote', amendment: { id: 'other' } }],
        },
      },
      votingCollaborator('eligible'),
      votingCollaborator('eligible'),
      {
        user_id: 42,
        role: { action_rights: [{ resource: 'amendments', action: 'vote' }] },
      },
    ];
    const tx = createTx([
      openChangeRequest,
      collaborators,
      [
        { id: 'eligible-vote', user_id: 'eligible', vote: 'accept' },
        { id: 'ignored-vote', user_id: 'wrong-action', vote: 'reject' },
      ],
      null,
    ]);

    await resolveInternalChangeRequestVote({
      tx: tx as never,
      ctx: { userID: 'manager' },
      changeRequestId: 'cr-1',
      now: 20,
    });

    expect(resolveChangeRequestByVoteResultMock).toHaveBeenCalledWith(
      expect.objectContaining({ voteResult: 'passed', visibilityScope: 'public' })
    );
  });

  it('initializes deadlines only for open requests in the requested branch scope', async () => {
    const requests = [
      { ...openChangeRequest, id: 'main-open', process_branch_id: null },
      { ...openChangeRequest, id: 'branch-open', process_branch_id: 'branch-1' },
      { ...openChangeRequest, id: 'accepted', status: 'accepted', process_branch_id: null },
      {
        ...openChangeRequest,
        id: 'completed',
        voting_status: 'completed',
        process_branch_id: null,
      },
    ];
    const minuteTx = createTx([requests]);
    await initializeInternalChangeRequestVotingForAmendment({
      tx: minuteTx as never,
      amendment: {
        id: 'amendment-1',
        internal_cr_voting_close_trigger: 'after_minutes',
        internal_cr_voting_duration_minutes: 2,
      },
      processBranchId: null,
      now: 1_000,
    });
    expect(minuteTx.mutate.change_request.update).toHaveBeenCalledTimes(1);
    expect(minuteTx.mutate.change_request.update).toHaveBeenCalledWith({
      id: 'main-open',
      voting_deadline: 121_000,
      updated_at: 1_000,
    });

    const branchTx = createTx([requests]);
    await initializeInternalChangeRequestVotingForAmendment({
      tx: branchTx as never,
      amendment: { id: 'amendment-1' },
      processBranchId: 'branch-1',
      now: 2_000,
    });
    expect(branchTx.mutate.change_request.update).toHaveBeenCalledWith({
      id: 'branch-open',
      voting_deadline: null,
      updated_at: 2_000,
    });

    const allTx = createTx([[{ ...openChangeRequest, id: 'all-open' }]]);
    await initializeInternalChangeRequestVotingForAmendment({
      tx: allTx as never,
      amendment: { id: 'amendment-1' },
    });
    expect(allTx.mutate.change_request.update).toHaveBeenCalledOnce();
  });

  it('returns early for ineligible automatic-finalization states', async () => {
    const cases = [
      [null],
      [{ ...openChangeRequest, status: 'declined' }],
      [openChangeRequest, null],
      [
        { ...openChangeRequest, voting_deadline: null },
        { id: 'amendment-1', internal_cr_voting_close_trigger: 'after_minutes' },
      ],
      [
        { ...openChangeRequest, voting_deadline: 10_000 },
        { id: 'amendment-1', internal_cr_voting_close_trigger: 'after_minutes' },
      ],
      [
        openChangeRequest,
        { id: 'amendment-1', internal_cr_voting_close_trigger: 'all_collaborators_voted' },
      ],
    ];

    for (const rows of cases) {
      const tx = createTx(rows);
      await expect(
        maybeFinalizeInternalChangeRequestVote({
          tx: tx as never,
          ctx: { userID: 'manager' },
          changeRequestId: 'cr-1',
          reason: 'deadline',
          now: 5_000,
        })
      ).resolves.toBeNull();
    }
  });

  it('does not finalize all-collaborator voting with no voters or an incomplete ballot', async () => {
    for (const [collaborators, votes] of [
      [[], []],
      [
        [votingCollaborator('user-1'), votingCollaborator('user-2')],
        [{ id: 'vote-1', user_id: 'user-1', vote: 'accept' }],
      ],
    ] as const) {
      const tx = createTx([
        openChangeRequest,
        { id: 'amendment-1', internal_cr_voting_close_trigger: 'all_collaborators_voted' },
        collaborators,
        votes,
      ]);
      await expect(
        maybeFinalizeInternalChangeRequestVote({
          tx: tx as never,
          ctx: { userID: 'manager' },
          changeRequestId: 'cr-1',
          reason: 'after_vote',
          now: 5_000,
        })
      ).resolves.toBeNull();
    }
  });

  it('ignores missing/wrong-trigger amendments and resolves only expired open votes', async () => {
    for (const amendment of [
      null,
      { id: 'amendment-1', internal_cr_voting_close_trigger: 'all_collaborators_voted' },
    ]) {
      const tx = createTx([amendment]);
      await expect(
        finalizeExpiredInternalChangeRequestVotesForAmendment({
          tx: tx as never,
          ctx: { userID: 'manager' },
          amendmentId: 'amendment-1',
        })
      ).resolves.toEqual([]);
    }

    const tx = createTx([
      { id: 'amendment-1', internal_cr_voting_close_trigger: 'after_minutes' },
      [
        { ...openChangeRequest, id: 'expired', voting_deadline: 4_000 },
        { ...openChangeRequest, id: 'future', voting_deadline: 6_000 },
        { ...openChangeRequest, id: 'none', voting_deadline: null },
        { ...openChangeRequest, id: 'final', status: 'rejected', voting_deadline: 1_000 },
      ],
      { ...openChangeRequest, id: 'expired', voting_deadline: 4_000 },
      [votingCollaborator('user-1')],
      [{ id: 'vote', user_id: 'user-1', vote: 'accept' }],
      { id: 'amendment-1' },
    ]);
    await finalizeExpiredInternalChangeRequestVotesForAmendment({
      tx: tx as never,
      ctx: { userID: 'manager' },
      amendmentId: 'amendment-1',
      now: 5_000,
    });
    expect(resolveChangeRequestByVoteResultMock).toHaveBeenCalledTimes(1);
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

  it('reports every missing repair prerequisite', async () => {
    const cases = [
      { rows: [null], message: 'Amendment document not found' },
      {
        rows: [{ id: 'amendment', document_id: 'doc' }, null],
        message: 'Amendment document content not found',
      },
      {
        rows: [{ id: 'amendment', document_id: 'doc' }, { id: 'doc', content: [] }, null],
        message: 'No pre-event change request document version found',
      },
    ];

    for (const testCase of cases) {
      const tx = createTx(testCase.rows);
      await expect(
        repairInternalChangeRequestResolution({
          tx: tx as never,
          ctx: { userID: 'manager' },
          amendmentId: 'amendment',
        })
      ).rejects.toThrow(testCase.message);
    }
  });

  it('returns an empty repair result for malformed discussions and no eligible records', async () => {
    const tx = createTx([
      { id: 'amendment', document_id: 'doc', discussions: { malformed: true } },
      { id: 'doc', content: [] },
      { id: 'base', content: [] },
      [
        { ...openChangeRequest, status: 'open', resolution_method: 'internal_vote' },
        {
          ...openChangeRequest,
          status: 'accepted',
          created_in_mode: 'suggest_event',
          resolution_method: 'internal_vote',
        },
      ],
    ]);

    await expect(
      repairInternalChangeRequestResolution({
        tx: tx as never,
        ctx: { userID: 'manager' },
        amendmentId: 'amendment',
      })
    ).resolves.toEqual([]);
  });

  it('repairs unlinked final rows in deterministic CR, time, and title order', async () => {
    const currentContent = [{ type: 'p', children: [{ text: 'current' }] }];
    const baseContent = [{ type: 'p', children: [{ text: 'base' }] }];
    const rows = [
      {
        ...openChangeRequest,
        id: 'cr-2',
        title: 'CR-2',
        status: 'approved',
        resolved_in_mode: 'vote_internal',
        resolution_method: null,
      },
      {
        ...openChangeRequest,
        id: 'cr-1',
        title: 'CR-1',
        status: 'rejected',
        created_in_mode: 'vote_internal',
        resolution_method: 'internal_vote',
      },
      {
        ...openChangeRequest,
        id: 'alpha',
        title: 'Alpha',
        status: 'accepted',
        created_at: 2,
        resolution_method: 'internal_vote',
      },
      {
        ...openChangeRequest,
        id: 'zulu',
        title: 'Zulu',
        status: 'declined',
        created_at: 1,
        resolution_method: 'internal_vote',
      },
    ];
    const tx = createTx([
      { id: 'amendment', document_id: 'doc', discussions: { malformed: true } },
      { id: 'doc', content: currentContent },
      { id: 'base', content: baseContent },
      rows,
      null,
    ]);

    const result = await repairInternalChangeRequestResolution({
      tx: tx as never,
      ctx: { userID: 'manager' },
      amendmentId: 'amendment',
      now: 7,
    });

    expect(result).toHaveLength(4);
    expect(findChangeRequestDiscussionMock).toHaveBeenCalledTimes(4);
    expect(applyChangeRequestVoteResultToContentMock).not.toHaveBeenCalled();
    expect(tx.mutate.document_version.insert).toHaveBeenCalledWith(
      expect.objectContaining({ version_number: 1 })
    );
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility_scope: 'public',
        votes_for: 0,
        votes_against: 0,
        votes_abstain: 0,
      })
    );
    expect(tx.mutate.amendment.update).not.toHaveBeenCalled();
  });

  it('repairs a durable synthetic discussion even when its marker snapshot is absent', async () => {
    const baseContent = [{ type: 'p', children: [{ text: 'plain' }] }];
    const tx = createTx([
      {
        id: 'amendment',
        document_id: 'doc',
        discussions: [{ id: 'unrelated', crId: 'CR-99' }],
      },
      { id: 'doc', content: baseContent },
      { id: 'base', content: baseContent },
      [
        {
          ...openChangeRequest,
          id: 'durable-row',
          suggestion_id: 'durable',
          status: 'accepted',
          resolution_method: 'internal_vote',
          visibility_scope: 'collaborators',
        },
      ],
      { version_number: 1 },
    ]);

    await repairInternalChangeRequestResolution({
      tx: tx as never,
      ctx: { userID: 'manager' },
      amendmentId: 'amendment',
      now: 8,
    });

    expect(applyChangeRequestVoteResultToContentMock).toHaveBeenCalledWith(
      baseContent,
      'durable',
      'passed'
    );
    expect(tx.mutate.change_request.update).toHaveBeenCalledWith(
      expect.objectContaining({ visibility_scope: 'collaborators' })
    );
    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({ discussions: [{ id: 'unrelated', crId: 'CR-99' }] })
    );
  });

  it('returns no event-transition work for a missing amendment or no canonical requests', async () => {
    const missing = createTx([null]);
    await expect(
      finalizeInternalChangeRequestsForEventPhaseTransition({
        tx: missing as never,
        ctx: { userID: 'manager' },
        amendmentId: 'missing',
      })
    ).resolves.toEqual([]);

    const empty = createTx([
      { id: 'amendment', discussions: { malformed: true } },
      [{ ...openChangeRequest, status: 'accepted' }],
    ]);
    await expect(
      finalizeInternalChangeRequestsForEventPhaseTransition({
        tx: empty as never,
        ctx: { userID: 'manager' },
        amendmentId: 'amendment',
      })
    ).resolves.toEqual([]);
  });

  it('rejects event-transition rows without a document or linked suggestion', async () => {
    const missingDocument = createTx([
      { id: 'amendment', document_id: null, discussions: [] },
      [{ ...openChangeRequest, created_in_mode: 'edit' }],
    ]);
    await expect(
      finalizeInternalChangeRequestsForEventPhaseTransition({
        tx: missingDocument as never,
        ctx: { userID: 'manager' },
        amendmentId: 'amendment',
      })
    ).rejects.toThrow('document content not found');

    const missingSuggestion = createTx([
      { id: 'amendment', document_id: 'doc', discussions: [] },
      [{ ...openChangeRequest, created_in_mode: 'edit' }],
      { id: 'doc', content: [{ type: 'p', children: [{ text: 'plain' }] }] },
    ]);
    await expect(
      finalizeInternalChangeRequestsForEventPhaseTransition({
        tx: missingSuggestion as never,
        ctx: { userID: 'manager' },
        amendmentId: 'amendment',
      })
    ).rejects.toThrow('linked document suggestion not found');
  });

  it('persists branch-scoped discussions and uses a first document version', async () => {
    const content = [
      {
        type: 'p',
        children: [{ text: 'insert', suggestion_insert: { id: 'suggestion', type: 'insert' } }],
      },
    ];
    const tx = createTx([
      { id: 'amendment', discussions: [] },
      {
        id: 'branch',
        document_id: 'branch-doc',
        discussions: [{ id: 'suggestion', changeRequestEntityId: 'branch-cr', crId: 'CR-1' }],
      },
      [
        {
          ...openChangeRequest,
          id: 'branch-cr',
          amendment_id: 'amendment',
          process_branch_id: 'branch',
          created_in_mode: 'suggest_internal',
        },
      ],
      { id: 'branch-doc', content },
      [votingCollaborator('user-1')],
      [{ id: 'vote', user_id: 'user-1', vote: 'accept' }],
      null,
    ]);

    await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx: tx as never,
      ctx: { userID: 'manager' },
      amendmentId: 'amendment',
      processBranchId: 'branch',
      now: 9,
    });

    expect(tx.mutate.document_version.insert).toHaveBeenCalledWith(
      expect.objectContaining({ document_id: 'branch-doc', version_number: 1 })
    );
    expect(tx.mutate.amendment_process_branch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'branch' })
    );
    expect(tx.mutate.amendment.update).not.toHaveBeenCalled();
  });

  it('reuses eligibility for a later CityDesign CR and ignores a null resolver result', async () => {
    isCityDesignSourceTypeMock.mockImplementation(type => type === 'city_design_object');
    resolveChangeRequestByVoteResultMock.mockResolvedValue(null);
    const content = [
      {
        type: 'p',
        children: [{ text: 'insert', suggestion_insert: { id: 'suggestion', type: 'insert' } }],
      },
    ];
    const tx = createTx([
      {
        id: 'amendment',
        document_id: 'doc',
        discussions: [{ id: 'suggestion', changeRequestEntityId: 'text-cr', crId: 'CR-1' }],
      },
      [
        {
          ...openChangeRequest,
          id: 'text-cr',
          amendment_id: 'amendment',
          title: 'CR-1',
          created_in_mode: 'edit',
          created_at: 1,
        },
        {
          ...openChangeRequest,
          id: 'city-cr',
          amendment_id: 'amendment',
          title: 'CR-2',
          source_type: 'city_design_object',
          created_in_mode: 'suggest_internal',
          created_at: 2,
        },
      ],
      { id: 'doc', content },
      [votingCollaborator('user-1')],
      [{ id: 'text-vote', user_id: 'user-1', vote: 'accept' }],
      null,
      [{ id: 'city-vote', user_id: 'user-1', vote: 'reject' }],
    ]);

    const result = await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx: tx as never,
      ctx: { userID: 'manager' },
      amendmentId: 'amendment',
      now: 10,
    });

    expect(result).toHaveLength(1);
    expect(resolveChangeRequestByVoteResultMock).toHaveBeenCalledWith(
      expect.objectContaining({ changeRequestId: 'city-cr', voteResult: 'rejected' })
    );
  });

  it('orders timestamp-less CityDesign requests by stable ids and display titles', async () => {
    isCityDesignSourceTypeMock.mockReturnValue(true);
    resolveChangeRequestByVoteResultMock.mockResolvedValue(null);
    const tx = createTx([
      { id: 'amendment', document_id: null, discussions: [] },
      [
        {
          ...openChangeRequest,
          id: 'city-z',
          amendment_id: 'amendment',
          title: 'Zulu',
          source_type: 'city_design_object',
          created_at: undefined,
        },
        {
          ...openChangeRequest,
          id: 'city-a',
          amendment_id: 'amendment',
          title: 'Alpha',
          source_type: 'city_design_object',
          created_at: undefined,
        },
      ],
      [votingCollaborator('user-1')],
      [{ id: 'vote-a', user_id: 'user-1', vote: 'accept' }],
      [{ id: 'vote-z', user_id: 'user-1', vote: 'reject' }],
    ]);

    await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx: tx as never,
      ctx: { userID: 'manager' },
      amendmentId: 'amendment',
      now: 12,
    });

    expect(
      resolveChangeRequestByVoteResultMock.mock.calls.map(call => call[0].changeRequestId)
    ).toEqual(['city-a', 'city-z']);
  });

  it('keeps unrelated discussions when a durable suggestion has no discussion row', async () => {
    const content = [
      {
        type: 'p',
        children: [{ text: 'insert', suggestion_insert: { id: 'durable', type: 'insert' } }],
      },
    ];
    const tx = createTx([
      {
        id: 'amendment',
        document_id: 'doc',
        discussions: [{ id: 'unrelated', crId: 'CR-99' }],
      },
      [
        {
          ...openChangeRequest,
          id: 'durable-cr',
          amendment_id: 'amendment',
          suggestion_id: 'durable',
          created_in_mode: 'edit',
        },
      ],
      { id: 'doc', content },
      [votingCollaborator('user-1')],
      [{ id: 'vote', user_id: 'user-1', vote: 'accept' }],
      null,
    ]);

    await finalizeInternalChangeRequestsForEventPhaseTransition({
      tx: tx as never,
      ctx: { userID: 'manager' },
      amendmentId: 'amendment',
      now: 11,
    });

    expect(tx.mutate.amendment.update).toHaveBeenCalledWith(
      expect.objectContaining({ discussions: [{ id: 'unrelated', crId: 'CR-99' }] })
    );
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
