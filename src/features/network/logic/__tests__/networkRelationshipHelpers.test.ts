import { featureThemeClassName } from '@/features/shared/theme';
import { describe, expect, it } from 'vitest';

import {
  buildDirectRelationships,
  buildIndirectRelationships,
  buildMixedRelationshipGraph,
  buildExistingRightStatusesForDirection,
  getAcceptedSiblingGroups,
  getGroupRelationshipKind,
  getGroupRelationshipRightDisplayStatus,
  getRelativeMembershipDirectionForRelationship,
  isActiveGroupRelationshipStatus,
  isAcceptedSiblingRelationship,
  isRequestGroupRelationshipStatus,
  isVisibleGroupRelationshipStatus,
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
  it('classifies active, requested, pending, and hidden relationship statuses', () => {
    expect(isActiveGroupRelationshipStatus('active')).toBe(true);
    expect(isActiveGroupRelationshipStatus('pending')).toBe(false);
    expect(isRequestGroupRelationshipStatus('requested')).toBe(true);
    expect(isRequestGroupRelationshipStatus('pending')).toBe(true);
    expect(isRequestGroupRelationshipStatus('active')).toBe(false);
    expect(isVisibleGroupRelationshipStatus('active')).toBe(true);
    expect(isVisibleGroupRelationshipStatus('requested')).toBe(true);
    expect(isVisibleGroupRelationshipStatus('pending')).toBe(true);
    expect(isVisibleGroupRelationshipStatus('rejected')).toBe(false);

    expect(getGroupRelationshipKind(rel({ id: 'active-kind' }), 'anchor')).toBe('active');
    expect(
      getGroupRelationshipKind(rel({ id: 'hidden-kind', status: 'rejected' }), 'anchor')
    ).toBeNull();
    expect(
      getGroupRelationshipKind(
        rel({ id: 'unrelated-kind', group_id: 'a', related_group_id: 'b', status: 'pending' }),
        'outside'
      )
    ).toBeNull();
    expect(
      getGroupRelationshipKind(
        rel({ id: 'outgoing-kind', status: 'requested', initiator_group_id: 'anchor' }),
        'anchor'
      )
    ).toBe('outgoing');
    expect(
      getGroupRelationshipKind(
        rel({ id: 'incoming-kind', status: 'pending', initiator_group_id: 'sibling-a' }),
        'anchor'
      )
    ).toBe('incoming');
  });

  it('builds accepted and request right statuses with request precedence', () => {
    expect(getGroupRelationshipRightDisplayStatus(rel({ id: 'accepted' }), 'anchor')).toBe(
      'accepted'
    );
    expect(
      getGroupRelationshipRightDisplayStatus(rel({ id: 'rejected', status: 'rejected' }), 'anchor')
    ).toBeNull();
    expect(
      getGroupRelationshipRightDisplayStatus(
        rel({ id: 'outgoing', status: 'pending', initiator_group_id: 'anchor' }),
        'anchor'
      )
    ).toBe('outgoing');
    expect(
      getGroupRelationshipRightDisplayStatus(
        rel({ id: 'incoming', status: 'requested', initiator_group_id: 'sibling-a' }),
        'anchor'
      )
    ).toBe('incoming');

    const statuses = buildExistingRightStatusesForDirection(
      [
        rel({ id: 'active-right', with_right: 'informationRight' }),
        rel({
          id: 'request-overrides',
          with_right: 'informationRight',
          status: 'requested',
          initiator_group_id: 'sibling-a',
        }),
        rel({ id: 'empty-right', with_right: null }),
        rel({ id: 'hidden-right', with_right: 'amendmentRight', status: 'rejected' }),
        rel({
          id: 'other-pair',
          group_id: 'other-a',
          related_group_id: 'other-b',
          with_right: 'rightToSpeak',
        }),
      ],
      { currentGroupId: 'anchor', otherGroupId: 'sibling-a', relationshipType: 'sibling' }
    );
    expect(Object.fromEntries(statuses)).toEqual({ informationRight: 'incoming' });
  });

  it('maps membership direction only for complete participating endpoints', () => {
    expect(
      getRelativeMembershipDirectionForRelationship({
        relationship: { member_source_group_id: null, member_target_group_id: 'target' },
        currentGroupId: 'target',
      })
    ).toBeNull();
    expect(
      getRelativeMembershipDirectionForRelationship({
        relationship: { member_source_group_id: 'source', member_target_group_id: null },
        currentGroupId: 'source',
      })
    ).toBeNull();
    expect(
      getRelativeMembershipDirectionForRelationship({
        relationship: { member_source_group_id: 'source', member_target_group_id: 'target' },
        currentGroupId: 'outside',
      })
    ).toBeNull();
    expect(
      getRelativeMembershipDirectionForRelationship({
        relationship: { member_source_group_id: 'source', member_target_group_id: 'target' },
        currentGroupId: 'source',
      })
    ).toBe('current_members_to_partner');
    expect(
      getRelativeMembershipDirectionForRelationship({
        relationship: { member_source_group_id: 'source', member_target_group_id: 'target' },
        currentGroupId: 'target',
      })
    ).toBe('partner_members_to_current');
  });

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

  it('ignores sibling rows without a participating hydrated entity', () => {
    const missingEntities = {
      ...rel({ id: 'missing-entities', group_id: 'a', related_group_id: 'b' }),
      group: null,
      related_group: null,
    };
    expect(getAcceptedSiblingGroups([missingEntities], 'outside')).toEqual([]);
  });

  it('builds direct structure and right-scope relationships with defensive filtering', () => {
    const parent = {
      ...rel({
        id: 'parent',
        group_id: 'parent',
        related_group_id: 'anchor',
        relationship_type: 'parent',
        parent_group_id: 'parent',
        child_group_id: 'anchor',
        group: { id: 'parent', name: 'Parent' },
        related_group: { id: 'anchor', name: 'Anchor' },
        membership_mode: 'role_members',
        member_source_group_id: 'anchor',
        member_target_group_id: 'parent',
        required_source_role_id: 'role',
      }),
      required_source_role: { id: 'role', name: 'Role' },
    } as NormalizedGroupRelationship;
    const parentDuplicate = rel({
      ...parent,
      id: 'parent-duplicate',
      with_right: 'amendmentRight',
      required_source_role_id: null,
      required_source_role: null,
    } as never);
    const child = rel({
      id: 'child',
      group_id: 'anchor',
      related_group_id: 'child',
      relationship_type: 'child',
      parent_group_id: 'anchor',
      child_group_id: 'child',
      group: { id: 'anchor', name: 'Anchor' },
      related_group: { id: 'child', name: 'Child' },
    });
    const missingParentEntity = { ...parent, id: 'missing-parent', group: null };
    const missingChildEntity = { ...child, id: 'missing-child', related_group: null };
    const result = buildDirectRelationships(
      [parent, parentDuplicate, child, missingParentEntity, missingChildEntity],
      'anchor'
    );
    expect(result.parents).toHaveLength(1);
    expect(result.parents[0]).toMatchObject({
      rights: ['informationRight', 'amendmentRight'],
      membershipMode: 'role_members',
      requiredSourceRoleId: 'role',
      requiredSourceRoleName: 'Role',
      membershipDirection: 'current_members_to_partner',
    });
    expect(result.children).toHaveLength(1);

    expect(buildDirectRelationships([parent], 'anchor', 'otherRight')).toEqual({
      parents: [],
      children: [],
    });
    expect(
      buildDirectRelationships(
        [
          { ...rel({ id: 'peer-right' }), grant_id: null },
          { ...parent, id: 'no-grant', grant_id: null },
          { ...parent, id: 'wrong-holder', group_id: 'other' },
          {
            ...parent,
            id: 'missing-scope',
            group_id: 'anchor',
            related_group_id: 'parent',
            group: groupStub('anchor', 'Anchor'),
            related_group: null,
          },
          {
            ...parent,
            id: 'right-parent',
            group_id: 'anchor',
            related_group_id: 'parent',
            group: groupStub('anchor', 'Anchor'),
            related_group: groupStub('parent', 'Parent'),
          },
          {
            ...parent,
            id: 'right-parent-duplicate',
            grant_id: 'right-parent-duplicate-grant',
            group_id: 'anchor',
            related_group_id: 'parent',
            group: groupStub('anchor', 'Anchor'),
            related_group: groupStub('parent', 'Parent'),
          },
          child,
        ],
        'anchor',
        undefined,
        'anchor',
        'right'
      )
    ).toMatchObject({
      parents: [expect.objectContaining({ group: expect.objectContaining({ id: 'parent' }) })],
      children: [expect.objectContaining({ group: expect.objectContaining({ id: 'child' }) })],
    });
  });

  it('walks indirect hierarchy chains in both directions and preserves levels', () => {
    const relationships = [
      rel({
        id: 'parent-1',
        group_id: 'parent-1',
        related_group_id: 'anchor',
        relationship_type: 'parent',
        parent_group_id: 'parent-1',
        child_group_id: 'anchor',
        group: { id: 'parent-1', name: 'Parent 1' },
        related_group: { id: 'anchor', name: 'Anchor' },
      }),
      rel({
        id: 'parent-2',
        group_id: 'parent-2',
        related_group_id: 'parent-1',
        relationship_type: 'parent',
        parent_group_id: 'parent-2',
        child_group_id: 'parent-1',
        group: { id: 'parent-2', name: 'Parent 2' },
        related_group: { id: 'parent-1', name: 'Parent 1' },
      }),
      rel({
        id: 'child-1',
        group_id: 'anchor',
        related_group_id: 'child-1',
        relationship_type: 'child',
        parent_group_id: 'anchor',
        child_group_id: 'child-1',
        group: { id: 'anchor', name: 'Anchor' },
        related_group: { id: 'child-1', name: 'Child 1' },
      }),
      rel({
        id: 'child-2',
        group_id: 'child-1',
        related_group_id: 'child-2',
        relationship_type: 'child',
        parent_group_id: 'child-1',
        child_group_id: 'child-2',
        group: { id: 'child-1', name: 'Child 1' },
        related_group: { id: 'child-2', name: 'Child 2' },
      }),
      rel({ id: 'ignored-peer' }),
      rel({
        id: 'ignored-right',
        group_id: 'parent-3',
        related_group_id: 'parent-2',
        relationship_type: 'parent',
        parent_group_id: 'parent-3',
        child_group_id: 'parent-2',
        with_right: 'amendmentRight',
      }),
      {
        ...rel({
          id: 'missing-parent-entity',
          group_id: 'missing-parent',
          related_group_id: 'parent-2',
          relationship_type: 'parent',
          parent_group_id: 'missing-parent',
          child_group_id: 'parent-2',
        }),
        group: null,
      },
      {
        ...rel({
          id: 'missing-child-entity',
          group_id: 'child-2',
          related_group_id: 'missing-child',
          relationship_type: 'child',
          parent_group_id: 'child-2',
          child_group_id: 'missing-child',
        }),
        related_group: null,
      },
    ];

    const result = buildIndirectRelationships(
      relationships,
      'anchor',
      'informationRight',
      'anchor',
      'structure'
    );
    expect(result.parents.map(entry => [entry.group.id, entry.level, entry.childId])).toEqual([
      ['parent-1', 1, 'anchor'],
      ['parent-2', 2, 'parent-1'],
    ]);
    expect(result.children.map(entry => [entry.group.id, entry.level, entry.parentId])).toEqual([
      ['child-1', 1, 'anchor'],
      ['child-2', 2, 'child-1'],
    ]);
  });

  it('walks indirect right-scope chains while rejecting invalid, missing, and cyclic grants', () => {
    const rightRelationship = (
      id: string,
      holderId: string,
      scopeId: string,
      parentId: string,
      childId: string
    ) =>
      rel({
        id,
        group_id: holderId,
        related_group_id: scopeId,
        relationship_type: parentId === scopeId ? 'child' : 'parent',
        parent_group_id: parentId,
        child_group_id: childId,
        group: { id: holderId, name: holderId },
        related_group: { id: scopeId, name: scopeId },
      });
    const relationships = [
      rightRelationship('anchor-parent', 'anchor', 'parent-1', 'parent-1', 'anchor'),
      rightRelationship('parent-grandparent', 'parent-1', 'parent-2', 'parent-2', 'parent-1'),
      rightRelationship('anchor-child', 'anchor', 'child-1', 'anchor', 'child-1'),
      rightRelationship('child-grandchild', 'child-1', 'child-2', 'child-1', 'child-2'),
      { ...rightRelationship('cycle', 'parent-2', 'anchor', 'parent-2', 'anchor') },
      {
        ...rightRelationship('missing-scope', 'parent-2', 'missing', 'missing', 'parent-2'),
        related_group: null,
      },
      {
        ...rightRelationship('no-grant', 'child-2', 'ignored', 'child-2', 'ignored'),
        grant_id: null,
      },
      {
        ...rightRelationship('wrong-right', 'child-2', 'ignored-2', 'child-2', 'ignored-2'),
        with_right: 'amendmentRight',
      },
      {
        ...rightRelationship('missing-right', 'child-2', 'ignored-3', 'child-2', 'ignored-3'),
        with_right: null,
      },
    ];
    const result = buildIndirectRelationships(
      relationships,
      'anchor',
      undefined,
      'anchor',
      'right'
    );
    expect(result.parents.map(entry => [entry.group.id, entry.level])).toEqual([
      ['parent-1', 1],
      ['parent-2', 2],
    ]);
    expect(result.children.map(entry => [entry.group.id, entry.level])).toEqual([
      ['child-1', 1],
      ['child-2', 2],
    ]);
  });

  it('builds mixed right traversal for parent, child, sibling, duplicate, and invalid grants', () => {
    const parent = rel({
      id: 'right-parent',
      group_id: 'anchor',
      related_group_id: 'parent',
      relationship_type: 'child',
      connection_type: 'hierarchy',
      parent_group_id: 'parent',
      child_group_id: 'anchor',
      group: { id: 'anchor', name: 'Anchor' },
      related_group: { id: 'parent', name: 'Parent' },
    });
    const child = rel({
      id: 'right-child',
      group_id: 'anchor',
      related_group_id: 'child',
      relationship_type: 'parent',
      connection_type: 'hierarchy',
      parent_group_id: 'anchor',
      child_group_id: 'child',
      group: { id: 'anchor', name: 'Anchor' },
      related_group: { id: 'child', name: 'Child' },
    });
    const sibling = rel({
      id: 'right-sibling',
      group_id: 'anchor',
      related_group_id: 'sibling',
      relationship_type: 'sibling',
      group: { id: 'anchor', name: 'Anchor' },
      related_group: { id: 'sibling', name: 'Sibling' },
    });
    const graph = buildMixedRelationshipGraph(
      [
        parent,
        { ...parent, id: 'right-parent-duplicate', grant_id: 'duplicate-grant' },
        child,
        { ...child, id: 'right-child-duplicate', grant_id: 'child-duplicate-grant' },
        sibling,
        { ...sibling, id: 'right-sibling-duplicate', grant_id: 'sibling-duplicate-grant' },
        { ...parent, id: 'missing-right', with_right: null },
        { ...parent, id: 'missing-grant', grant_id: null },
        { ...parent, id: 'inactive', status: 'pending' },
        { ...parent, id: 'missing-group', group: null },
        { ...parent, id: 'missing-related', related_group: null },
        { ...parent, id: 'wrong-filter', with_right: 'amendmentRight' },
      ],
      'anchor',
      'informationRight',
      'anchor',
      'right'
    );
    expect(graph.parents.map(entry => entry.group.id)).toEqual(['parent']);
    expect(graph.children.map(entry => entry.group.id)).toEqual(['child']);
    expect(graph.siblingAttachments.map(entry => entry.group.id)).toEqual(['sibling']);
    expect(graph.parents[0].rights).toEqual(['informationRight']);
  });

  it('merges request and role metadata into existing direct entries', () => {
    const base = rel({
      id: 'base',
      group_id: 'parent',
      related_group_id: 'anchor',
      relationship_type: 'parent',
      parent_group_id: 'parent',
      child_group_id: 'anchor',
      group: { id: 'parent', name: 'Parent' },
      related_group: { id: 'anchor', name: 'Anchor' },
      membership_mode: 'role_members',
      required_source_role_id: null,
    });
    const withRole = {
      ...base,
      id: 'with-role',
      grant_id: 'with-role-grant',
      required_source_role_id: 'role',
      required_source_role: { id: 'role', name: 'Role' },
    } as NormalizedGroupRelationship;
    const incoming = {
      ...base,
      id: 'incoming',
      grant_id: 'incoming-grant',
      status: 'requested',
      initiator_group_id: 'parent',
    };
    const outgoing = {
      ...incoming,
      id: 'outgoing',
      grant_id: 'outgoing-grant',
      initiator_group_id: 'anchor',
    };
    const missingRoleAgain = {
      ...base,
      id: 'missing-role-again',
      grant_id: 'missing-role-again-grant',
    };
    const hidden = {
      ...base,
      id: 'hidden',
      grant_id: 'hidden-grant',
      status: 'rejected',
      membership_mode: undefined as never,
    };
    const entry = buildDirectRelationships(
      [base, missingRoleAgain, withRole, incoming, hidden],
      'anchor'
    ).parents[0];
    expect(entry).toMatchObject({
      relationshipKinds: ['active', 'incoming'],
      rightRelationshipKinds: { informationRight: 'active' },
      requiredSourceRoleId: 'role',
      requiredSourceRoleName: 'Role',
    });

    const activeAfterIncoming = buildDirectRelationships([incoming, base], 'anchor').parents[0];
    expect(activeAfterIncoming.rightRelationshipKinds).toEqual({ informationRight: 'active' });

    const requestOnly = buildDirectRelationships([incoming, outgoing], 'anchor').parents[0];
    expect(requestOnly.rightRelationshipKinds).toEqual({ informationRight: 'incoming' });
  });

  it('merges recursive hierarchy paths into groups that are also directly reachable', () => {
    const relationships = [
      rel({
        id: 'parent-a-direct',
        group_id: 'parent-a',
        related_group_id: 'anchor',
        relationship_type: 'parent',
        parent_group_id: 'parent-a',
        child_group_id: 'anchor',
        group: { id: 'parent-a', name: 'Parent A' },
        related_group: { id: 'anchor', name: 'Anchor' },
      }),
      rel({
        id: 'parent-b-direct',
        group_id: 'parent-b',
        related_group_id: 'anchor',
        relationship_type: 'parent',
        parent_group_id: 'parent-b',
        child_group_id: 'anchor',
        group: { id: 'parent-b', name: 'Parent B' },
        related_group: { id: 'anchor', name: 'Anchor' },
      }),
      rel({
        id: 'parent-b-via-a',
        group_id: 'parent-b',
        related_group_id: 'parent-a',
        relationship_type: 'parent',
        parent_group_id: 'parent-b',
        child_group_id: 'parent-a',
        group: { id: 'parent-b', name: 'Parent B' },
        related_group: { id: 'parent-a', name: 'Parent A' },
      }),
      rel({
        id: 'parent-a-direct-amendment',
        group_id: 'parent-a',
        related_group_id: 'anchor',
        relationship_type: 'parent',
        parent_group_id: 'parent-a',
        child_group_id: 'anchor',
        with_right: 'amendmentRight',
        group: { id: 'parent-a', name: 'Parent A' },
        related_group: { id: 'anchor', name: 'Anchor' },
      }),
      rel({
        id: 'parent-b-via-a-amendment',
        group_id: 'parent-b',
        related_group_id: 'parent-a',
        relationship_type: 'parent',
        parent_group_id: 'parent-b',
        child_group_id: 'parent-a',
        with_right: 'amendmentRight',
        group: { id: 'parent-b', name: 'Parent B' },
        related_group: { id: 'parent-a', name: 'Parent A' },
      }),
      rel({
        id: 'child-a-direct',
        group_id: 'anchor',
        related_group_id: 'child-a',
        relationship_type: 'child',
        parent_group_id: 'anchor',
        child_group_id: 'child-a',
        group: { id: 'anchor', name: 'Anchor' },
        related_group: { id: 'child-a', name: 'Child A' },
      }),
      rel({
        id: 'child-b-direct',
        group_id: 'anchor',
        related_group_id: 'child-b',
        relationship_type: 'child',
        parent_group_id: 'anchor',
        child_group_id: 'child-b',
        group: { id: 'anchor', name: 'Anchor' },
        related_group: { id: 'child-b', name: 'Child B' },
      }),
      rel({
        id: 'child-b-via-a',
        group_id: 'child-a',
        related_group_id: 'child-b',
        relationship_type: 'child',
        parent_group_id: 'child-a',
        child_group_id: 'child-b',
        group: { id: 'child-a', name: 'Child A' },
        related_group: { id: 'child-b', name: 'Child B' },
      }),
      rel({
        id: 'child-a-direct-amendment',
        group_id: 'anchor',
        related_group_id: 'child-a',
        relationship_type: 'child',
        parent_group_id: 'anchor',
        child_group_id: 'child-a',
        with_right: 'amendmentRight',
        group: { id: 'anchor', name: 'Anchor' },
        related_group: { id: 'child-a', name: 'Child A' },
      }),
      rel({
        id: 'child-b-via-a-amendment',
        group_id: 'child-a',
        related_group_id: 'child-b',
        relationship_type: 'child',
        parent_group_id: 'child-a',
        child_group_id: 'child-b',
        with_right: 'amendmentRight',
        group: { id: 'child-a', name: 'Child A' },
        related_group: { id: 'child-b', name: 'Child B' },
      }),
    ];

    const result = buildIndirectRelationships(relationships, 'anchor');
    expect(result.parents.map(entry => entry.group.id)).toEqual(['parent-a', 'parent-b']);
    expect(result.children.map(entry => entry.group.id)).toEqual(['child-a', 'child-b']);
  });

  it('normalizes incomplete legacy relationship metadata in indirect results', () => {
    const incompleteParent = {
      ...rel({
        id: 'incomplete-parent',
        group_id: 'parent',
        related_group_id: 'anchor',
        relationship_type: null,
        connection_type: 'hierarchy',
        parent_group_id: 'parent',
        child_group_id: 'anchor',
        group: { id: 'parent', name: 'Parent' },
        related_group: { id: 'anchor', name: 'Anchor' },
      }),
      membership_mode: undefined,
    } as unknown as NormalizedGroupRelationship;
    const incompleteChild = {
      ...rel({
        id: 'incomplete-child',
        group_id: 'anchor',
        related_group_id: 'child',
        relationship_type: null,
        connection_type: 'hierarchy',
        parent_group_id: 'anchor',
        child_group_id: 'child',
        group: { id: 'anchor', name: 'Anchor' },
        related_group: { id: 'child', name: 'Child' },
      }),
      membership_mode: undefined,
    } as unknown as NormalizedGroupRelationship;

    const structure = buildIndirectRelationships([incompleteParent, incompleteChild], 'anchor');
    expect(structure.parents[0]).toMatchObject({
      sourceRelationshipType: null,
      membershipMode: null,
    });
    expect(structure.children[0]).toMatchObject({
      sourceRelationshipType: null,
      membershipMode: null,
    });

    const malformedRight = {
      ...rel({
        id: 'malformed-right',
        group_id: 'anchor',
        related_group_id: 'scope',
        relationship_type: null,
        connection_type: 'hierarchy',
        parent_group_id: 'unrelated-parent',
        child_group_id: 'unrelated-child',
        group: { id: 'anchor', name: 'Anchor' },
        related_group: { id: 'scope', name: 'Scope' },
      }),
      membership_mode: undefined,
    } as unknown as NormalizedGroupRelationship;
    const right = buildIndirectRelationships(
      [malformedRight],
      'anchor',
      undefined,
      'anchor',
      'right'
    );
    expect(right.children[0]).toMatchObject({
      sourceRelationshipType: null,
      membershipMode: null,
    });
  });

  it('ignores invalid legacy structure rows when building the mixed graph', () => {
    const valid = rel({
      id: 'valid-child',
      group_id: 'anchor',
      related_group_id: 'child',
      relationship_type: 'child',
      group: { id: 'anchor', name: 'Anchor' },
      related_group: { id: 'child', name: 'Child' },
    });
    const pendingHierarchy = { ...valid, id: 'pending-hierarchy', status: 'pending' };
    const peerHierarchy = {
      ...valid,
      id: 'peer-hierarchy',
      connection_type: 'peer',
      parent_group_id: null,
      child_group_id: null,
    } as NormalizedGroupRelationship;
    const missingEntity = { ...valid, id: 'missing-entity', related_group: null };

    const graph = buildMixedRelationshipGraph(
      [pendingHierarchy, peerHierarchy, missingEntity, valid],
      'anchor'
    );
    expect(graph.children.map(entry => entry.group.id)).toEqual(['child']);
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
