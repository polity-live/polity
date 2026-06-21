import { describe, expect, it } from 'vitest';

import { extractAmendmentCRSummaries } from '../extractAmendmentCRSummaries';

describe('extractAmendmentCRSummaries', () => {
  it('merges saved vote state and duplicate snapshot diff into one summary', () => {
    const summaries = extractAmendmentCRSummaries(
      [
        {
          id: 'suggestion-1',
          crId: 'CR-1',
          title: 'Replace dieser',
          description: 'Replace dieser',
        },
      ],
      [
        {
          id: 'cr-voted',
          title: 'Replace dieser',
          status: 'accepted',
          voting_status: 'completed',
          votes_for: 1,
          votes_against: 0,
          votes_abstain: 0,
        },
        {
          id: 'cr-diff',
          title: 'CR-1',
          status: 'rejected',
          voting_status: 'completed',
          votes_for: 0,
          votes_against: 0,
          votes_abstain: 0,
          change_type: 'remove',
          original_text: 'Wird entfernt',
          new_text: null,
          original_properties: null,
          new_properties: null,
        },
      ],
      {
        branches: [{ id: 'branch-1', created_at: 1 }],
        processBranchId: 'branch-1',
      }
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: 'cr-voted',
      changeRequestEntityId: 'cr-voted',
      discussionId: 'suggestion-1',
      crId: 'CR-1',
      displayCrId: 'Branch 1 CR-1',
      processBranchId: 'branch-1',
      title: 'Replace dieser',
      status: 'accepted',
      votesFor: 1,
      votesAgainst: 0,
      type: 'remove',
      text: 'Wird entfernt',
    });
  });
});
