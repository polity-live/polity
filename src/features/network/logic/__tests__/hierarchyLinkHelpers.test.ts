import { describe, expect, it } from 'vitest';

import { canActivateHierarchyLink, getHierarchyLinkConflictUserIds } from '../hierarchyLinkHelpers';
import type { NormalizedGroupRelationship } from '../../types/network.types';

function rel(
  overrides: Partial<NormalizedGroupRelationship> & Pick<NormalizedGroupRelationship, 'id'>
): NormalizedGroupRelationship {
  return {
    id: overrides.id,
    group_id: overrides.group_id ?? 'parent',
    related_group_id: overrides.related_group_id ?? 'child',
    relationship_type: overrides.relationship_type ?? null,
    with_right: overrides.with_right ?? 'passiveVotingRight',
    status: overrides.status ?? 'requested',
    initiator_group_id: overrides.initiator_group_id ?? null,
    created_at: overrides.created_at ?? 0,
    group: overrides.group ?? null,
    related_group: overrides.related_group ?? null,
  };
}

const overlappingMemberships = [
  { group_id: 'base-a', user_id: 'u1', source: 'direct' },
  { group_id: 'base-b', user_id: 'u1', source: 'direct' },
  { group_id: 'base-b', user_id: 'u2', source: 'direct' },
];

describe('hierarchyLinkHelpers', () => {
  it('detects conflicts for passive voting right links', () => {
    const relationships = [
      rel({ id: 'existing', status: 'active', group_id: 'parent', related_group_id: 'base-a' }),
      rel({
        id: 'pending',
        status: 'requested',
        group_id: 'parent',
        related_group_id: 'base-b',
      }),
    ];

    expect(
      getHierarchyLinkConflictUserIds(relationships[1], relationships, overlappingMemberships)
    ).toEqual(['u1']);
    expect(canActivateHierarchyLink(relationships[1], relationships, overlappingMemberships)).toBe(
      false
    );
  });

  it('detects conflicts for information right when a passive sibling exists', () => {
    const relationships = [
      rel({
        id: 'pvr',
        status: 'active',
        with_right: 'passiveVotingRight',
        group_id: 'parent',
        related_group_id: 'base-a',
      }),
      rel({
        id: 'pending',
        status: 'requested',
        with_right: 'informationRight',
        group_id: 'parent',
        related_group_id: 'base-b',
      }),
    ];

    expect(
      getHierarchyLinkConflictUserIds(relationships[1], relationships, overlappingMemberships)
    ).toEqual(['u1']);
  });

  it('detects conflicts for information right when only information siblings exist', () => {
    const relationships = [
      rel({
        id: 'existing',
        status: 'active',
        with_right: 'informationRight',
        group_id: 'parent',
        related_group_id: 'base-a',
      }),
      rel({
        id: 'pending',
        status: 'requested',
        with_right: 'activeVotingRight',
        group_id: 'parent',
        related_group_id: 'base-b',
      }),
    ];

    expect(
      getHierarchyLinkConflictUserIds(relationships[1], relationships, overlappingMemberships)
    ).toEqual(['u1']);
  });

  it('detects conflicts for amendment and speak rights', () => {
    const memberships = overlappingMemberships;

    for (const right of ['amendmentRight', 'rightToSpeak'] as const) {
      const relationships = [
        rel({
          id: 'existing',
          status: 'active',
          with_right: 'informationRight',
          group_id: 'parent',
          related_group_id: 'base-a',
        }),
        rel({
          id: 'pending',
          status: 'requested',
          with_right: right,
          group_id: 'parent',
          related_group_id: 'base-b',
        }),
      ];

      expect(getHierarchyLinkConflictUserIds(relationships[1], relationships, memberships)).toEqual(
        ['u1']
      );
    }
  });

  it('allows activation when member sets are disjoint', () => {
    const relationships = [
      rel({ id: 'existing', status: 'active', group_id: 'parent', related_group_id: 'base-a' }),
      rel({
        id: 'pending',
        status: 'requested',
        with_right: 'informationRight',
        group_id: 'parent',
        related_group_id: 'base-b',
      }),
    ];

    const memberships = [
      { group_id: 'base-a', user_id: 'u1', source: 'direct' },
      { group_id: 'base-b', user_id: 'u2', source: 'direct' },
    ];

    expect(getHierarchyLinkConflictUserIds(relationships[1], relationships, memberships)).toEqual(
      []
    );
    expect(canActivateHierarchyLink(relationships[1], relationships, memberships)).toBe(true);
  });
});
