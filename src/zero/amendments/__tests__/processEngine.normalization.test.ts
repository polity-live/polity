import { describe, expect, it } from 'vitest';
import { normalizeMainScopeChangeRequestsForFirstBranch } from '../process-engine-normalization';

describe('first process branch normalization', () => {
  it('filters malformed values, orders change requests, and repairs generated titles', () => {
    const result = normalizeMainScopeChangeRequestsForFirstBranch(
      [],
      [
        null,
        'invalid',
        {},
        { id: 7 },
        { id: 'cr-infinite-number', created_at: Number.POSITIVE_INFINITY, title: 'CR-99' },
        { id: 'cr-invalid-date', created_at: 'invalid', title: null },
        { id: 'cr-custom', created_at: '2026-01-02T00:00:00.000Z', title: 'Custom' },
        { id: 'cr-tie-b', created_at: 100, title: 'CR-4' },
        { id: 'cr-tie-a', created_at: 100, title: undefined },
      ]
    );

    expect(result.changeRequests.map(changeRequest => changeRequest.id)).toEqual([
      'cr-tie-a',
      'cr-tie-b',
      'cr-custom',
      'cr-infinite-number',
      'cr-invalid-date',
    ]);
    expect(result.changeRequests.map(changeRequest => changeRequest.title)).toEqual([
      'CR-1',
      'CR-2',
      'Custom',
      'CR-4',
      'CR-5',
    ]);
  });

  it('links only one-to-one discussion candidates and leaves ambiguous candidates untouched', () => {
    const discussionWithoutId = { body: 'No id' };
    const discussionWithNumericId = { id: 7, body: 'Numeric id' };
    const discussionWithEmptyId = { id: '', body: 'Empty id' };
    const discussionWithoutCandidate = { id: 'discussion-none' };
    const discussionAmbiguousCandidate = { id: 'discussion-ambiguous' };
    const duplicateDiscussionA = { id: 'discussion-duplicate-a', changeRequestEntityId: 'cr-dup' };
    const duplicateDiscussionB = { id: 'discussion-duplicate-b', changeRequestEntityId: 'cr-dup' };
    const result = normalizeMainScopeChangeRequestsForFirstBranch(
      [
        null,
        'invalid',
        discussionWithoutId,
        discussionWithNumericId,
        discussionWithEmptyId,
        discussionWithoutCandidate,
        discussionAmbiguousCandidate,
        { id: 'discussion-direct' },
        { id: 'discussion-entity', changeRequestEntityId: 'cr-entity' },
        duplicateDiscussionA,
        duplicateDiscussionB,
      ],
      [
        { id: 'cr-direct', suggestion_id: 'discussion-direct', created_at: 1 },
        { id: 'cr-entity', suggestion_id: null, created_at: 2 },
        { id: 'cr-ambiguous-a', suggestion_id: 'discussion-ambiguous', created_at: 3 },
        { id: 'cr-ambiguous-b', suggestion_id: 'discussion-ambiguous', created_at: 4 },
        { id: 'cr-dup', suggestion_id: null, created_at: 5 },
      ]
    );

    expect(result.discussions).toHaveLength(9);
    expect(result.discussions).toEqual(
      expect.arrayContaining([
        discussionWithoutId,
        discussionWithNumericId,
        discussionWithEmptyId,
        discussionWithoutCandidate,
        discussionAmbiguousCandidate,
        duplicateDiscussionA,
        duplicateDiscussionB,
      ])
    );
    expect(result.discussions).toContainEqual(
      expect.objectContaining({
        id: 'discussion-direct',
        crId: 'CR-1',
        changeRequestEntityId: 'cr-direct',
        branchSequenceNumber: 1,
      })
    );
    expect(result.discussions).toContainEqual(
      expect.objectContaining({
        id: 'discussion-entity',
        crId: 'CR-2',
        changeRequestEntityId: 'cr-entity',
        branchScopedCrNumber: 2,
      })
    );
    expect(result.changeRequests.find(changeRequest => changeRequest.id === 'cr-direct')).toEqual(
      expect.objectContaining({ suggestion_id: 'discussion-direct' })
    );
    expect(result.changeRequests.find(changeRequest => changeRequest.id === 'cr-entity')).toEqual(
      expect.objectContaining({ suggestion_id: 'discussion-entity' })
    );
    expect(result.changeRequests.find(changeRequest => changeRequest.id === 'cr-dup')).toEqual(
      expect.objectContaining({ suggestion_id: null })
    );
  });
});
