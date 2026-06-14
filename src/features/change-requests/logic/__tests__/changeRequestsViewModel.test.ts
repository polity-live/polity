import { describe, expect, it } from 'vitest';

import type { ChangeRequest } from '../../hooks/useChangeRequests';
import {
  getAllChangeRequests,
  isVotingEditingMode,
  mapChangeRequestsToDiffMap,
  mapChangeRequestsToDiscussions,
  mapChangeRequestsToSummaries,
} from '../changeRequestsViewModel';

function changeRequest(overrides: Partial<ChangeRequest>): ChangeRequest {
  return {
    id: 'cr-row-1',
    crId: 'CR-1',
    crNumber: 1,
    title: 'CR-1',
    description: '',
    type: 'text',
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
    comments: [],
    votes: [],
    ...overrides,
  };
}

describe('change request view model helpers', () => {
  it('keeps open, approved, and declined requests in display order', () => {
    const open = changeRequest({ id: 'open', crId: 'CR-1' });
    const approved = changeRequest({ id: 'approved', crId: 'CR-2', isResolved: true });
    const declined = changeRequest({ id: 'declined', crId: 'CR-3', isResolved: true });

    expect(
      getAllChangeRequests({
        openChangeRequests: [open],
        approvedChangeRequests: [approved],
        declinedChangeRequests: [declined],
      }).map(request => request.id)
    ).toEqual(['open', 'approved', 'declined']);
  });

  it('maps summaries, diffs, and discussions without UI dependencies', () => {
    const requests = [
      changeRequest({
        id: 'request-1',
        crId: 'CR-7',
        title: '',
        description: 'Change summary',
        type: 'property',
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
    });
    expect(mapChangeRequestsToDiffMap(requests)['request-1']).toMatchObject({
      changeType: 'property',
      originalText: 'Before',
      newText: 'After',
      justification: 'Cleaner wording',
    });
    expect(mapChangeRequestsToDiscussions(requests)[0]).toMatchObject({
      id: 'request-1',
      crId: 'CR-7',
      userId: 'user-1',
      isResolved: false,
    });
  });

  it('recognizes internal and event voting modes', () => {
    expect(isVotingEditingMode('vote_event')).toBe(true);
    expect(isVotingEditingMode('vote_internal')).toBe(true);
    expect(isVotingEditingMode('suggest_event')).toBe(false);
  });
});
