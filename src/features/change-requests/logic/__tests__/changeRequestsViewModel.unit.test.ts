import { describe, expect, it } from 'vitest';

import type { ChangeRequest } from '../../hooks/useChangeRequests';
import {
  buildChangeRequestBranchSections,
  getAllChangeRequests,
  getChangeRequestBranchLabel,
  isVotingEditingMode,
  mapChangeRequestsToDiffMap,
  mapChangeRequestsToDiscussions,
  mapRawDiscussionsToDiscussions,
  mapChangeRequestsToSummaries,
  mapChangeRequestsToTimelineItems,
  sortChangeRequestsByDisplayOrder,
} from '../changeRequestsViewModel';

function changeRequest(overrides: Partial<ChangeRequest>): ChangeRequest {
  return {
    id: 'cr-row-1',
    processBranchId: null,
    crId: 'CR-1',
    crNumber: 1,
    changedCharacterCount: 11,
    title: 'CR-1',
    description: '',
    type: 'replace',
    text: 'Before',
    newText: 'After',
    properties: {},
    newProperties: {},
    proposedChange: 'After',
    justification: '',
    isResolved: false,
    isObsolete: false,
    obsoleteReason: null,
    obsoleteAt: null,
    status: 'open',
    resolution: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: 1_700_000_000_000,
    userId: 'user-1',
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    votingDeadline: null,
    closeTrigger: null,
    eligibleVoterCount: 0,
    votedCollaboratorCount: 0,
    resolutionMethod: null,
    visibilityScope: null,
    resolvedInMode: null,
    votingStatus: null,
    confirmationStatus: null,
    changeRequestStatus: null,
    userVote: null,
    comments: [],
    votes: [],
    discussionId: 'suggestion-1',
    suggestionId: 'suggestion-1',
    changeRequestEntityId: 'cr-row-1',
    ...overrides,
  };
}

