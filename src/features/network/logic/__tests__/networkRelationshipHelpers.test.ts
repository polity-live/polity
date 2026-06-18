import { featureThemeClassName } from '@/features/shared/theme';
import { describe, expect, it } from 'vitest';

import {
  buildDirectRelationships,
  buildIndirectRelationships,
  buildMixedRelationshipGraph,
  getAcceptedSiblingGroups,
  getGroupRelationshipKind,
  isActiveGroupRelationshipStatus,
  isAcceptedSiblingRelationship,
} from '../networkRelationshipHelpers';
import type { NormalizedGroupRelationship } from '../../types/network.types';

interface GroupStub {
  id: string;
  name: string | null;
}

interface RelationshipTestOverrides extends Omit<
  Partial<NormalizedGroupRelationship>,
  'group' | 'related_group'
> {
  group?: GroupStub;
  related_group?: GroupStub;
}

function groupStub(id: string, name: string): NonNullable<NormalizedGroupRelationship['group']> {
  return {
    id,
    name,
  } as NonNullable<NormalizedGroupRelationship['group']>;
}

function rel(
  overrides: RelationshipTestOverrides & Pick<NormalizedGroupRelationship, 'id'>
): NormalizedGroupRelationship {
  const groupId = overrides.group_id ?? 'anchor';
  const relatedGroupId = overrides.related_group_id ?? 'sibling-a';
  const relationshipType =
    overrides.relationship_type === undefined ? 'sibling' : overrides.relationship_type;
  const connectionType =
    overrides.connection_type ?? (relationshipType === 'sibling' ? 'peer' : 'hierarchy');
  const parentGroupId =
    connectionType === 'hierarchy'
      ? (overrides.parent_group_id ?? (relationshipType === 'parent' ? relatedGroupId : groupId))
      : null;
  const childGroupId =
    connectionType === 'hierarchy'
      ? (overrides.child_group_id ?? (relationshipType === 'parent' ? groupId : relatedGroupId))
      : null;
  const membershipMode = overrides.membership_mode ?? 'none';
  return {
    id: overrides.id,
    connection_id: overrides.connection_id ?? `connection:${overrides.id}`,
    grant_id:
      overrides.grant_id ?? (overrides.with_right === null ? null : `grant:${overrides.id}`),
    membership_request_id: overrides.membership_request_id ?? null,
    request_item_kind: overrides.request_item_kind ?? 'right',
    group_id: groupId,
    related_group_id: relatedGroupId,
    relationship_type: relationshipType,
    connection_type: connectionType,
    parent_group_id: parentGroupId,
    child_group_id: childGroupId,
    with_right: 'with_right' in overrides ? (overrides.with_right ?? null) : 'informationRight',
    status: overrides.status ?? 'active',
    initiator_group_id: overrides.initiator_group_id ?? 'anchor',
    created_at: overrides.created_at ?? 0,
    member_source_group_id:
      overrides.member_source_group_id ?? (membershipMode === 'none' ? null : groupId),
    member_target_group_id:
      overrides.member_target_group_id ?? (membershipMode === 'none' ? null : relatedGroupId),
    membership_mode: membershipMode,
    required_source_role_id: overrides.required_source_role_id ?? null,
    eligible_origin_group_ids: overrides.eligible_origin_group_ids ?? [],
    group: overrides.group
      ? groupStub(overrides.group.id, overrides.group.name ?? 'Anchor')
      : groupStub(groupId, 'Anchor'),
    related_group: overrides.related_group
      ? groupStub(overrides.related_group.id, overrides.related_group.name ?? 'Sibling A')
      : groupStub(relatedGroupId, 'Sibling A'),
  };
}

