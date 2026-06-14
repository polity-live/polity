import { describe, expect, it } from 'vitest';

import { countAcceptedMemberships, groupRelationshipsByGroup } from '../groupWikiHelpers';

describe('countAcceptedMemberships', () => {
  it('counts only accepted membership statuses', () => {
    expect(
      countAcceptedMemberships([
        { id: 'active', status: 'active' },
        { id: 'member', status: 'member' },
        { id: 'admin', status: 'admin' },
        { id: 'requested', status: 'requested' },
        { id: 'invited', status: 'invited' },
        { id: 'unknown', status: null },
      ])
    ).toBe(3);
  });
});

describe('groupRelationshipsByGroup', () => {
  it('returns only active child groups and aggregates their rights', () => {
    const relationships = [
      {
        status: 'active',
        with_right: 'passiveVotingRight',
        related_group: { id: 'child-a', name: 'Child A' },
      },
      {
        status: 'active',
        with_right: 'amendmentRight',
        related_group: { id: 'child-a', name: 'Child A' },
      },
      {
        status: 'requested',
        with_right: 'rightToSpeak',
        related_group: { id: 'child-b', name: 'Child B' },
      },
      {
        status: 'inactive',
        with_right: 'informationRight',
        related_group: { id: 'child-c', name: 'Child C' },
      },
    ];

    expect(groupRelationshipsByGroup(relationships, 'child')).toEqual([
      {
        group: { id: 'child-a', name: 'Child A' },
        rights: ['passiveVotingRight', 'amendmentRight'],
      },
    ]);
  });

  it('returns only active parent groups', () => {
    const relationships = [
      {
        status: null,
        with_right: 'passiveVotingRight',
        group: { id: 'parent-a', name: 'Parent A' },
      },
      {
        status: 'active',
        with_right: 'rightToSpeak',
        group: { id: 'parent-b', name: 'Parent B' },
      },
      {
        status: 'pending',
        with_right: 'informationRight',
        group: { id: 'parent-c', name: 'Parent C' },
      },
    ];

    expect(groupRelationshipsByGroup(relationships, 'parent')).toEqual([
      {
        group: { id: 'parent-b', name: 'Parent B' },
        rights: ['rightToSpeak'],
      },
    ]);
  });
});