describe('change request view model helpers', () => {
  it('sorts all requests by CR number regardless of status grouping', () => {
    const open = changeRequest({ id: 'open', crId: 'CR-1', crNumber: 1 });
    const approved = changeRequest({
      id: 'approved',
      crId: 'CR-3',
      crNumber: 3,
      isResolved: true,
    });
    const declined = changeRequest({
      id: 'declined',
      crId: 'CR-2',
      crNumber: 2,
      isResolved: true,
    });

    expect(
      getAllChangeRequests({
        openChangeRequests: [open],
        approvedChangeRequests: [approved],
        declinedChangeRequests: [declined],
      }).map(request => request.id)
    ).toEqual(['open', 'declined', 'approved']);
  });

  it('maps summaries, diffs, and discussions without UI dependencies', () => {
    const requests = [
      changeRequest({
        id: 'request-1',
        crId: 'CR-7',
        title: '',
        description: 'Change summary',
        type: 'update',
        properties: { title: 'Old' },
        newProperties: { title: 'New' },
        justification: 'Cleaner wording',
      }),
    ];

    expect(mapChangeRequestsToSummaries(requests)[0]).toMatchObject({
      crId: 'CR-7',
      title: 'CR-7',
      description: 'Change summary',
      status: 'open',
      suggestionId: 'suggestion-1',
      changeRequestEntityId: 'cr-row-1',
      processBranchId: null,
    });
    expect(mapChangeRequestsToDiffMap(requests)['request-1']).toMatchObject({
      changeType: 'update',
      originalText: 'Before',
      newText: 'After',
      justification: 'Cleaner wording',
    });
    expect(mapChangeRequestsToDiffMap(requests)['cr-row-1']).toMatchObject({
      changeType: 'update',
      originalText: 'Before',
      newText: 'After',
    });
    expect(mapChangeRequestsToDiffMap(requests)['CR-7']).toMatchObject({
      changeType: 'update',
      originalText: 'Before',
      newText: 'After',
    });
    expect(mapChangeRequestsToDiscussions(requests)[0]).toMatchObject({
      id: 'suggestion-1',
      crId: 'CR-7',
      userId: 'user-1',
      isResolved: false,
      changeRequestEntityId: 'cr-row-1',
    });
  });

  it('uses the persisted change request id for timeline actions and keeps the suggestion id for previews', () => {
    const [item] = mapChangeRequestsToTimelineItems([
      changeRequest({
        id: 'suggestion-1',
        processBranchId: 'branch-1',
        crId: 'CR-1',
        title: 'Replace dieser',
        suggestionId: 'suggestion-1',
        discussionId: 'suggestion-1',
        changeRequestEntityId: 'cr-row-1',
      }),
    ]);

    expect(item.change_request_id).toBe('cr-row-1');
    expect(item.change_request?.id).toBe('cr-row-1');
    expect(
      (item.change_request as { changed_character_count?: number | null }).changed_character_count
    ).toBe(11);
    expect((item as { _processBranchId?: string | null })._processBranchId).toBe('branch-1');
    expect((item.change_request as { process_branch_id?: string | null })?.process_branch_id).toBe(
      'branch-1'
    );
    expect((item.change_request as { suggestion_id?: string | null })?.suggestion_id).toBe(
      'suggestion-1'
    );
  });

  it('keeps obsolete metadata, diffs, and votes while mapping the request as completed', () => {
    const obsoleteAt = 1_700_000_100_000;
    const obsolete = changeRequest({
      id: 'obsolete-request',
      changeRequestEntityId: 'obsolete-request',
      isResolved: true,
      isObsolete: true,
      obsoleteReason: 'suggestion_removed_in_collaborative_editing',
      obsoleteAt,
      status: 'obsolete',
      resolution: 'obsolete',
      votingStatus: 'completed',
      votesFor: 3,
      votesAgainst: 2,
      votesAbstain: 1,
    });

    const [summary] = mapChangeRequestsToSummaries([obsolete]);
    const [item] = mapChangeRequestsToTimelineItems([obsolete]);

    expect(summary).toMatchObject({
      status: 'obsolete',
      isObsolete: true,
      obsoleteReason: 'suggestion_removed_in_collaborative_editing',
      obsoleteAt,
      votesFor: 3,
      votesAgainst: 2,
      votesAbstain: 1,
    });
    expect(item).toMatchObject({
      status: 'completed',
      _originalStatus: 'obsolete',
      change_request: {
        status: 'obsolete',
        obsolete_reason: 'suggestion_removed_in_collaborative_editing',
        obsolete_at: obsoleteAt,
        votes_for: 3,
        votes_against: 2,
        votes_abstain: 1,
      },
      vote: {
        status: 'closed',
      },
    });
    expect(mapChangeRequestsToDiffMap([obsolete])['obsolete-request']).toMatchObject({
      changeType: 'replace',
      originalText: 'Before',
      newText: 'After',
    });
  });

  it('groups change requests into process branch sections and assigns legacy rows to the first branch', () => {
    const branchOneRequest = changeRequest({
      id: 'request-branch-1',
      changeRequestEntityId: 'request-branch-1',
      processBranchId: 'branch-1',
      crId: 'CR-1',
      crNumber: 1,
    });
    const branchTwoRequest = changeRequest({
      id: 'request-branch-2',
      changeRequestEntityId: 'request-branch-2',
      processBranchId: 'branch-2',
      crId: 'CR-2',
      crNumber: 2,
      status: 'accepted',
      resolution: 'accepted',
      isResolved: true,
    });
    const legacyRequest = changeRequest({
      id: 'request-main',
      changeRequestEntityId: 'request-main',
      processBranchId: null,
      crId: 'CR-3',
      crNumber: 3,
    });
    const branchOneContent = [{ type: 'p', children: [{ text: 'Branch one' }] }];
    const branchTwoContent = [{ type: 'p', children: [{ text: 'Branch two' }] }];

    const sections = buildChangeRequestBranchSections({
      branches: [
        {
          id: 'branch-2',
          status: 'completed',
          editing_mode: 'vote_internal',
          resolution: 'winner',
          created_at: 2,
          document: { content: branchTwoContent },
          step_runs: [
            {
              order_index: 0,
              target_group: { name: 'Second branch group' },
              event_id: 'event-2',
              event: { id: 'event-2', title: 'Second event' },
            },
          ],
        },
        {
          id: 'branch-1',
          status: 'in_vote',
          editing_mode: 'suggest_event',
          created_at: 1,
          document: { content: branchOneContent },
          discussions: [
            {
              id: 'discussion-branch-1',
              crId: 'CR-1',
              userId: 'user-1',
              createdAt: 1,
              isResolved: false,
              changeRequestEntityId: 'request-branch-1',
            },
          ],
          step_runs: [
            {
              order_index: 0,
              target_group: { name: 'First branch group' },
              event_id: 'event-1',
              event: { id: 'event-1', title: 'First event' },
            },
          ],
        },
      ],
      changeRequests: [legacyRequest, branchTwoRequest, branchOneRequest],
    });

    expect(sections.map(section => section.branchId)).toEqual(['branch-1', 'branch-2']);
    expect(sections[0]).toMatchObject({
      title: 'First branch group',
      status: 'in_vote',
      editingMode: 'suggest_event',
      eventTitle: 'First event',
      totalCount: 2,
      openCount: 2,
    });
    expect(sections[0].documentContent).toBe(branchOneContent);
    expect(sections[0].discussions[0]?.processBranchId).toBe('branch-1');
    expect(sections[0].timelineItems.map(item => item.change_request_id)).toEqual([
      'request-branch-1',
      'request-main',
    ]);
    expect(sections[1]).toMatchObject({
      title: 'Second branch group',
      editingMode: 'vote_internal',
      totalCount: 1,
      approvedCount: 1,
    });
    expect(sections).toHaveLength(2);
  });

  it('creates branch section items from confirmed and pending branch discussions without persisted rows', () => {
    const branchContent = [
      {
        type: 'p',
        children: [
          {
            text: 'Neu',
            suggestion_insert: { id: 'suggestion-confirmed', type: 'insert' },
          },
          {
            text: 'Entwurf',
            suggestion_insert: { id: 'suggestion-pending', type: 'insert' },
          },
        ],
      },
    ];

    const sections = buildChangeRequestBranchSections({
      branches: [
        {
          id: 'branch-1',
          created_at: 1,
          editing_mode: 'suggest_event',
          document: { content: branchContent },
          discussions: [
            {
              id: 'suggestion-confirmed',
              crId: 'CR-1',
              confirmationStatus: 'confirmed',
              createdAt: 1,
              isResolved: false,
              userId: 'user-1',
              comments: [],
            },
            {
              id: 'suggestion-pending',
              crId: 'CR-2',
              confirmationStatus: 'pending',
              createdAt: 2,
              isResolved: false,
              userId: 'user-1',
              comments: [],
            },
          ],
        },
      ],
      changeRequests: [],
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      branchId: 'branch-1',
      editingMode: 'suggest_event',
      totalCount: 2,
      openCount: 2,
    });
    expect(sections[0].timelineItems).toHaveLength(2);
    expect(sections[0].timelineItems[0]?.change_request_id).toBe('suggestion-confirmed');
    expect(sections[0].timelineItems[1]?.change_request_id).toBe('suggestion-pending');
    expect(sections[0].timelineItems[1]?.change_request).toMatchObject({
      status: 'pending_submission',
      voting_status: 'pending_submission',
      confirmation_status: 'pending',
    });
    expect(sections[0].diffMap['suggestion-confirmed']).toMatchObject({
      changeType: 'insert',
      newText: 'Neu',
    });
  });

  it('keeps historical branch rows even when the branch source is no longer loaded', () => {
    const historicalRequest = changeRequest({
      id: 'request-historical',
      changeRequestEntityId: 'request-historical',
      processBranchId: 'branch-historical',
      crId: 'CR-7',
      crNumber: 7,
      type: 'insert',
      text: '',
      newText: 'Historischer Vorschlag',
    });

    const sections = buildChangeRequestBranchSections({
      branches: [{ id: 'branch-current', created_at: 2 }],
      changeRequests: [historicalRequest],
    });

    expect(sections.map(section => section.branchId)).toEqual([
      'branch-current',
      'branch-historical',
    ]);
    expect(sections[1]).toMatchObject({
      id: 'historical-branch-branch-historical',
      branchId: 'branch-historical',
      totalCount: 1,
      openCount: 1,
    });
    expect(sections[1].timelineItems[0]?.change_request_id).toBe('request-historical');
    expect(sections[1].diffMap['request-historical']).toMatchObject({
      changeType: 'insert',
      newText: 'Historischer Vorschlag',
    });
  });

  it('numbers change requests inside each process branch for display', () => {
    const sections = buildChangeRequestBranchSections({
      branches: [
        { id: 'branch-1', created_at: 1 },
        { id: 'branch-2', created_at: 2 },
      ],
      changeRequests: [
        changeRequest({
          id: 'branch-1-cr-1',
          changeRequestEntityId: 'branch-1-cr-1',
          processBranchId: 'branch-1',
          crId: 'CR-1',
          crNumber: 1,
        }),
        changeRequest({
          id: 'branch-2-cr-1',
          changeRequestEntityId: 'branch-2-cr-1',
          processBranchId: 'branch-2',
          crId: 'CR-3',
          crNumber: 3,
        }),
        changeRequest({
          id: 'branch-1-cr-2',
          changeRequestEntityId: 'branch-1-cr-2',
          processBranchId: 'branch-1',
          crId: 'CR-2',
          crNumber: 2,
        }),
        changeRequest({
          id: 'branch-2-cr-2',
          changeRequestEntityId: 'branch-2-cr-2',
          processBranchId: 'branch-2',
          crId: 'CR-4',
          crNumber: 4,
        }),
      ],
    });

    expect(
      sections.flatMap(section =>
        section.timelineItems.map(item => (item.change_request as any)?.display_cr_id)
      )
    ).toEqual(['Branch 1 CR-1', 'Branch 1 CR-2', 'Branch 2 CR-1', 'Branch 2 CR-2']);
  });

  it('does not expose empty unknown diffs to timeline cards', () => {
    expect(
      mapChangeRequestsToDiffMap([
        changeRequest({
          id: 'resolved-without-snapshot',
          type: 'unknown',
          text: '',
          newText: '',
          isResolved: true,
          status: 'accepted',
          resolution: 'accepted',
        }),
      ])
    ).toEqual({});
  });

  it('recognizes internal and event voting modes', () => {
    expect(isVotingEditingMode('event_final_closing_vote')).toBe(true);
    expect(isVotingEditingMode('vote_internal')).toBe(true);
    expect(isVotingEditingMode('suggest_event')).toBe(false);
  });

  it('sorts malformed and tied display numbers with deterministic date and label fallbacks', () => {
    const requests = [
      changeRequest({ id: 'z-id', title: '', crId: '', crNumber: Number.NaN, createdAt: 0 }),
      changeRequest({
        id: 'by-cr-id',
        title: '',
        crId: 'CR-2',
        crNumber: Number.NaN,
        createdAt: 0,
      }),
      changeRequest({
        id: 'by-title-b',
        title: 'B title',
        crId: 'CR-2',
        crNumber: 2,
        createdAt: 20,
      }),
      changeRequest({
        id: 'by-title-a',
        title: 'A title',
        crId: 'CR-2',
        crNumber: 2,
        createdAt: 20,
      }),
      changeRequest({
        id: 'earlier',
        title: 'Earlier',
        crId: 'CR-2',
        crNumber: 2,
        createdAt: 10,
      }),
    ];

    expect(sortChangeRequestsByDisplayOrder(requests).map(request => request.id)).toEqual([
      'z-id',
      'by-cr-id',
      'earlier',
      'by-title-a',
      'by-title-b',
    ]);
    for (const pair of [
      [requests[0], requests[1]],
      [requests[1], requests[0]],
      [
        changeRequest({ id: 'left-id', title: '', crId: '', crNumber: 1, createdAt: 0 }),
        changeRequest({ id: 'right-id', title: '', crId: '', crNumber: 1, createdAt: 0 }),
      ],
      [
        changeRequest({ id: 'left-cr', title: '', crId: 'CR-1', crNumber: 1, createdAt: 0 }),
        changeRequest({ id: 'right-cr', title: '', crId: 'CR-1', crNumber: 1, createdAt: 0 }),
      ],
    ]) {
      expect(sortChangeRequestsByDisplayOrder(pair)).toHaveLength(2);
    }
  });

  it('maps every summary, diff, and discussion fallback without inventing content', () => {
    const aliased = changeRequest({
      id: 'row-id',
      logicalKey: 'logical-key',
      crId: 'CR-9',
      displayCrId: 'Branch 2 CR-1',
      title: '',
      description: '',
      type: 'insert',
      text: '',
      newText: 'Added',
      properties: {},
      newProperties: {},
      justification: '',
      suggestionId: 'suggestion-id',
      discussionId: null,
      changeRequestEntityId: 'entity-id',
      confirmationStatus: null,
      changeRequestStatus: null,
    });
    const propertyOnly = changeRequest({
      id: 'property-only',
      crId: 'CR-10',
      type: 'update',
      text: '',
      newText: '',
      properties: {},
      newProperties: { align: 'center' },
      suggestionId: null,
      discussionId: null,
      changeRequestEntityId: undefined,
    });
    const withoutCrId = changeRequest({
      id: 'without-cr-id',
      crId: '',
      title: '',
      discussionId: null,
      suggestionId: null,
    });
    const accepted = changeRequest({ resolution: 'accepted', isResolved: true });
    const declined = changeRequest({ resolution: 'rejected', isResolved: true });
    const obsolete = changeRequest({ isObsolete: true, resolution: null });

    expect(
      mapChangeRequestsToSummaries([accepted, declined, obsolete]).map(row => row.status)
    ).toEqual(['approved', 'declined', 'obsolete']);
    const diffMap = mapChangeRequestsToDiffMap([
      aliased,
      propertyOnly,
      withoutCrId,
      changeRequest({
        id: 'empty',
        type: 'insert',
        text: '',
        newText: '',
        properties: {},
        newProperties: {},
      }),
      changeRequest({ id: 'unknown', type: 'unknown', properties: { value: 'x' } }),
    ]);
    expect(Object.keys(diffMap)).toEqual(
      expect.arrayContaining(['row-id', 'logical-key', 'CR-9', 'suggestion-id', 'entity-id'])
    );
    expect(diffMap['row-id']).toMatchObject({ originalText: undefined, newText: 'Added' });
    expect(diffMap['property-only']).toMatchObject({ newProperties: { align: 'center' } });
    expect(diffMap['empty']).toBeUndefined();
    expect(diffMap['unknown']).toBeUndefined();

    const discussions = mapChangeRequestsToDiscussions([aliased, propertyOnly, withoutCrId]);
    expect(discussions).toHaveLength(2);
    expect(discussions[0]).toMatchObject({
      id: 'suggestion-id',
      displayCrId: 'Branch 2 CR-1',
      confirmationStatus: undefined,
      changeRequestStatus: null,
    });
    expect(discussions[1].id).toBe('property-only');
  });

  it('normalizes defensive raw discussion inputs, dates, statuses, and optional fields', () => {
    expect(mapRawDiscussionsToDiscussions(null)).toEqual([]);
    const now = new Date('2026-01-01T00:00:00.000Z');
    const discussions = mapRawDiscussionsToDiscussions(
      [
        null,
        'invalid',
        {},
        {
          id: 1,
          crId: 'CR-1',
          displayCrId: 'Branch 1 CR-1',
          branchDisplayNumber: 1,
          branchScopedCrNumber: 2,
          branchSequenceNumber: 3,
          title: 'Title',
          userId: 'user-1',
          comments: [{ text: 'comment' }],
          createdAt: now,
          isResolved: true,
          status: 'pending',
          confirmationStatus: 'pending',
          changeRequestStatus: 'open',
          changeRequestEntityId: 'entity-1',
        },
        { id: 'number-date', createdAt: 100, status: 'accepted', confirmationStatus: 'confirmed' },
        { id: 'valid-date', createdAt: '2026-02-01T00:00:00Z', status: 'rejected' },
        {
          id: 'invalid-date',
          createdAt: 'not-a-date',
          status: 'other',
          confirmationStatus: 'other',
        },
        {
          id: 'fallbacks',
          crId: 1,
          displayCrId: 2,
          branchDisplayNumber: '1',
          branchScopedCrNumber: '2',
          branchSequenceNumber: '3',
          title: 4,
          userId: 5,
          comments: 'none',
          createdAt: {},
          changeRequestStatus: 6,
          changeRequestEntityId: 7,
        },
      ],
      'branch-1'
    );

    expect(discussions).toHaveLength(5);
    expect(discussions[0]).toMatchObject({
      id: '1',
      createdAt: now,
      status: 'pending',
      confirmationStatus: 'pending',
      processBranchId: 'branch-1',
    });
    expect(discussions[1].createdAt).toEqual(new Date(100));
    expect(discussions[2].createdAt).toEqual(new Date('2026-02-01T00:00:00Z'));
    expect(discussions[3].createdAt).toEqual(new Date(0));
    expect(discussions[4]).toMatchObject({
      crId: undefined,
      userId: '',
      comments: [],
      createdAt: new Date(0),
      status: undefined,
      confirmationStatus: undefined,
      changeRequestStatus: null,
      changeRequestEntityId: undefined,
    });
  });

  it('builds labels and branch metadata from every ordered fallback source', () => {
    expect(
      getChangeRequestBranchLabel({
        id: 'branch-labels',
        step_runs: [
          { order_index: 3 },
          { order_index: 2, workflow_step: { label: 'Workflow' } },
          { order_index: 1, source_group: { name: 'Source' } },
          { order_index: 0, target_group: { name: 'Target' } },
          { order_index: null },
          { order_index: null },
        ],
      })
    ).toContain('Target -> Source -> Workflow');
    expect(getChangeRequestBranchLabel({ id: 'branch-title', title: 'Explicit title' })).toBe(
      'Explicit title'
    );
    expect(getChangeRequestBranchLabel({ id: 'branch-default' })).toBeTruthy();

    const sections = buildChangeRequestBranchSections({
      branches: [
        {
          id: 'invalid-date',
          created_at: 'not-a-date',
          document_version: { content: [{ type: 'p', children: [{ text: 'Version' }] }] },
          step_runs: [{ order_index: null, event: { id: 'event-nested', title: 'Nested event' } }],
        },
        { id: 'missing-date', created_at: null },
        { id: 'valid-date', created_at: '2026-01-01T00:00:00Z' },
      ],
      changeRequests: [],
    });

    expect(sections.map(section => section.branchId)).toEqual([
      'invalid-date',
      'missing-date',
      'valid-date',
    ]);
    expect(sections[0]).toMatchObject({
      eventId: 'event-nested',
      eventTitle: 'Nested event',
    });
    expect(sections[0].documentContent).toEqual([{ type: 'p', children: [{ text: 'Version' }] }]);
  });

  it('matches branch discussions by every supported identity and applies live suggestion content', () => {
    const requests = [
      changeRequest({
        id: 'request-by-id',
        changeRequestEntityId: 'other-entity',
        discussionId: null,
        suggestionId: null,
        crId: 'CR-11',
        title: 'Request by id',
        processBranchId: 'branch-1',
      }),
      changeRequest({
        id: 'request-by-entity',
        changeRequestEntityId: 'entity-match',
        discussionId: null,
        suggestionId: null,
        crId: 'CR-12',
        title: 'Request by entity',
        processBranchId: 'branch-1',
      }),
      changeRequest({
        id: 'request-by-discussion',
        changeRequestEntityId: undefined,
        discussionId: 'discussion-match',
        suggestionId: null,
        crId: 'CR-13',
        title: 'Request by discussion',
        processBranchId: 'branch-1',
      }),
      changeRequest({
        id: 'request-by-suggestion',
        changeRequestEntityId: undefined,
        discussionId: null,
        suggestionId: 'suggestion-match',
        crId: 'CR-14',
        title: 'Request by suggestion',
        processBranchId: 'branch-1',
      }),
      changeRequest({
        id: 'request-by-cr-id',
        changeRequestEntityId: undefined,
        discussionId: null,
        suggestionId: null,
        crId: 'CR-15',
        title: 'Different title',
        processBranchId: 'branch-1',
      }),
      changeRequest({
        id: 'request-by-cr-title',
        changeRequestEntityId: undefined,
        discussionId: null,
        suggestionId: null,
        crId: 'CR-16',
        title: 'CR-title-match',
        processBranchId: 'branch-1',
      }),
      changeRequest({
        id: 'request-by-title',
        changeRequestEntityId: undefined,
        discussionId: null,
        suggestionId: null,
        crId: 'CR-17',
        title: 'Title match',
        processBranchId: 'branch-1',
      }),
      changeRequest({
        id: 'request-unmatched',
        discussionId: null,
        suggestionId: null,
        changeRequestEntityId: undefined,
        crId: 'CR-18',
        title: 'Unmatched',
        processBranchId: 'branch-1',
      }),
    ];
    const suggestion = (id: string, type: 'insert' | 'remove', text: string) => ({
      text,
      suggestion: true,
      [`suggestion_${id}`]: { id, type },
    });
    const sections = buildChangeRequestBranchSections({
      branches: [
        {
          id: 'branch-1',
          created_at: 1,
          document: {
            content: [
              {
                type: 'p',
                children: [
                  suggestion('discussion-by-id', 'remove', 'Removed'),
                  suggestion('discussion-match', 'insert', 'Inserted'),
                ],
              },
            ],
          },
          discussions: [
            { id: 'discussion-by-id', changeRequestEntityId: 'request-by-id' },
            { id: 'discussion-by-entity', changeRequestEntityId: 'entity-match' },
            { id: 'discussion-match', crId: 'legacy-discussion' },
            { id: 'suggestion-match', crId: 'legacy-suggestion' },
            { id: 'discussion-by-cr', crId: 'CR-15' },
            { id: 'discussion-by-cr-title', crId: 'CR-title-match' },
            { id: 'discussion-by-title', title: 'Title match', crId: 'legacy-title' },
            { id: 'fallback-unrepresented', crId: 'CR-19', confirmationStatus: 'confirmed' },
            { id: 'fallback-accepted', crId: 'CR-20', status: 'accepted' },
            { id: 'fallback-rejected', crId: 'CR-21', status: 'rejected' },
            { id: 'entity-only', changeRequestEntityId: 'entity-only-row' },
            { id: 'orphan-only' },
          ],
        },
      ],
      changeRequests: requests,
    });

    expect(sections[0].timelineItems).toHaveLength(12);
    expect(sections[0].diffMap['request-by-id']).toMatchObject({
      originalText: 'Removed',
      newText: undefined,
    });
    expect(sections[0].diffMap['request-by-discussion']).toMatchObject({
      originalText: undefined,
      newText: 'Inserted',
    });
    expect(
      sections[0].discussions.some(discussion => discussion.id === 'fallback-unrepresented')
    ).toBe(true);
  });

  it('sorts multiple historical branches and ignores unscoped requests when no branch exists', () => {
    expect(
      buildChangeRequestBranchSections({
        branches: [],
        changeRequests: [changeRequest({ id: 'main', processBranchId: null })],
      })
    ).toEqual([]);

    const sections = buildChangeRequestBranchSections({
      branches: [{ id: 'current', created_at: 1 }],
      changeRequests: [
        changeRequest({ id: 'historical-b', processBranchId: 'historical-b', createdAt: 20 }),
        changeRequest({ id: 'historical-a2', processBranchId: 'historical-a', createdAt: 10 }),
        changeRequest({ id: 'historical-a1', processBranchId: 'historical-a', createdAt: 10 }),
        changeRequest({ id: 'historical-c', processBranchId: 'historical-c', createdAt: 20 }),
        changeRequest({
          id: 'historical-d',
          processBranchId: 'historical-d',
          createdAt: undefined as unknown as number,
        }),
        changeRequest({
          id: 'historical-e',
          processBranchId: 'historical-e',
          createdAt: undefined as unknown as number,
        }),
      ],
    });
    expect(sections.map(section => section.branchId)).toEqual([
      'current',
      'historical-d',
      'historical-e',
      'historical-a',
      'historical-b',
      'historical-c',
    ]);
  });
});
