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
  return {
    id: overrides.id,
    group_id: overrides.group_id ?? 'anchor',
    related_group_id: overrides.related_group_id ?? 'sibling-a',
    relationship_type: overrides.relationship_type ?? 'sibling',
    with_right: overrides.with_right ?? 'informationRight',
    status: overrides.status ?? 'active',
    initiator_group_id: overrides.initiator_group_id ?? 'anchor',
    created_at: overrides.created_at ?? 0,
    group: overrides.group
      ? groupStub(overrides.group.id, overrides.group.name ?? 'Anchor')
      : groupStub(overrides.group_id ?? 'anchor', 'Anchor'),
    related_group: overrides.related_group
      ? groupStub(overrides.related_group.id, overrides.related_group.name ?? 'Sibling A')
      : groupStub(overrides.related_group_id ?? 'sibling-a', 'Sibling A'),
  };
}

describe('networkRelationshipHelpers', () => {
  it('treats only active or accepted sibling relationships as accepted', () => {
    expect(isAcceptedSiblingRelationship(rel({ id: 'active-sibling', status: 'active' }))).toBe(
      true
    );
    expect(isAcceptedSiblingRelationship(rel({ id: 'accepted-sibling', status: 'accepted' }))).toBe(
      true
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
});
