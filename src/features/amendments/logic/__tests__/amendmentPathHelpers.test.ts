import { describe, expect, it } from 'vitest';
import {
  calculateProcessPathWithClosestEvents,
  calculateWorkflowProcessPathWithClosestEvents,
  getDirectReachableTargetGroupsFromSource,
  getReachableTargetGroupsFromSource,
  getReachableWorkflowsFromSource,
  getProcessPathGroupOptions,
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
  sourceGroupId: string,
  targetGroupId: string,
  relationshipType: 'parent' | 'child' | 'sibling',
  overrides?: Partial<AmendmentNetworkRelationship>
): AmendmentNetworkRelationship {
  return {
    id,
    network_link_id: `link:${id}`,
    network_link_right_id: `right:${id}`,
    group_id: sourceGroupId,
    related_group_id: targetGroupId,
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
    group: createGroup(sourceGroupId, sourceGroupId),
    related_group: createGroup(targetGroupId, targetGroupId),
    ...overrides,
  } as AmendmentNetworkRelationship;
}

function createMembership(
  groupId: string,
  roleIds: readonly string[] = []
): AmendmentNetworkMembership {
  return {
    id: `membership:${groupId}`,
    status: 'active',
    user: { id: 'user-1' },
    group: { id: groupId },
    membership_roles: roleIds.map(roleId => ({
      role: { id: roleId },
    })),
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

function createWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'workflow-1',
    group_id: 'group-owner',
    start_group_id: 'group-start',
    status: 'active',
    steps: [
      {
        id: 'step-1',
        group_id: 'group-step-1',
        label: '1. Lesung',
        order_index: 0,
        step_kind: 'group_vote',
        selection_mode: 'default_target_workflow',
        merge_strategy: null,
        event_rule: null,
        auto_task_on_missing_event: true,
        target_workflow_id: null,
        group: { id: 'group-step-1', name: 'Parliament' },
      },
      {
        id: 'step-2',
        group_id: 'group-committee',
        label: 'Ausschuss Bau',
        order_index: 1,
        step_kind: 'group_vote',
        selection_mode: 'default_target_workflow',
        merge_strategy: null,
        event_rule: null,
        auto_task_on_missing_event: true,
        target_workflow_id: null,
        group: { id: 'group-committee', name: 'Committee' },
      },
      {
        id: 'step-3',
        group_id: 'group-owner',
        label: '2. Lesung',
        order_index: 2,
        step_kind: 'group_vote',
        selection_mode: 'default_target_workflow',
        merge_strategy: null,
        event_rule: null,
        auto_task_on_missing_event: true,
        target_workflow_id: null,
        group: { id: 'group-owner', name: 'Owner' },
      },
    ],
    ...overrides,
  };
}

