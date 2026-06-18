import { describe, expect, it } from 'vitest';

import {
  countAcceptedMemberships,
  groupRelationshipsByGroup,
  groupWikiRelatedGroupsByOrientation,
} from '../groupWikiHelpers';

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

describe('groupWikiRelatedGroupsByOrientation', () => {
  it('classifies parent and child groups from structure rows and only enriches rights', () => {
    const currentGroup = { id: 'current', name: 'Current Group' };
    const childGroup = { id: 'child-a', name: 'Child A' };
    const parentGroup = { id: 'parent-a', name: 'Parent A' };
    const orphanChild = { id: 'orphan-child', name: 'Orphan Child' };
    const inactiveChild = { id: 'inactive-child', name: 'Inactive Child' };
    const siblingGroup = { id: 'sibling-a', name: 'Sibling A', group_type: 'sibling' };

    const result = groupWikiRelatedGroupsByOrientation(
      [
        {
          request_item_kind: 'structure',
          connection_type: 'hierarchy',
          group_id: 'current',
          related_group_id: 'child-a',
          parent_group_id: 'current',
          child_group_id: 'child-a',
          relationship_type: 'parent',
          status: 'active',
          with_right: null,
          group: currentGroup,
          related_group: childGroup,
        },
        {
          request_item_kind: 'right',
          connection_type: 'hierarchy',
          group_id: 'child-a',
          related_group_id: 'current',
          parent_group_id: 'current',
          child_group_id: 'child-a',
          relationship_type: 'child',
          status: 'active',
          with_right: 'amendmentRight',
          group: childGroup,
          related_group: currentGroup,
        },
        {
          request_item_kind: 'right',
          connection_type: 'hierarchy',
          group_id: 'child-a',
          related_group_id: 'current',
          parent_group_id: 'current',
          child_group_id: 'child-a',
          relationship_type: 'child',
          status: 'active',
          with_right: 'amendmentRight',
          group: childGroup,
          related_group: currentGroup,
        },
        {
          request_item_kind: 'right',
          connection_type: 'hierarchy',
          group_id: 'current',
          related_group_id: 'parent-a',
          parent_group_id: 'parent-a',
          child_group_id: 'current',
          relationship_type: 'child',
          status: 'active',
          with_right: 'rightToSpeak',
          group: currentGroup,
          related_group: parentGroup,
        },
        {
          request_item_kind: 'structure',
          connection_type: 'hierarchy',
          group_id: 'parent-a',
          related_group_id: 'current',
          parent_group_id: 'parent-a',
          child_group_id: 'current',
          relationship_type: 'parent',
          status: 'active',
          with_right: null,
          group: parentGroup,
          related_group: currentGroup,
        },
        {
          request_item_kind: 'right',
          connection_type: 'hierarchy',
          group_id: 'current',
          related_group_id: 'parent-a',
          parent_group_id: 'parent-a',
          child_group_id: 'current',
          relationship_type: 'child',
          status: 'active',
          with_right: 'rightToSpeak',
          group: currentGroup,
          related_group: parentGroup,
        },
        {
          request_item_kind: 'right',
          connection_type: 'hierarchy',
          group_id: 'orphan-child',
          related_group_id: 'current',
          parent_group_id: 'current',
          child_group_id: 'orphan-child',
          relationship_type: 'child',
          status: 'active',
          with_right: 'informationRight',
          group: orphanChild,
          related_group: currentGroup,
        },
        {
          request_item_kind: 'structure',
          connection_type: 'hierarchy',
          group_id: 'current',
          related_group_id: 'inactive-child',
          parent_group_id: 'current',
          child_group_id: 'inactive-child',
          relationship_type: 'parent',
          status: 'inactive',
          with_right: null,
          group: currentGroup,
          related_group: inactiveChild,
        },
        {
          request_item_kind: 'structure',
          connection_type: 'peer',
          group_id: 'current',
          related_group_id: 'sibling-a',
          parent_group_id: null,
          child_group_id: null,
          relationship_type: 'sibling',
          status: 'active',
          with_right: null,
          group: currentGroup,
          related_group: siblingGroup,
        },
      ],
      'current'
    );

    expect(result).toEqual({
      parentGroups: [{ group: parentGroup, rights: ['rightToSpeak'] }],
      childGroups: [{ group: childGroup, rights: ['amendmentRight'] }],
    });
  });
});
