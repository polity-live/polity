import { describe, expect, it } from 'vitest';

import type { ChangeRequest } from '../../hooks/useChangeRequests';
import {
  buildChangeRequestBranchSections,
  getAllChangeRequests,
  isVotingEditingMode,
  mapChangeRequestsToDiffMap,
  mapChangeRequestsToDiscussions,
  mapChangeRequestsToSummaries,
  mapChangeRequestsToTimelineItems,
} from '../changeRequestsViewModel';

function changeRequest(overrides: Partial<ChangeRequest>): ChangeRequest {
  return {
    id: 'cr-row-1',
    processBranchId: null,
    crId: 'CR-1',
    crNumber: 1,
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
    expect((item as { _processBranchId?: string | null })._processBranchId).toBe('branch-1');
    expect((item.change_request as { process_branch_id?: string | null })?.process_branch_id).toBe(
      'branch-1'
    );
    expect((item.change_request as { suggestion_id?: string | null })?.suggestion_id).toBe(
      'suggestion-1'
    );
  });

  it('groups change requests into process branch sections with a legacy fallback', () => {
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

    expect(sections.map(section => section.branchId)).toEqual(['branch-1', 'branch-2', null]);
    expect(sections[0]).toMatchObject({
      title: 'First branch group',
      status: 'in_vote',
      editingMode: 'suggest_event',
      eventTitle: 'First event',
      totalCount: 1,
      openCount: 1,
    });
    expect(sections[0].documentContent).toBe(branchOneContent);
    expect(sections[0].discussions[0]?.processBranchId).toBe('branch-1');
    expect(sections[0].timelineItems[0]?.change_request_id).toBe('request-branch-1');
    expect(sections[1]).toMatchObject({
      title: 'Second branch group',
      editingMode: 'vote_internal',
      totalCount: 1,
      approvedCount: 1,
    });
    expect(sections[2]).toMatchObject({
      title: 'Main document',
      isLegacy: true,
      totalCount: 1,
    });
  });

  it('creates branch section items from confirmed branch discussions without persisted rows', () => {
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
      totalCount: 1,
      openCount: 1,
    });
    expect(sections[0].timelineItems).toHaveLength(1);
    expect(sections[0].timelineItems[0]?.change_request_id).toBe('suggestion-confirmed');
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
    expect(isVotingEditingMode('vote_event')).toBe(true);
    expect(isVotingEditingMode('event_final_closing_vote')).toBe(true);
    expect(isVotingEditingMode('vote_internal')).toBe(true);
    expect(isVotingEditingMode('suggest_event')).toBe(false);
  });
});
