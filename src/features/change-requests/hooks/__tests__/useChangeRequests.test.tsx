/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChangeRequests } from '../useChangeRequests';

const mocks = vi.hoisted(() => ({
  primary: {} as Record<string, unknown>,
  documents: {} as Record<string, unknown>,
  users: {} as Record<string, unknown>,
  useAmendmentState: vi.fn(),
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: (options: Record<string, unknown> = {}) => mocks.useAmendmentState(options),
}));

function emptyPrimary(overrides: Record<string, unknown> = {}) {
  return {
    amendment: null,
    changeRequests: [],
    changeRequestsWithVotes: [],
    collaborators: [],
    cityDesigns: [],
    primaryCityDesign: null,
    isLoading: false,
    ...overrides,
  };
}

function liveSuggestion(id: string, oldText: string, newText: string) {
  return [
    {
      type: 'p',
      children: [
        {
          text: oldText,
          suggestion: true,
          [`suggestion_remove_${id}`]: { id, type: 'remove' },
        },
        {
          text: newText,
          suggestion: true,
          [`suggestion_insert_${id}`]: { id, type: 'insert' },
        },
      ],
    },
  ];
}

beforeEach(() => {
  mocks.primary = emptyPrimary();
  mocks.documents = { documents: [], isLoading: false };
  mocks.users = { allUsers: [] };
  mocks.useAmendmentState.mockReset();
  mocks.useAmendmentState.mockImplementation((options: Record<string, unknown>) => {
    if (options.includeDocuments) return mocks.documents;
    if ('includeAllUsers' in options) return mocks.users;
    return mocks.primary;
  });
});