describe('amendmentPathHelpers', () => {
  it('includes only the groups where the current source group can exercise amendment rights', () => {
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

  it('only exposes direct one-hop neighbors for workflow-style next-step selection', () => {
    const groups = [
      createGroup('group-b1', 'B1'),
      createGroup('group-b2', 'B2'),
      createGroup('group-b3', 'B3'),
    ];
    const relationships = [
      createRelationship('b1-b2', 'group-b1', 'group-b2', 'parent'),
      createRelationship('b2-b3', 'group-b2', 'group-b3', 'parent'),
    ];

    expect(
      getDirectReachableTargetGroupsFromSource({
        sourceGroupId: 'group-b1',
        groups,
        relationships,
        memberships: [createMembership('group-b1')],
        userId: 'user-1',
      }).map(group => group.id)
    ).toEqual(['group-b2']);

    expect(
      getDirectReachableTargetGroupsFromSource({
        sourceGroupId: 'group-b2',
        groups,
        relationships,
        memberships: [createMembership('group-b2')],
        userId: 'user-1',
      }).map(group => group.id)
    ).toEqual(['group-b3']);
  });

  it('uses the previous event end time as the lower bound for the next path step', () => {
    const groups = [createGroup('group-a', 'A'), createGroup('group-b', 'B')];
    const relationships = [createRelationship('a-b', 'group-a', 'group-b', 'parent')];
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
        sourceGroupId: 'group-b',
        targetGroupId: 'group-a',
        groups,
        relationships,
        events: [],
        memberships: [createMembership('group-b')],
        userId: 'user-1',
      })
    ).not.toBeNull();

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
  });

  it('builds hierarchy route alternatives including sibling detours', () => {
    const groups = [
      createGroup('group-b1', 'B1'),
      createGroup('group-h1', 'H1'),
      createGroup('group-faction', 'H1 Fraktion'),
      createGroup('group-board', 'Vorstand H1'),
    ];
    const relationships = [
      createRelationship('b1-h1', 'group-b1', 'group-h1', 'parent'),
      createRelationship('h1-board', 'group-h1', 'group-board', 'parent'),
      createRelationship('h1-faction', 'group-faction', 'group-h1', 'sibling'),
      createRelationship('faction-board', 'group-board', 'group-faction', 'child'),
    ];

    const options = getProcessPathGroupOptions({
      sourceGroupId: 'group-b1',
      targetGroupId: 'group-board',
      groups,
      relationships,
      memberships: [createMembership('group-b1')],
      userId: 'user-1',
    });

    expect(options.map(option => option.groupIds)).toEqual(
      expect.arrayContaining([
        ['group-b1', 'group-h1', 'group-board'],
        ['group-b1', 'group-h1', 'group-faction', 'group-board'],
      ])
    );
  });

  it('keeps sibling and parliament source-group chains reachable in the amendment flow', () => {
    const roleAdminH1 = 'role-admin-h1';
    const roleAdminParliament = 'role-admin-parliament';
    const groups = [
      createGroup('group-b1', 'B1'),
      createGroup('group-h1', 'H1'),
      createGroup('group-faction', 'Fraktion H1'),
      createGroup('group-parliament', 'Parlament Rosbach'),
      createGroup('group-committee', 'Bauaussschuss'),
    ];
    const relationships = [
      createRelationship('link-h1-b1-forward', 'group-h1', 'group-b1', 'child', {
        relationship_direction: 'forward',
        right_direction: 'bidirectional',
        membership_mode: 'all_members',
        membership_direction: 'backward',
        group: createGroup('group-h1', 'H1'),
        related_group: createGroup('group-b1', 'B1'),
      }),
      createRelationship('link-h1-b1-backward', 'group-b1', 'group-h1', 'parent', {
        relationship_direction: 'backward',
        right_direction: 'bidirectional',
        membership_mode: 'all_members',
        membership_direction: 'backward',
        group: createGroup('group-b1', 'B1'),
        related_group: createGroup('group-h1', 'H1'),
      }),
      createRelationship('link-faction-h1-forward', 'group-faction', 'group-h1', 'sibling', {
        relationship_direction: 'forward',
        right_direction: 'forward',
        membership_mode: 'role_members',
        membership_direction: 'backward',
        membership_role_id: roleAdminH1,
        group: createGroup('group-faction', 'Fraktion H1'),
        related_group: createGroup('group-h1', 'H1'),
      }),
      createRelationship(
        'link-parliament-faction-forward',
        'group-parliament',
        'group-faction',
        'sibling',
        {
          relationship_direction: 'forward',
          right_direction: 'bidirectional',
          membership_mode: 'selected_source_groups',
          membership_direction: 'backward',
          membership_source_group_ids: ['group-h1'],
          group: createGroup('group-parliament', 'Parlament Rosbach'),
          related_group: createGroup('group-faction', 'Fraktion H1'),
        }
      ),
      createRelationship(
        'link-parliament-faction-backward',
        'group-faction',
        'group-parliament',
        'sibling',
        {
          relationship_direction: 'backward',
          right_direction: 'bidirectional',
          membership_mode: 'selected_source_groups',
          membership_direction: 'backward',
          membership_source_group_ids: ['group-h1'],
          group: createGroup('group-faction', 'Fraktion H1'),
          related_group: createGroup('group-parliament', 'Parlament Rosbach'),
        }
      ),
      createRelationship(
        'link-committee-parliament-forward',
        'group-committee',
        'group-parliament',
        'sibling',
        {
          relationship_direction: 'forward',
          right_direction: 'bidirectional',
          membership_mode: 'role_members',
          membership_direction: 'backward',
          membership_role_id: roleAdminParliament,
          group: createGroup('group-committee', 'Bauaussschuss'),
          related_group: createGroup('group-parliament', 'Parlament Rosbach'),
        }
      ),
      createRelationship(
        'link-committee-parliament-backward',
        'group-parliament',
        'group-committee',
        'sibling',
        {
          relationship_direction: 'backward',
          right_direction: 'bidirectional',
          membership_mode: 'role_members',
          membership_direction: 'backward',
          membership_role_id: roleAdminParliament,
          group: createGroup('group-parliament', 'Parlament Rosbach'),
          related_group: createGroup('group-committee', 'Bauaussschuss'),
        }
      ),
    ];
    const memberships = [
      createMembership('group-b1', ['role-admin-b1']),
      createMembership('group-h1', [roleAdminH1]),
      createMembership('group-parliament', [roleAdminParliament]),
    ];

    expect(
      getReachableTargetGroupsFromSource({
        sourceGroupId: 'group-b1',
        groups,
        relationships,
        memberships,
        userId: 'user-1',
        includeSourceGroup: true,
      }).map(group => group.id)
    ).toEqual(['group-b1', 'group-h1', 'group-faction', 'group-parliament', 'group-committee']);

    expect(
      calculateProcessPathWithClosestEvents({
        sourceGroupId: 'group-b1',
        targetGroupId: 'group-committee',
        groups,
        relationships,
        events: [],
        memberships,
        userId: 'user-1',
      })?.map(segment => segment.groupId)
    ).toEqual(['group-b1', 'group-h1', 'group-faction', 'group-parliament', 'group-committee']);
  });

  it('builds workflow paths from the separate start group through the explicit workflow steps', () => {
    const groups = [
      createGroup('group-source', 'Source'),
      createGroup('group-start', 'Start'),
      createGroup('group-step-1', 'Parliament'),
      createGroup('group-committee', 'Committee'),
      createGroup('group-owner', 'Owner'),
    ];
    const relationships = [
      createRelationship('source-start', 'group-source', 'group-start', 'parent'),
      createRelationship('start-step-1', 'group-start', 'group-step-1', 'parent'),
      createRelationship('step-1-committee', 'group-step-1', 'group-committee', 'parent'),
      createRelationship('committee-owner', 'group-committee', 'group-owner', 'parent'),
    ];
    const events = [
      createEvent('event-start', 'group-start', now + 1_000, now + 2_000),
      createEvent('event-step-1', 'group-step-1', now + 3_000, now + 4_000),
      createEvent('event-committee', 'group-committee', now + 5_000, now + 6_000),
      createEvent('event-owner', 'group-owner', now + 7_000, now + 8_000),
    ];

    const path = calculateWorkflowProcessPathWithClosestEvents({
      sourceGroupId: 'group-source',
      workflow: createWorkflow(),
      groups,
      relationships,
      events,
      memberships: [createMembership('group-source')],
      userId: 'user-1',
    });

    expect(path?.map(segment => segment.groupId)).toEqual([
      'group-source',
      'group-start',
      'group-step-1',
      'group-committee',
      'group-owner',
    ]);
    expect(path?.[2]?.stepLabel).toBe('1. Lesung');
    expect(path?.[2]?.segmentKey).toBe('workflow:step-1');
  });

  it('only exposes active workflows that are reachable through their start group', () => {
    const groups = [
      createGroup('group-source', 'Source'),
      createGroup('group-start', 'Start'),
      createGroup('group-owner', 'Owner'),
    ];
    const relationships = [
      createRelationship('source-start', 'group-source', 'group-start', 'parent'),
      createRelationship('start-owner', 'group-start', 'group-owner', 'parent'),
    ];

    const workflows = [
      createWorkflow({
        id: 'workflow-active',
        start_group_id: 'group-start',
        group_id: 'group-owner',
        steps: [
          {
            id: 'step-owner',
            group_id: 'group-owner',
            label: 'Final',
            order_index: 0,
            step_kind: 'group_vote',
            selection_mode: 'default_target_workflow',
            merge_strategy: null,
            event_rule: null,
            auto_task_on_missing_event: true,
            target_workflow_id: null,
            group: { id: 'group-owner', name: 'Owner' },
          },
        ],
      }),
      createWorkflow({
        id: 'workflow-pending',
        status: 'pending_approval',
      }),
    ];

    const reachable = getReachableWorkflowsFromSource({
      sourceGroupId: 'group-source',
      workflows,
      groups,
      relationships,
      memberships: [createMembership('group-source')],
      userId: 'user-1',
    });

    expect(reachable.map(workflow => workflow.id)).toEqual(['workflow-active']);
  });
});
