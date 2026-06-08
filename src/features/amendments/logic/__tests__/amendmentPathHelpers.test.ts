import { describe, expect, it } from 'vitest';
import {
  calculateProcessPathWithClosestEvents,
  getReachableTargetGroupsFromSource,
  type AmendmentNetworkEvent,
  type AmendmentNetworkGroup,
  type AmendmentNetworkMembership,
  type AmendmentNetworkRelationship,
} from '@/features/amendments/logic/amendmentPathHelpers';

const now = Date.now();

function createGroup(id: string, name: string): AmendmentNetworkGroup {
  return {
    id,
    name,
    description: null,
  } as AmendmentNetworkGroup;
}

function createRelationship(
  id: string,
  groupId: string,
  relatedGroupId: string,
  relationshipType: 'parent' | 'child' | 'sibling',
  overrides?: Partial<AmendmentNetworkRelationship>
): AmendmentNetworkRelationship {
  return {
    id,
    network_link_id: `link:${id}`,
    network_link_right_id: `right:${id}`,
    group_id: groupId,
    related_group_id: relatedGroupId,
    relationship_type: relationshipType,
    structural_relation: relationshipType === 'sibling' ? 'sibling' : 'parent_child',
    with_right: 'amendmentRight',
    status: 'accepted',
    initiator_group_id: null,
    created_at: now,
    membership_mode: 'all_members',
    membership_direction: null,
    membership_role_id: null,
    membership_source_group_ids: null,
    relationship_direction: relationshipType === 'parent' ? 'backward' : 'forward',
    right_direction: relationshipType === 'parent' ? 'backward' : 'forward',
    group: createGroup(groupId, groupId),
    related_group: createGroup(relatedGroupId, relatedGroupId),
    ...overrides,
  } as AmendmentNetworkRelationship;
}

function createMembership(groupId: string): AmendmentNetworkMembership {
  return {
    id: `membership:${groupId}`,
    status: 'active',
    user: { id: 'user-1' },
    group: { id: groupId },
    membership_roles: [],
  } as unknown as AmendmentNetworkMembership;
}

function createEvent(
  id: string,
  groupId: string,
  startDate: number,
  endDate?: number | null
): AmendmentNetworkEvent {
  return {
    id,
    title: id,
    group_id: groupId,
    group: { id: groupId },
    start_date: startDate,
    end_date: endDate ?? null,
  } as AmendmentNetworkEvent;
}

describe('amendmentPathHelpers', () => {
  it('includes only the groups that are reachable in the amendment-right direction', () => {
    const groups = [createGroup('group-parent', 'Parent'), createGroup('group-child', 'Child')];
    const relationships = [
      createRelationship('parent-child', 'group-parent', 'group-child', 'child', {
        relationship_direction: 'forward',
        right_direction: 'forward',
      }),
    ];

    const reachableFromChild = getReachableTargetGroupsFromSource({
      sourceGroupId: 'group-child',
      groups,
      relationships,
      memberships: [createMembership('group-child')],
      userId: 'user-1',
    });
    const reachableFromParent = getReachableTargetGroupsFromSource({
      sourceGroupId: 'group-parent',
      groups,
      relationships,
      memberships: [createMembership('group-parent')],
      userId: 'user-1',
    });

    expect(reachableFromChild.map(group => group.id)).toEqual(['group-parent']);
    expect(reachableFromParent.map(group => group.id)).toEqual([]);
  });

  it('can still include the source group explicitly when a caller opts in', () => {
    const groups = [createGroup('group-start', 'Start')];

    const reachableGroups = getReachableTargetGroupsFromSource({
      sourceGroupId: 'group-start',
      groups,
      relationships: [],
      memberships: [createMembership('group-start')],
      userId: 'user-1',
      includeSourceGroup: true,
    });

    expect(reachableGroups.map(group => group.id)).toEqual(['group-start']);
  });

  it('uses the previous event end time as the lower bound for the next path step', () => {
    const groups = [createGroup('group-a', 'A'), createGroup('group-b', 'B')];
    const relationships = [createRelationship('a-b', 'group-b', 'group-a', 'child')];
    const events = [
      createEvent('event-a', 'group-a', now + 1_000, now + 5_000),
      createEvent('event-b-too-early', 'group-b', now + 3_000, now + 4_000),
      createEvent('event-b-valid', 'group-b', now + 6_000, now + 7_000),
    ];

    const path = calculateProcessPathWithClosestEvents({
      sourceGroupId: 'group-a',
      targetGroupId: 'group-b',
      groups,
      relationships,
      events,
      memberships: [createMembership('group-a')],
      userId: 'user-1',
    });

    expect(path).not.toBeNull();
    expect(path?.map(segment => segment.eventId)).toEqual(['event-a', 'event-b-valid']);
    expect(path?.[1]?.requiredAfter).toBe(now + 5_000);
  });

  it('rejects reverse traversal when only the opposite amendment-right direction exists', () => {
    const groups = [createGroup('group-a', 'A'), createGroup('group-b', 'B')];
    const relationships = [createRelationship('stored-a-b', 'group-a', 'group-b', 'child')];

    expect(
      calculateProcessPathWithClosestEvents({
        sourceGroupId: 'group-a',
        targetGroupId: 'group-b',
        groups,
        relationships,
        events: [],
        memberships: [createMembership('group-a')],
        userId: 'user-1',
      })
    ).toBeNull();

    expect(
      calculateProcessPathWithClosestEvents({
        sourceGroupId: 'group-b',
        targetGroupId: 'group-a',
        groups,
        relationships,
        events: [],
        memberships: [createMembership('group-b')],
        userId: 'user-1',
      })
    ).not.toBeNull();
  });
});
