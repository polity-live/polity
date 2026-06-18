import { describe, expect, it } from 'vitest';

import {
  canActivateHierarchyLink,
  getHierarchyLinkConflictUserIds,
  getHierarchyLinkDuplicatePathConflicts,
} from '../hierarchyLinkHelpers';
import type { NormalizedGroupRelationship } from '../../types/network.types';

function rel(
  overrides: Partial<NormalizedGroupRelationship> & Pick<NormalizedGroupRelationship, 'id'>
): NormalizedGroupRelationship {
  const groupId = overrides.group_id ?? 'parent';
  const relatedGroupId = overrides.related_group_id ?? 'child';
  return {
    id: overrides.id,
    connection_id: overrides.connection_id ?? `connection:${overrides.id}`,
    grant_id:
      overrides.grant_id ?? (overrides.with_right === null ? null : `grant:${overrides.id}`),
    membership_request_id: overrides.membership_request_id ?? null,
    request_item_kind: overrides.request_item_kind ?? 'right',
    group_id: groupId,
    related_group_id: relatedGroupId,
    relationship_type: overrides.relationship_type ?? null,
    connection_type: overrides.connection_type ?? 'hierarchy',
    parent_group_id: overrides.parent_group_id ?? groupId,
    child_group_id: overrides.child_group_id ?? relatedGroupId,
    with_right: 'with_right' in overrides ? (overrides.with_right ?? null) : 'passiveVotingRight',
    status: overrides.status ?? 'requested',
    initiator_group_id: overrides.initiator_group_id ?? null,
    created_at: overrides.created_at ?? 0,
    member_source_group_id: overrides.member_source_group_id ?? null,
    member_target_group_id: overrides.member_target_group_id ?? null,
    membership_mode: overrides.membership_mode ?? 'none',
    required_source_role_id: overrides.required_source_role_id ?? null,
    eligible_origin_group_ids: overrides.eligible_origin_group_ids ?? [],
    group: overrides.group ?? null,
    related_group: overrides.related_group ?? null,
  };
}

const overlappingMemberships = [
  { group_id: 'base-a', user_id: 'u1', source: 'direct', status: 'active' },
  { group_id: 'base-b', user_id: 'u1', source: 'direct', status: 'active' },
  { group_id: 'base-b', user_id: 'u2', source: 'direct', status: 'active' },
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

  it('treats relationship_type parent as the same hierarchy edge when the row direction is reversed', () => {
    const relationships = [
      rel({
        id: 'existing',
        status: 'active',
        with_right: 'informationRight',
        group_id: 'parent',
        related_group_id: 'base-a',
        relationship_type: 'child',
      }),
      rel({
        id: 'pending',
        status: 'requested',
        with_right: 'activeVotingRight',
        group_id: 'base-b',
        related_group_id: 'parent',
        relationship_type: 'parent',
        parent_group_id: 'parent',
        child_group_id: 'base-b',
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
      { group_id: 'base-a', user_id: 'u1', source: 'direct', status: 'active' },
      { group_id: 'base-b', user_id: 'u2', source: 'direct', status: 'active' },
    ];

    expect(getHierarchyLinkConflictUserIds(relationships[1], relationships, memberships)).toEqual(
      []
    );
    expect(canActivateHierarchyLink(relationships[1], relationships, memberships)).toBe(true);
  });

  it('blocks passive voting links that would create a duplicate hierarchy path', () => {
    const relationships = [
      rel({ id: 'root-mid-a', status: 'active', group_id: 'root', related_group_id: 'mid-a' }),
      rel({ id: 'mid-a-leaf', status: 'active', group_id: 'mid-a', related_group_id: 'leaf' }),
      rel({ id: 'root-mid-b', status: 'active', group_id: 'root', related_group_id: 'mid-b' }),
      rel({ id: 'pending', status: 'requested', group_id: 'mid-b', related_group_id: 'leaf' }),
    ];

    expect(getHierarchyLinkConflictUserIds(relationships[3], relationships, [])).toEqual([]);
    expect(getHierarchyLinkDuplicatePathConflicts(relationships[3], relationships)).toMatchObject([
      {
        baseGroupId: 'leaf',
        targetGroupId: 'root',
      },
    ]);
    expect(canActivateHierarchyLink(relationships[3], relationships, [])).toBe(false);
  });

  it('detects conflicts for structural hierarchy links without any right', () => {
    const relationships = [
      rel({ id: 'existing', status: 'active', group_id: 'parent', related_group_id: 'base-a' }),
      rel({
        id: 'pending',
        status: 'requested',
        with_right: null,
        group_id: 'parent',
        related_group_id: 'base-b',
      }),
    ];

    expect(
      getHierarchyLinkConflictUserIds(relationships[1], relationships, overlappingMemberships)
    ).toEqual(['u1']);
  });
});
