import { describe, expect, it } from 'vitest';

import {
  buildCanonicalChangeRequestRecords,
  findDiscussionForChangeRequest,
  hasChangeRequestDiffSnapshot,
} from '../canonicalChangeRequests';

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

  it('keeps pending event suggestions without a persisted change request row', () => {
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

    expect(records).toHaveLength(1);
    expect(records[0].changeRequest).toBeNull();
    expect(records[0].discussion?.id).toBe('suggestion-pending');
    expect(records[0].displayCrId).toBe('CR-2');
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

  it('prefers persisted branch sequence numbers over stale discussion labels', () => {
    const [record] = buildCanonicalChangeRequestRecords({
      discussions: [
        {
          id: 'suggestion-1',
          crId: 'CR-1',
          changeRequestEntityId: 'cr-1',
        },
      ],
      changeRequests: [
        {
          id: 'cr-1',
          title: 'CR-1',
          branch_sequence_number: 7,
          status: 'open',
        },
      ],
    });

    expect(record.displayCrId).toBe('CR-7');
  });

  it('matches the persisted suggestion id before legacy title fallbacks', () => {
    const records = buildCanonicalChangeRequestRecords({
      discussions: [
        { id: 'suggestion-correct', crId: 'CR-1', title: 'Correct suggestion' },
        { id: 'suggestion-stale', crId: 'CR-2', title: 'Legacy title' },
      ],
      changeRequests: [
        {
          id: 'cr-1',
          suggestion_id: 'suggestion-correct',
          title: 'Legacy title',
          status: 'open',
        },
      ],
    });

    expect(records).toHaveLength(2);
    expect(records.find(record => record.changeRequest?.id === 'cr-1')?.discussion?.id).toBe(
      'suggestion-correct'
    );
  });

  it('recognizes renderable snapshots and rejects missing or empty snapshots', () => {
    expect(hasChangeRequestDiffSnapshot(null)).toBe(false);
    expect(hasChangeRequestDiffSnapshot({ id: 'empty' })).toBe(false);
    expect(
      hasChangeRequestDiffSnapshot({
        id: 'replace',
        change_type: 'replace',
        original_text: 'before',
        new_text: 'after',
      })
    ).toBe(true);
  });

  it('matches discussions through entity, canonical label, and legacy label fallbacks', () => {
    const discussions = [
      {
        id: 'entity-discussion',
        changeRequestEntityId: 'entity-row',
        processBranchId: 'branch-1',
      },
      { id: 'canonical-cr-id', crId: 'CR-4', process_branch_id: 'branch-1' },
      { id: 'canonical-title', title: 'CR-5', processBranchId: 'branch-1' },
      { id: 'legacy-cr-id', crId: 'Legacy', processBranchId: 'branch-1' },
      { id: 'legacy-title', title: 'Other legacy', processBranchId: 'branch-1' },
    ];

    expect(
      findDiscussionForChangeRequest(discussions, {
        id: 'entity-row',
        process_branch_id: 'branch-1',
      })?.id
    ).toBe('entity-discussion');
    expect(
      findDiscussionForChangeRequest(discussions, {
        id: 'sequence-row',
        processBranchId: 'branch-1',
        branchSequenceNumber: 4,
      })?.id
    ).toBe('canonical-cr-id');
    expect(
      findDiscussionForChangeRequest(discussions, {
        id: 'sequence-title-row',
        process_branch_id: 'branch-1',
        branch_sequence_number: 5,
      })?.id
    ).toBe('canonical-title');
    expect(
      findDiscussionForChangeRequest(discussions, {
        id: 'legacy-row',
        processBranchId: 'branch-1',
        title: 'Legacy',
      })?.id
    ).toBe('legacy-cr-id');
    expect(
      findDiscussionForChangeRequest(discussions, {
        id: 'other-legacy-row',
        processBranchId: 'branch-1',
        title: 'Other legacy',
      })?.id
    ).toBe('legacy-title');
    expect(
      findDiscussionForChangeRequest(discussions, {
        id: 'unmatched',
        processBranchId: 'other-branch',
        title: 'Legacy',
      })
    ).toBeNull();
  });

  it('ranks vote signals, explicit links, completion, finality, snapshots, and recency', () => {
    const cases = [
      [{ id: 'plain' }, { id: 'against', votes_against: 1 }, 'against'],
      [{ id: 'plain' }, { id: 'abstain', votes_abstain: 1 }, 'abstain'],
      [{ id: 'plain' }, { id: 'vote-row', votes: [{}] }, 'vote-row'],
      [{ id: 'plain' }, { id: 'completed', voting_status: 'completed' }, 'completed'],
      [
        { id: 'completed-reversed', voting_status: 'completed' },
        { id: 'plain-reversed' },
        'completed-reversed',
      ],
      [{ id: 'plain' }, { id: 'approved', status: 'approved' }, 'approved'],
      [{ id: 'approved-reversed', status: 'accepted' }, { id: 'plain-final' }, 'approved-reversed'],
      [{ id: 'plain' }, { id: 'rejected', status: 'rejected' }, 'rejected'],
      [{ id: 'plain' }, { id: 'declined', status: 'declined' }, 'declined'],
      [{ id: 'plain' }, { id: 'snapshot', change_type: 'insert', new_text: 'new' }, 'snapshot'],
      [
        { id: 'snapshot-reversed', change_type: 'insert', new_text: 'new' },
        { id: 'plain-snapshot' },
        'snapshot-reversed',
      ],
      [{ id: 'older', updated_at: 1 }, { id: 'newer', created_at: 2 }, 'newer'],
      [{ id: 'alpha' }, { id: 'zulu' }, 'zulu'],
    ] as const;

    for (const [left, right, expected] of cases) {
      const [record] = buildCanonicalChangeRequestRecords({
        discussions: [{ id: 'discussion', crId: 'CR-1' }],
        changeRequests: [
          { ...left, title: 'CR-1' },
          { ...right, title: 'CR-1' },
        ],
      });
      expect(record.changeRequest?.id).toBe(expected);
    }

    const [explicit] = buildCanonicalChangeRequestRecords({
      discussions: [{ id: 'discussion', crId: 'CR-1', changeRequestEntityId: 'explicit' }],
      changeRequests: [
        { id: 'other', title: 'CR-1' },
        { id: 'explicit', title: 'CR-1' },
      ],
    });
    expect(explicit.changeRequest?.id).toBe('explicit');
  });

  it('handles null collections, malformed discussions, row ids, whitespace labels, and title order', () => {
    expect(
      buildCanonicalChangeRequestRecords({ discussions: null, changeRequests: undefined })
    ).toEqual([]);

    const records = buildCanonicalChangeRequestRecords({
      discussions: [
        { id: '', crId: 'CR-9' },
        { id: 'missing-labels' },
        { id: 'duplicate', crId: 'CR-8', title: 'Zulu' },
        { id: 'duplicate', crId: 'CR-8', title: 'Ignored duplicate' },
      ],
      changeRequests: [
        { id: 'without-title' },
        { id: 'whitespace-title', title: '   ' },
        { id: 'alpha', title: 'Alpha' },
        { id: 'zulu', title: 'Zulu' },
      ],
    });

    expect(records.some(record => record.logicalKey === 'row-id:main:without-title')).toBe(true);
    expect(records.some(record => record.logicalKey === 'row-title:main:   ')).toBe(true);
    expect(records.find(record => record.discussion?.id === 'duplicate')?.displayTitle).toBe(
      'Zulu'
    );
    expect(records.map(record => record.displayTitle)).toEqual(
      [...records.map(record => record.displayTitle)].sort((a, b) => a.localeCompare(b))
    );
  });

  it('falls back from discussion and row titles to labels and logical keys', () => {
    const records = buildCanonicalChangeRequestRecords({
      discussions: [{ id: 'label-only', crId: 'CR-3', title: null }],
      changeRequests: [
        { id: 'cr-title', title: 'CR-custom' },
        { id: 'plain-title', title: 'Plain title' },
        { id: 'row-only' },
      ],
    });

    expect(records.find(record => record.discussion?.id === 'label-only')?.displayTitle).toBe(
      'CR-3'
    );
    expect(records.find(record => record.changeRequest?.id === 'cr-title')?.displayCrId).toBe(
      'CR-custom'
    );
    expect(
      records.find(record => record.changeRequest?.id === 'plain-title')?.displayCrId
    ).toBeNull();
    expect(records.find(record => record.changeRequest?.id === 'row-only')?.displayTitle).toBe(
      'main:row-only'
    );
  });
});