describe('useChangeRequests', () => {
  it('returns the empty facade contract and combines loading states', () => {
    mocks.primary = emptyPrimary({
      amendment: { discussions: null, internal_cr_voting_close_trigger: null },
      cityDesigns: ['city-design'],
      primaryCityDesign: 'primary',
      isLoading: true,
    });
    mocks.documents = { documents: [], isLoading: false };
    mocks.users = { allUsers: undefined };

    const { result } = renderHook(() => useChangeRequests('amendment-1'));

    expect(result.current).toMatchObject({
      document: undefined,
      cityDesigns: ['city-design'],
      primaryCityDesign: 'primary',
      changeRequests: [],
      openChangeRequests: [],
      closedChangeRequests: [],
      obsoleteChangeRequests: [],
      approvedChangeRequests: [],
      declinedChangeRequests: [],
      users: {},
      isLoading: true,
    });
    expect(mocks.useAmendmentState).toHaveBeenNthCalledWith(1, {
      amendmentId: 'amendment-1',
      includeChangeRequestsWithVotes: true,
      includeCityDesign: true,
    });
    expect(mocks.useAmendmentState).toHaveBeenNthCalledWith(2, {
      amendmentId: 'amendment-1',
      includeDocuments: true,
    });
    expect(mocks.useAmendmentState).toHaveBeenNthCalledWith(3, {
      includeAllUsers: false,
    });
  });

  it('maps live and persisted requests, voting eligibility, users, and terminal statuses', () => {
    const discussions = [
      {
        id: 'suggestion-live',
        crId: 'CR-2',
        title: 'Live title',
        description: 'Discussion description',
        justification: 'Discussion justification',
        status: 'accepted',
        confirmationStatus: 'confirmed',
        createdAt: 25,
        userId: 'author-live',
        comments: [{ text: 'Comment' }],
      },
      {
        id: 'suggestion-only',
        crId: 'CR-5',
        title: 'Pending suggestion',
        description: 42,
        justification: 42,
        status: 'pending',
        confirmationStatus: 'pending',
        changeRequestStatus: 'pending_submission',
      },
    ];
    const rows = [
      {
        id: 'cr-live',
        suggestion_id: 'suggestion-live',
        process_branch_id: 'branch-1',
        branch_sequence_number: 2,
        title: 'CR-2',
        description: 'Persisted description',
        status: 'accepted',
        source_type: 'document',
        source_id: 'source-1',
        source_title: 'Source title',
        change_type: 'replace',
        original_text: 'snapshot old',
        new_text: 'snapshot new',
        original_properties: { align: 'left' },
        new_properties: { align: 'right' },
        changed_character_count: 99,
        obsolete_reason: null,
        obsolete_at: null,
        user_id: 'author-persisted',
        created_at: 20,
        updated_at: 30,
        votes_for: 1,
        votes_against: 2,
        votes_abstain: 3,
        voting_deadline: 500,
        resolution_method: 'internal_vote',
        visibility_scope: 'collaborators',
        resolved_in_mode: 'vote_internal',
        voting_status: 'completed',
        votes: [
          { id: 'vote-other', user_id: 'other', vote: 'reject' },
          { id: 'vote-current', user_id: 'viewer', vote: 'accept' },
        ],
      },
      {
        id: 'cr-rejected',
        title: 'CR-3',
        description: null,
        status: 'rejected',
        change_type: 'remove',
        original_text: 'gone',
        new_text: null,
        changed_character_count: 0,
        creator: { id: 'author-handle' },
        createdAt: 40,
        updatedAt: 45,
        votes_for: null,
        votes_against: null,
        votes_abstain: null,
        votes: [{ id: 'fallback-vote', user_id: 'other', vote: 'abstain' }],
      },
      {
        id: 'cr-obsolete',
        title: 'CR-4',
        status: 'open',
        obsolete_reason: 'superseded',
        obsolete_at: 60,
        changedCharacterCount: Number.NaN,
        user: { id: 'author-unknown' },
      },
    ];
    mocks.primary = emptyPrimary({
      amendment: {
        discussions,
        internal_cr_voting_close_trigger: 'after_minutes',
      },
      changeRequests: [{ id: 'ignored-fallback' }],
      changeRequestsWithVotes: rows,
      collaborators: [
        {
          status: 'active',
          user_id: 'eligible-1',
          role: { action_rights: [{ resource: 'amendments', action: 'vote' }] },
        },
        {
          status: 'collaborator',
          user: { id: 'eligible-2' },
          role: {
            action_rights: [
              {
                resource: 'amendments',
                action: 'vote',
                amendment_id: 'amendment-1',
                amendment: { id: 'amendment-1' },
              },
            ],
          },
        },
        {
          status: 'member',
          user_id: 'wrong-resource',
          role: { action_rights: [{ resource: 'groups', action: 'vote' }] },
        },
        {
          status: 'admin',
          user_id: 'wrong-action',
          role: { action_rights: [{ resource: 'amendments', action: 'edit' }] },
        },
        {
          status: 'active',
          user_id: 'wrong-amendment',
          role: {
            action_rights: [
              { resource: 'amendments', action: 'vote', amendment_id: 'amendment-2' },
            ],
          },
        },
        {
          status: 'active',
          user_id: 'wrong-related-amendment',
          role: {
            action_rights: [
              {
                resource: 'amendments',
                action: 'vote',
                amendment: { id: 'amendment-2' },
              },
            ],
          },
        },
        { status: 'invited', user_id: 'inactive', role: { action_rights: [] } },
        { status: 'active', role: { action_rights: [] } },
      ],
    });
    mocks.documents = {
      documents: [{ content: liveSuggestion('suggestion-live', 'old', 'new') }],
      isLoading: true,
    };
    mocks.users = {
      allUsers: [
        { id: 'author-live', first_name: 'Ada', last_name: 'Lovelace' },
        { id: 'author-handle', first_name: null, last_name: null, handle: '@handle' },
        { id: 'author-unknown', first_name: null, last_name: null, handle: null },
        null,
        { first_name: 'Missing', last_name: 'Id' },
      ],
    };

    const { result } = renderHook(() => useChangeRequests('amendment-1', 'viewer'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.changeRequests).toHaveLength(4);
    expect(result.current.openChangeRequests.map(request => request.crId)).toEqual(['CR-5']);
    expect(result.current.closedChangeRequests.map(request => request.crId)).toEqual([
      'CR-2',
      'CR-3',
    ]);
    expect(result.current.approvedChangeRequests.map(request => request.crId)).toEqual(['CR-2']);
    expect(result.current.declinedChangeRequests.map(request => request.crId)).toEqual(['CR-3']);
    expect(result.current.obsoleteChangeRequests.map(request => request.crId)).toEqual(['CR-4']);

    expect(result.current.changeRequests[0]).toMatchObject({
      id: 'cr-live',
      processBranchId: 'branch-1',
      discussionId: 'suggestion-live',
      suggestionId: 'suggestion-live',
      crId: 'CR-2',
      crNumber: 2,
      branchSequenceNumber: 2,
      changedCharacterCount: 99,
      title: 'Live title',
      description: 'Discussion description',
      type: 'replace',
      text: 'old',
      newText: 'new',
      proposedChange: 'new',
      justification: 'Discussion justification',
      isResolved: true,
      status: 'accepted',
      resolution: 'accepted',
      resolvedAt: 30,
      resolvedBy: 'author-persisted',
      createdAt: 25,
      userId: 'author-live',
      votesFor: 1,
      votesAgainst: 2,
      votesAbstain: 3,
      votingDeadline: 500,
      closeTrigger: 'after_minutes',
      eligibleVoterCount: 2,
      votedCollaboratorCount: 6,
      userVote: 'accept',
      confirmationStatus: 'confirmed',
      changeRequestStatus: 'accepted',
      comments: [{ text: 'Comment' }],
    });
    expect(result.current.changeRequests[1]).toMatchObject({
      id: 'cr-rejected',
      changedCharacterCount: 4,
      description: '',
      proposedChange: 'gone',
      resolvedAt: 45,
      resolvedBy: 'author-handle',
      createdAt: 40,
      userId: 'author-handle',
      userVote: 'abstain',
      confirmationStatus: 'confirmed',
    });
    expect(result.current.changeRequests[2]).toMatchObject({
      id: 'cr-obsolete',
      changedCharacterCount: 0,
      isObsolete: true,
      isResolved: true,
      status: 'obsolete',
      resolution: 'obsolete',
      resolvedAt: 60,
      changeRequestStatus: 'obsolete',
    });
    expect(result.current.changeRequests[3]).toMatchObject({
      id: 'suggestion-only',
      changedCharacterCount: 0,
      type: 'unknown',
      description: '',
      justification: '',
      status: 'pending',
      resolution: null,
      confirmationStatus: 'pending',
      changeRequestStatus: 'pending_submission',
      userVote: null,
    });
    expect(result.current.users).toEqual({
      'author-live': { name: 'Ada Lovelace' },
      'author-handle': { name: '@handle' },
      'author-unknown': { name: 'Unknown' },
    });
    expect(mocks.useAmendmentState).toHaveBeenNthCalledWith(3, {
      includeAllUsers: true,
    });
  });

  it('falls back to unjoined rows, snapshot content, the first vote, and default metadata', () => {
    mocks.primary = emptyPrimary({
      amendment: { discussions: [], internal_cr_voting_close_trigger: 'unexpected' },
      changeRequests: [
        {
          id: 'cr-fallback',
          title: null,
          status: 'declined',
          description: 'Persisted',
          justification: 'Persisted justification',
          change_type: 'insert',
          new_text: 'inserted',
          changedCharacterCount: 7,
          user: { id: 'creator-from-user' },
          votes: [{ id: 'vote-1', user_id: 'someone', vote: 'reject' }],
        },
      ],
      collaborators: null,
    });
    mocks.documents = { documents: [{ content: undefined }], isLoading: false };
    mocks.users = { allUsers: [] };

    const { result } = renderHook(() => useChangeRequests('amendment-1', 'missing-user'));
    const [request] = result.current.changeRequests;

    expect(request).toMatchObject({
      id: 'cr-fallback',
      processBranchId: null,
      crId: '',
      crNumber: 0,
      changedCharacterCount: 7,
      title: 'main:cr-fallback',
      description: 'Persisted',
      type: 'insert',
      text: '',
      newText: 'inserted',
      proposedChange: 'inserted',
      justification: 'Persisted justification',
      resolution: 'declined',
      resolvedAt: null,
      resolvedBy: 'creator-from-user',
      createdAt: 0,
      userId: 'creator-from-user',
      closeTrigger: 'all_collaborators_voted',
      eligibleVoterCount: 0,
      userVote: 'reject',
    });
  });

  it('handles absent collaborator relations and defensive status metadata', () => {
    mocks.primary = emptyPrimary({
      amendment: {
        discussions: [{ id: 'discussion-bare', crId: 'CR-1' }],
      },
      changeRequestsWithVotes: [
        {
          id: 'cr-pending',
          title: 'CR-2',
          status: 'pending_submission',
        },
        {
          id: 'cr-approved-without-creator',
          title: 'CR-3',
          status: 'approved',
        },
        {
          id: 'cr-obsolete-without-timestamp',
          title: 'CR-4',
          status: 'open',
          obsolete_reason: 'replaced',
        },
      ],
      collaborators: [
        { status: 'active', role: null },
        {
          status: 'active',
          role: { action_rights: [{ resource: 'amendments', action: 'vote' }] },
        },
      ],
    });

    const { result } = renderHook(() => useChangeRequests('amendment-1'));
    const byId = Object.fromEntries(
      result.current.changeRequests.map(request => [request.id, request])
    );

    expect(byId['discussion-bare']).toMatchObject({
      status: 'open',
      resolution: null,
      resolvedAt: null,
      changeRequestStatus: null,
      confirmationStatus: null,
    });
    expect(byId['cr-pending']).toMatchObject({
      status: 'pending_submission',
      confirmationStatus: 'pending',
      resolvedBy: null,
    });
    expect(byId['cr-approved-without-creator']).toMatchObject({
      status: 'approved',
      resolution: 'approved',
      resolvedBy: '',
    });
    expect(byId['cr-obsolete-without-timestamp']).toMatchObject({
      status: 'obsolete',
      resolution: 'obsolete',
      resolvedAt: null,
    });
    expect(result.current.changeRequests.every(request => request.eligibleVoterCount === 0)).toBe(
      true
    );
  });
});