describe('networkRelationshipHelpers', () => {
  it('treats only active sibling relationships as accepted', () => {
    expect(isAcceptedSiblingRelationship(rel({ id: 'active-sibling', status: 'active' }))).toBe(
      true
    );
    expect(isAcceptedSiblingRelationship(rel({ id: 'accepted-sibling', status: 'accepted' }))).toBe(
      false
    );
    expect(isAcceptedSiblingRelationship(rel({ id: 'pending-sibling', status: 'pending' }))).toBe(
      false
    );
    expect(
      isAcceptedSiblingRelationship(
        rel({ id: 'active-parent', relationship_type: 'parent', status: 'active' })
      )
    ).toBe(false);
  });

  it('returns only unique accepted sibling groups for the current group', () => {
    const siblingGroups = getAcceptedSiblingGroups(
      [
        rel({ id: 'accepted-a', related_group_id: 'sibling-a' }),
        rel({
          id: 'duplicate-a',
          related_group_id: 'sibling-a',
          with_right: 'rightToSpeak',
        }),
        rel({
          id: 'accepted-b-reversed',
          group_id: 'sibling-b',
          related_group_id: 'anchor',
          group: { id: 'sibling-b', name: 'Sibling B' },
          related_group: { id: 'anchor', name: 'Anchor' },
        }),
        rel({ id: 'pending-c', related_group_id: 'sibling-c', status: 'pending' }),
      ],
      'anchor'
    );

    expect(siblingGroups.map(group => group.id)).toEqual(['sibling-a', 'sibling-b']);
  });

  it('does not traverse into active islands hidden behind pending relationships', () => {
    const anchorId = 'group-a';
    const stableRelationships = [
      rel({
        id: 'active-a-b',
        group_id: anchorId,
        related_group_id: 'group-b',
        relationship_type: 'child',
        group: { id: anchorId, name: 'Group A' },
        related_group: { id: 'group-b', name: 'Group B' },
        status: 'active',
      }),
      rel({
        id: 'pending-a-c',
        group_id: anchorId,
        related_group_id: 'group-c',
        relationship_type: 'child',
        initiator_group_id: anchorId,
        group: { id: anchorId, name: 'Group A' },
        related_group: { id: 'group-c', name: 'Group C' },
        status: 'requested',
      }),
      rel({
        id: 'active-c-d',
        group_id: 'group-c',
        related_group_id: 'group-d',
        relationship_type: 'child',
        group: { id: 'group-c', name: 'Group C' },
        related_group: { id: 'group-d', name: 'Group D' },
        status: 'active',
      }),
    ].filter(rel => getGroupRelationshipKind(rel, anchorId) !== null);

    const traversalRelationships = stableRelationships.filter(
      relationship =>
        relationship.relationship_type !== 'sibling' &&
        isActiveGroupRelationshipStatus(relationship.status)
    );

    const relationshipTree = buildIndirectRelationships(traversalRelationships, anchorId);

    expect(relationshipTree.children.map(child => child.group.id)).toEqual(['group-b']);
    expect(relationshipTree.children.some(child => child.group.id === 'group-c')).toBe(false);
    expect(relationshipTree.children.some(child => child.group.id === 'group-d')).toBe(false);
  });

  it('keeps matching outgoing request relationships visible for request filters', () => {
    const anchorId = 'group-a';
    const stableRelationships = [
      rel({
        id: 'active-a-b',
        group_id: anchorId,
        related_group_id: 'group-b',
        relationship_type: 'child',
        group: { id: anchorId, name: 'Group A' },
        related_group: { id: 'group-b', name: 'Group B' },
        status: 'active',
      }),
      rel({
        id: 'pending-a-c',
        group_id: anchorId,
        related_group_id: 'group-c',
        relationship_type: 'child',
        initiator_group_id: anchorId,
        group: { id: anchorId, name: 'Group A' },
        related_group: { id: 'group-c', name: 'Group C' },
        status: 'requested',
      }),
      rel({
        id: 'active-c-d',
        group_id: 'group-c',
        related_group_id: 'group-d',
        relationship_type: 'child',
        group: { id: 'group-c', name: 'Group C' },
        related_group: { id: 'group-d', name: 'Group D' },
        status: 'active',
      }),
    ].filter(rel => getGroupRelationshipKind(rel, anchorId) !== null);

    const traversalRelationships = stableRelationships.filter(
      relationship => getGroupRelationshipKind(relationship, anchorId) === 'outgoing'
    );

    const relationshipTree = buildDirectRelationships(traversalRelationships, anchorId);

    expect(relationshipTree.children.map(child => child.group.id)).toEqual(['group-c']);
    expect(relationshipTree.children.some(child => child.group.id === 'group-d')).toBe(false);
    expect(relationshipTree.parents).toEqual([]);
  });

  it('keeps structural relationships without rights visible without adding empty right entries', () => {
    const relationshipTree = buildDirectRelationships(
      [
        rel({
          id: 'structural-a-b',
          group_id: 'group-a',
          related_group_id: 'group-b',
          relationship_type: 'child',
          with_right: null,
          membership_mode: 'all_members',
          group: { id: 'group-a', name: 'Group A' },
          related_group: { id: 'group-b', name: 'Group B' },
        }),
      ],
      'group-a'
    );

    expect(relationshipTree.children).toHaveLength(1);
    expect(relationshipTree.children[0]?.group.id).toBe('group-b');
    expect(relationshipTree.children[0]?.rights).toEqual([]);
    expect(relationshipTree.children[0]?.membershipMode).toBe('all_members');
    expect(relationshipTree.children[0]?.membershipDirection).toBe('current_members_to_partner');
  });

  it('prefers the active non-none membership rule over a placeholder none row', () => {
    const relationshipTree = buildDirectRelationships(
      [
        rel({
          id: 'forward-none',
          group_id: 'group-a',
          related_group_id: 'group-b',
          relationship_type: 'child',
          with_right: null,
          membership_mode: 'none',
          group: { id: 'group-a', name: 'Group A' },
          related_group: { id: 'group-b', name: 'Group B' },
        }),
        rel({
          id: 'backward-all-members',
          group_id: 'group-b',
          related_group_id: 'group-a',
          relationship_type: 'parent',
          with_right: null,
          membership_mode: 'all_members',
          member_source_group_id: 'group-b',
          member_target_group_id: 'group-a',
          group: { id: 'group-b', name: 'Group B' },
          related_group: { id: 'group-a', name: 'Group A' },
        }),
      ],
      'group-a'
    );

    expect(relationshipTree.children).toHaveLength(1);
    expect(relationshipTree.children[0]?.membershipMode).toBe('all_members');
    expect(relationshipTree.children[0]?.membershipDirection).toBe('partner_members_to_current');
  });

  it('keeps indirect sibling groups attached to the reachable child branch', () => {
    const relationshipTree = buildMixedRelationshipGraph(
      [
        rel({
          id: 'active-a-b',
          group_id: 'group-a',
          related_group_id: 'group-b',
          relationship_type: 'child',
          group: { id: 'group-a', name: 'Group A' },
          related_group: { id: 'group-b', name: 'Group B' },
        }),
        rel({
          id: 'active-b-c',
          group_id: 'group-b',
          related_group_id: 'group-c',
          relationship_type: 'sibling',
          group: { id: 'group-b', name: 'Group B' },
          related_group: { id: 'group-c', name: 'Group C' },
        }),
      ],
      'group-a'
    );

    expect(
      relationshipTree.children.map(child => ({
        id: child.group.id,
        level: child.level,
        parentId: child.parentId,
      }))
    ).toEqual([{ id: 'group-b', level: 1, parentId: 'group-a' }]);
    expect(
      relationshipTree.siblingAttachments.map(sibling => ({
        id: sibling.group.id,
        anchorId: sibling.anchorId,
        branch: sibling.branch,
        level: sibling.level,
      }))
    ).toEqual([
      {
        id: 'group-c',
        anchorId: 'group-b',
        branch: 'child',
        level: 1,
      },
    ]);
  });

  it('treats a root sibling as the anchor for indirect parent traversal', () => {
    const relationshipTree = buildMixedRelationshipGraph(
      [
        rel({
          id: 'active-a-b',
          group_id: 'group-a',
          related_group_id: 'group-b',
          relationship_type: 'child',
          group: { id: 'group-a', name: 'Group A' },
          related_group: { id: 'group-b', name: 'Group B' },
        }),
        rel({
          id: 'active-b-c',
          group_id: 'group-b',
          related_group_id: 'group-c',
          relationship_type: 'sibling',
          group: { id: 'group-b', name: 'Group B' },
          related_group: { id: 'group-c', name: 'Group C' },
        }),
      ],
      'group-c'
    );

    expect(
      relationshipTree.siblingAttachments.map(sibling => ({
        id: sibling.group.id,
        anchorId: sibling.anchorId,
        branch: sibling.branch,
        level: sibling.level,
      }))
    ).toEqual([
      {
        id: 'group-b',
        anchorId: 'group-c',
        branch: 'root-sibling',
        level: 0,
      },
    ]);
    expect(
      relationshipTree.parents.map(parent => ({
        id: parent.group.id,
        childId: parent.childId,
        level: parent.level,
      }))
    ).toEqual([{ id: 'group-a', childId: 'group-b', level: 1 }]);
  });

  it('preserves hierarchy depth when traversing through siblings', () => {
    const relationshipTree = buildMixedRelationshipGraph(
      [
        rel({
          id: 'active-a-b',
          group_id: 'group-a',
          related_group_id: 'group-b',
          relationship_type: 'child',
          group: { id: 'group-a', name: 'Group A' },
          related_group: { id: 'group-b', name: 'Group B' },
        }),
        rel({
          id: 'active-b-c',
          group_id: 'group-b',
          related_group_id: 'group-c',
          relationship_type: 'sibling',
          group: { id: 'group-b', name: 'Group B' },
          related_group: { id: 'group-c', name: 'Group C' },
        }),
        rel({
          id: 'active-c-d',
          group_id: 'group-c',
          related_group_id: 'group-d',
          relationship_type: 'child',
          group: { id: 'group-c', name: 'Group C' },
          related_group: { id: 'group-d', name: 'Group D' },
        }),
      ],
      'group-a'
    );

    expect(
      relationshipTree.siblingAttachments.map(sibling => ({
        id: sibling.group.id,
        anchorId: sibling.anchorId,
        level: sibling.level,
      }))
    ).toEqual([{ id: 'group-c', anchorId: 'group-b', level: 1 }]);
    expect(
      relationshipTree.children.map(child => ({
        id: child.group.id,
        parentId: child.parentId,
        level: child.level,
      }))
    ).toEqual([
      { id: 'group-b', parentId: 'group-a', level: 1 },
      { id: 'group-d', parentId: 'group-c', level: 2 },
    ]);
  });

  it('does not traverse through pending sibling edges into active descendants', () => {
    const relationshipTree = buildMixedRelationshipGraph(
      [
        rel({
          id: 'active-a-b',
          group_id: 'group-a',
          related_group_id: 'group-b',
          relationship_type: 'child',
          group: { id: 'group-a', name: 'Group A' },
          related_group: { id: 'group-b', name: 'Group B' },
        }),
        rel({
          id: 'pending-b-c',
          group_id: 'group-b',
          related_group_id: 'group-c',
          relationship_type: 'sibling',
          status: 'pending',
          initiator_group_id: 'group-b',
          group: { id: 'group-b', name: 'Group B' },
          related_group: { id: 'group-c', name: 'Group C' },
        }),
        rel({
          id: 'active-c-d',
          group_id: 'group-c',
          related_group_id: 'group-d',
          relationship_type: 'child',
          group: { id: 'group-c', name: 'Group C' },
          related_group: { id: 'group-d', name: 'Group D' },
        }),
      ],
      'group-a'
    );

    expect(relationshipTree.siblingAttachments).toEqual([]);
    expect(relationshipTree.children.map(child => child.group.id)).toEqual(['group-b']);
    expect(relationshipTree.children.some(child => child.group.id === 'group-d')).toBe(false);
  });

  it('keeps the shallowest mixed placement when a node is reachable through multiple paths', () => {
    const relationshipTree = buildMixedRelationshipGraph(
      [
        rel({
          id: 'active-a-b',
          group_id: 'group-a',
          related_group_id: 'group-b',
          relationship_type: 'child',
          group: { id: 'group-a', name: 'Group A' },
          related_group: { id: 'group-b', name: 'Group B' },
        }),
        rel({
          id: 'active-a-c',
          group_id: 'group-a',
          related_group_id: 'group-c',
          relationship_type: 'child',
          group: { id: 'group-a', name: 'Group A' },
          related_group: { id: 'group-c', name: 'Group C' },
        }),
        rel({
          id: 'active-b-c',
          group_id: 'group-b',
          related_group_id: 'group-c',
          relationship_type: 'sibling',
          with_right: 'rightToSpeak',
          group: { id: 'group-b', name: 'Group B' },
          related_group: { id: 'group-c', name: 'Group C' },
        }),
      ],
      'group-a'
    );

    expect(relationshipTree.children.map(child => child.group.id)).toEqual(['group-b', 'group-c']);
    expect(relationshipTree.siblingAttachments).toEqual([]);
  });

  it(featureThemeClassName('networkNetworkRelationshipHelpersDangerGradientSurface'), () => {
    const grants = [
      rel({
        id: 'grant-b2-h2',
        grant_id: 'grant-b2-h2',
        group_id: 'B2',
        related_group_id: 'H2',
        relationship_type: 'child',
        parent_group_id: 'H2',
        child_group_id: 'B2',
        with_right: 'amendmentRight',
        group: { id: 'B2', name: 'B2' },
        related_group: { id: 'H2', name: 'H2' },
      }),
      rel({
        id: 'grant-h2-k2',
        grant_id: 'grant-h2-k2',
        group_id: 'H2',
        related_group_id: 'K2',
        relationship_type: 'child',
        parent_group_id: 'K2',
        child_group_id: 'H2',
        with_right: 'amendmentRight',
        group: { id: 'H2', name: 'H2' },
        related_group: { id: 'K2', name: 'K2' },
      }),
    ];

    const reachableFromB2 = buildIndirectRelationships(
      grants,
      'B2',
      'amendmentRight',
      'B2',
      'right'
    );
    const reachableFromK2 = buildIndirectRelationships(
      grants,
      'K2',
      'amendmentRight',
      'K2',
      'right'
    );
    const mixedFromB2 = buildMixedRelationshipGraph(grants, 'B2', 'amendmentRight', 'B2', 'right');

    expect(reachableFromB2.parents.map(parent => parent.group.id)).toEqual(['H2', 'K2']);
    expect(reachableFromB2.parents.map(parent => parent.childId)).toEqual(['B2', 'H2']);
    expect(reachableFromB2.children).toEqual([]);
    expect(reachableFromK2.parents).toEqual([]);
    expect(reachableFromK2.children).toEqual([]);
    expect(mixedFromB2.parents.map(parent => parent.group.id)).toEqual(['H2', 'K2']);
    expect(mixedFromB2.parents.map(parent => parent.childId)).toEqual(['B2', 'H2']);
    expect(mixedFromB2.children).toEqual([]);
  });

  it('does not convert reverse grants into right-filtered outgoing graph edges', () => {
    const reverseGrants = [
      rel({
        id: 'grant-h2-b2',
        grant_id: 'grant-h2-b2',
        group_id: 'H2',
        related_group_id: 'B2',
        relationship_type: 'parent',
        parent_group_id: 'H2',
        child_group_id: 'B2',
        with_right: 'amendmentRight',
        group: { id: 'H2', name: 'H2' },
        related_group: { id: 'B2', name: 'B2' },
      }),
      rel({
        id: 'grant-k2-h2',
        grant_id: 'grant-k2-h2',
        group_id: 'K2',
        related_group_id: 'H2',
        relationship_type: 'parent',
        parent_group_id: 'K2',
        child_group_id: 'H2',
        with_right: 'amendmentRight',
        group: { id: 'K2', name: 'K2' },
        related_group: { id: 'H2', name: 'H2' },
      }),
    ];

    const directFromB2 = buildDirectRelationships(
      reverseGrants,
      'B2',
      'amendmentRight',
      'B2',
      'right'
    );
    const mixedFromK2 = buildMixedRelationshipGraph(
      reverseGrants,
      'K2',
      'amendmentRight',
      'K2',
      'right'
    );

    expect(directFromB2.children).toEqual([]);
    expect(mixedFromK2.children.map(child => child.group.id)).toEqual(['H2', 'B2']);
    expect(mixedFromK2.children.map(child => child.parentId)).toEqual(['K2', 'H2']);
  });
});
