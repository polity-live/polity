import { describe, expect, it } from 'vitest';

import { buildCanonicalChangeRequestRecords } from '../canonicalChangeRequests';

describe('canonical change request records', () => {
  it('collapses discussion and duplicate rows into one logical change request', () => {
    const [record] = buildCanonicalChangeRequestRecords({
      discussions: [
        {
          id: 'suggestion-1',
          crId: 'CR-1',
          title: 'Replace dieser',
          changeRequestEntityId: null,
        },
      ],
      changeRequests: [
        {
          id: 'cr-voted',
          title: 'Replace dieser',
          status: 'accepted',
          voting_status: 'completed',
          votes_for: 1,
          votes_against: 0,
          votes_abstain: 0,
          created_at: 2_000,
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
          created_at: 1_000,
        },
      ],
    });

    expect(record.changeRequest?.id).toBe('cr-voted');
    expect(record.snapshotChangeRequest?.id).toBe('cr-diff');
    expect(record.duplicateChangeRequests.map(cr => cr.id).sort()).toEqual(['cr-diff', 'cr-voted']);
    expect(record.displayCrId).toBe('CR-1');
    expect(record.displayTitle).toBe('Replace dieser');
  });

  it('uses the voted duplicate as canonical when an explicit duplicate has no votes', () => {
    const [record] = buildCanonicalChangeRequestRecords({
      discussions: [
        {
          id: 'suggestion-1',
          crId: 'CR-1',
          title: 'Replace dieser',
          changeRequestEntityId: 'cr-linked',
        },
      ],
      changeRequests: [
        {
          id: 'cr-linked',
          title: 'CR-1',
          status: 'open',
          votes_for: 0,
          votes_against: 0,
          votes_abstain: 0,
          change_type: 'replace',
          original_text: 'Before',
          new_text: 'After',
        },
        {
          id: 'cr-voted',
          title: 'Replace dieser',
          status: 'accepted',
          voting_status: 'completed',
          votes_for: 1,
          votes_against: 0,
          votes_abstain: 0,
        },
      ],
    });

    expect(record.changeRequest?.id).toBe('cr-voted');
    expect(record.snapshotChangeRequest?.id).toBe('cr-linked');
  });

  it('keeps same-numbered change requests separate across process branches', () => {
    const records = buildCanonicalChangeRequestRecords({
      discussions: [],
      changeRequests: [
        {
          id: 'branch-1-cr-1',
          process_branch_id: 'branch-1',
          title: 'CR-1',
          status: 'open',
          votes_for: 0,
          votes_against: 1,
          votes_abstain: 0,
        },
        {
          id: 'branch-2-cr-1',
          process_branch_id: 'branch-2',
          title: 'CR-1',
          status: 'open',
          votes_for: 1,
          votes_against: 0,
          votes_abstain: 0,
        },
      ],
    });

    expect(records).toHaveLength(2);
    expect(records.map(record => record.changeRequest?.id).sort()).toEqual([
      'branch-1-cr-1',
      'branch-2-cr-1',
    ]);
    expect(
      records.find(record => record.changeRequest?.process_branch_id === 'branch-2')?.changeRequest
        ?.votes_for
    ).toBe(1);
  });

  it('ignores pending event suggestions without a persisted change request row', () => {
    const records = buildCanonicalChangeRequestRecords({
      discussions: [
        {
          id: 'suggestion-pending',
          crId: 'CR-2',
          confirmationStatus: 'pending',
        },
      ],
      changeRequests: [],
    });

    expect(records).toEqual([]);
  });

  it('keeps confirmed event suggestions without a persisted change request row', () => {
    const [record] = buildCanonicalChangeRequestRecords({
      discussions: [
        {
          id: 'suggestion-confirmed',
          crId: 'CR-2',
          confirmationStatus: 'confirmed',
        },
      ],
      changeRequests: [],
    });

    expect(record.changeRequest).toBeNull();
    expect(record.discussion?.id).toBe('suggestion-confirmed');
    expect(record.displayCrId).toBe('CR-2');
  });
});
