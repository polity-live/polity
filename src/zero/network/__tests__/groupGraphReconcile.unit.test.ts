import { describe, expect, it, vi } from 'vitest';

import { buildHierarchyMembershipPlans, reconcileGroupGraph } from '../group-graph-reconcile';

interface ReconcileScenario {
  groups?: readonly any[];
  grants?: readonly any[];
  membershipRules?: readonly any[];
  events?: readonly any[];
  delegateAllocations?: readonly any[];
  existingScopes?: readonly any[];
  existingAssignments?: readonly any[];
  roles?: readonly any[];
  membershipRoles?: readonly any[];
  existingHierarchyPaths?: readonly any[];
  existingRights?: readonly any[];
  existingOrigins?: readonly any[];
  existingExclusivityLocks?: readonly any[];
  existingSiblingLocks?: readonly any[];
}

function createTx(
  initialMemberships: readonly any[],
  connections: readonly any[],
  scenario: ReconcileScenario = {}
) {
  const run = vi.fn();
  for (const result of [
    scenario.groups ?? [
      { id: 'B1', group_type: 'base', has_hierarchy_children: false },
      { id: 'B2', group_type: 'base', has_hierarchy_children: false },
      { id: 'H1', group_type: 'hierarchical', has_hierarchy_children: true },
    ],
    connections,
    scenario.grants ?? [],
    scenario.membershipRules ?? [],
    initialMemberships,
    scenario.events ?? [],
    scenario.delegateAllocations ?? [],
    scenario.existingScopes ?? [],
    scenario.existingAssignments ?? [],
    scenario.roles ?? [
      {
        id: 'role-h1-member',
        group_id: 'H1',
        name: 'Member',
        scope: 'group',
        assignee_kind: 'member',
      },
    ],
    scenario.membershipRoles ?? [],
    scenario.existingHierarchyPaths ?? [],
    scenario.existingRights ?? [],
    scenario.existingOrigins ?? [],
    scenario.existingExclusivityLocks ?? [],
    scenario.existingSiblingLocks ?? [],
  ]) {
    run.mockResolvedValueOnce(result);
  }

  return {
    run,
    mutate: {
      group: { update: vi.fn() },
      group_connection: { update: vi.fn() },
      group_hierarchy_path: { insert: vi.fn(), delete: vi.fn() },
      group_effective_right: { insert: vi.fn(), delete: vi.fn() },
      group_membership: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      group_membership_origin: { insert: vi.fn(), delete: vi.fn() },
      group_membership_role: { insert: vi.fn() },
      group_membership_exclusivity_lock: { insert: vi.fn(), delete: vi.fn() },
      group_sibling_source_lock: { insert: vi.fn(), delete: vi.fn() },
      event_assembly_scope: { insert: vi.fn() },
      delegate_election_assignment: { insert: vi.fn(), update: vi.fn() },
    },
  };
}

function hierarchyConnection(id: string, childGroupId: string, parentGroupId: string) {
  return {
    id,
    group_a_id: parentGroupId,
    group_b_id: childGroupId,
    connection_type: 'hierarchy',
    parent_group_id: parentGroupId,
    child_group_id: childGroupId,
    status: 'active',
    created_at: 1,
    updated_at: 1,
  };
}

function directMembership(id: string, groupId: string, userId: string) {
  return {
    id,
    group_id: groupId,
    user_id: userId,
    status: 'active',
    visibility: 'public',
    source: 'direct',
    source_group_id: null,
    created_at: 1,
  };
}

describe('group graph hierarchy membership projection', () => {
  it('projects all active child base memberships into a hierarchical parent', async () => {
    const tx = createTx(
      [
        directMembership('m-b1-a', 'B1', 'user-a'),
        directMembership('m-b2-b', 'B2', 'user-b'),
        directMembership('m-b2-c', 'B2', 'user-c'),
      ],
      [hierarchyConnection('c-b1-h1', 'B1', 'H1'), hierarchyConnection('c-b2-h1', 'B2', 'H1')]
    );

    const result = await reconcileGroupGraph(tx as never, {
      groupIds: ['H1'],
      reason: 'test',
    });

    expect(tx.mutate.group_membership.insert).toHaveBeenCalledTimes(3);
    expect(tx.mutate.group_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: 'H1',
        user_id: 'user-a',
        source: 'derived',
        source_group_id: 'B1',
        origin_kind: 'hierarchy',
        part_group_id: 'B1',
        base_group_id: 'B1',
        is_auto_managed: true,
      })
    );
    expect(tx.mutate.group_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: 'H1',
        user_id: 'user-b',
        source: 'derived',
        source_group_id: 'B2',
        part_group_id: 'B2',
        base_group_id: 'B2',
      })
    );
    expect(tx.mutate.group_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: 'H1',
        user_id: 'user-c',
        source: 'derived',
        source_group_id: 'B2',
        part_group_id: 'B2',
        base_group_id: 'B2',
      })
    );
    expect(result.affectedGroupIds).toEqual(new Set(['H1']));
    expect(result.affectedUserIds).toEqual(new Set(['user-a', 'user-b', 'user-c']));
  });

  it('deletes stale derived memberships when a child path is removed', async () => {
    const staleDerived = {
      id: 'm-h1-b',
      group_id: 'H1',
      user_id: 'user-b',
      status: 'active',
      visibility: 'public',
      source: 'derived',
      source_group_id: 'B2',
      created_at: 1,
    };
    const tx = createTx(
      [
        directMembership('m-b1-a', 'B1', 'user-a'),
        directMembership('m-b2-b', 'B2', 'user-b'),
        staleDerived,
      ],
      [hierarchyConnection('c-b1-h1', 'B1', 'H1')]
    );

    await reconcileGroupGraph(tx as never, { groupIds: ['H1'], reason: 'test' });

    expect(tx.mutate.group_membership.delete).toHaveBeenCalledWith({ id: 'm-h1-b' });
    expect(tx.mutate.group_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: 'H1',
        user_id: 'user-a',
        source_group_id: 'B1',
      })
    );
    expect(tx.mutate.group_membership.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: 'H1',
        user_id: 'user-b',
      })
    );
  });

  it('keeps one parent membership but records both origins for duplicate child users', () => {
    const plans = buildHierarchyMembershipPlans({
      memberships: [
        directMembership('m-b1-a', 'B1', 'user-a'),
        directMembership('m-b2-a', 'B2', 'user-a'),
      ],
      hierarchyPaths: [
        {
          ancestor_group_id: 'H1',
          descendant_group_id: 'B1',
          direct_child_group_id: 'B1',
          base_group_id: 'B1',
          depth: 1,
          path_group_ids: ['B1', 'H1'],
          connection_id: 'c-b1-h1',
        },
        {
          ancestor_group_id: 'H1',
          descendant_group_id: 'B2',
          direct_child_group_id: 'B2',
          base_group_id: 'B2',
          depth: 1,
          path_group_ids: ['B2', 'H1'],
          connection_id: 'c-b2-h1',
        },
      ],
    });

    expect([...plans.keys()]).toEqual(['H1:user-a']);
    expect(plans.get('H1:user-a')?.origins.map(origin => origin.baseGroupId)).toEqual(['B1', 'B2']);
  });

  it('normalizes plan fallbacks, ignores ineligible memberships, and sorts origins by depth', () => {
    const plans = buildHierarchyMembershipPlans({
      memberships: [
        directMembership('direct', 'B1', 'user'),
        { ...directMembership('inactive', 'B1', 'inactive-user'), status: 'suspended' },
        { ...directMembership('derived', 'B1', 'derived-user'), source: 'derived' },
        directMembership('unrelated', 'outside', 'outside-user'),
      ],
      hierarchyPaths: [
        {
          ancestor_group_id: 'H1',
          base_group_id: 'B1',
          direct_child_group_id: null,
          connection_id: null,
          path_group_ids: null,
          depth: null,
        },
        {
          ancestor_group_id: 'H1',
          base_group_id: 'B1',
          direct_child_group_id: 'M1',
          connection_id: 'connection-deep',
          path_group_ids: ['B1', 'M1', 'H1'],
          depth: 2,
        },
      ],
    });

    expect([...plans.keys()]).toEqual(['H1:user']);
    expect(plans.get('H1:user')?.origins).toEqual([
      expect.objectContaining({
        connectionId: null,
        partGroupId: 'B1',
        pathGroupIds: ['B1', 'H1'],
        depth: 0,
      }),
      expect.objectContaining({
        connectionId: 'connection-deep',
        partGroupId: 'M1',
        depth: 2,
      }),
    ]);
  });

  it('reconciles legacy graph metadata, projections, locks, rights, events, and delegates', async () => {
    const baseToMid = hierarchyConnection('base-mid', 'BASE', 'MID');
    const midToTop = hierarchyConnection('mid-top', 'MID', 'TOP');
    const duplicateBaseToMid = { ...baseToMid, id: 'base-mid-duplicate' };
    const cycle = hierarchyConnection('top-base-cycle', 'TOP', 'BASE');
    const peer = (
      id: string,
      sourceId: string,
      targetId: string,
      createdAt?: number,
      connectionKind?: string
    ) => ({
      id,
      group_a_id: sourceId,
      group_b_id: targetId,
      connection_type: 'peer',
      parent_group_id: null,
      child_group_id: null,
      from_group_id: sourceId,
      to_group_id: targetId,
      connection_kind: connectionKind,
      status: 'active',
      created_at: createdAt,
      updated_at: null,
    });

    const connections = [
      baseToMid,
      midToTop,
      hierarchyConnection('base-top-direct', 'BASE', 'TOP'),
      duplicateBaseToMid,
      cycle,
      {
        id: 'legacy-hierarchy',
        group_a_id: 'LEGACY-PARENT',
        group_b_id: 'LEGACY-CHILD',
        connection_type: 'hierarchy',
        parent_group_id: null,
        child_group_id: null,
        from_group_id: 'LEGACY-CHILD',
        to_group_id: 'LEGACY-PARENT',
        status: 'active',
      },
      {
        id: 'legacy-hierarchy-endpoint-fallback',
        group_a_id: 'LEGACY-PARENT',
        group_b_id: 'LEGACY-CHILD',
        connection_type: 'hierarchy',
        parent_group_id: null,
        child_group_id: null,
        status: 'active',
      },
      {
        id: 'malformed-hierarchy',
        group_a_id: 'TOP',
        group_b_id: '',
        connection_type: 'hierarchy',
        parent_group_id: 'TOP',
        child_group_id: '',
        from_group_id: '',
        status: 'active',
      },
      {
        id: 'malformed-parent-hierarchy',
        group_a_id: '',
        group_b_id: 'LEGACY-CHILD',
        connection_type: 'hierarchy',
        parent_group_id: '',
        child_group_id: 'LEGACY-CHILD',
        to_group_id: '',
        status: 'active',
      },
      {
        id: 'self-hierarchy',
        group_a_id: 'TOP',
        group_b_id: 'TOP',
        connection_type: 'hierarchy',
        parent_group_id: 'TOP',
        child_group_id: 'TOP',
        status: 'active',
      },
      { ...hierarchyConnection('inactive-hierarchy', 'BASE', 'TOP'), status: 'pending' },
      peer('role-peer', 'ROLE-SOURCE', 'ROLE-TARGET', 10),
      peer('selected-peer', 'SELECTED-SOURCE', 'SELECTED-TARGET', 9),
      peer('all-peer', 'ALL-SOURCE', 'ALL-TARGET', 8),
      peer('none-peer', 'NONE-SOURCE', 'NONE-TARGET', 7),
      {
        id: 'unruled-peer',
        group_a_id: 'UNRULED-SOURCE',
        group_b_id: 'UNRULED-TARGET',
        connection_type: 'peer',
        status: 'active',
      },
      {
        id: 'unruled-peer-duplicate',
        group_a_id: 'UNRULED-SOURCE',
        group_b_id: 'UNRULED-TARGET',
        connection_type: 'peer',
        status: 'active',
      },
      peer('explicit-kind', 'EXPLICIT-SOURCE', 'EXPLICIT-TARGET', 6, 'committee'),
      peer('committee-kind', 'COMMITTEE', 'BASE-GROUP', 5),
      peer('institution-kind', 'INSTITUTION', 'BASE-GROUP', 4),
      peer('parliament-kind', 'PARLIAMENT', 'BASE-GROUP', 3),
      peer('sibling-kind', 'BASE-GROUP', 'OTHER-BASE', 2),
    ];

    const membershipRules = [
      {
        id: 'role-rule',
        connection_id: 'role-peer',
        member_source_group_id: 'ROLE-SOURCE',
        member_target_group_id: 'ROLE-TARGET',
        membership_mode: 'role_members',
        required_source_role_id: 'elected-role',
      },
      {
        id: 'selected-rule',
        connection_id: 'selected-peer',
        member_source_group_id: 'SELECTED-SOURCE',
        member_target_group_id: 'SELECTED-TARGET',
        membership_mode: 'selected_source_groups',
      },
      {
        id: 'all-rule',
        connection_id: 'all-peer',
        member_source_group_id: 'ALL-SOURCE',
        member_target_group_id: 'ALL-TARGET',
        membership_mode: 'all_members',
      },
      {
        id: 'none-rule',
        connection_id: 'none-peer',
        member_source_group_id: 'NONE-SOURCE',
        member_target_group_id: 'NONE-TARGET',
        membership_mode: 'none',
      },
    ];

    const exactMidMembership = {
      id: 'derived-mid-user-1',
      group_id: 'MID',
      user_id: 'user-1',
      status: 'active',
      visibility: 'public',
      source: 'derived',
      source_group_id: 'BASE',
      origin_kind: 'hierarchy',
      connection_id: 'base-mid',
      membership_rule_id: null,
      part_group_id: 'BASE',
      base_group_id: 'BASE',
      is_auto_managed: true,
      created_at: 1,
    };
    const memberships = [
      directMembership('direct-base-user-1', 'BASE', 'user-1'),
      directMembership('direct-base-user-2', 'BASE', 'user-2'),
      { ...directMembership('inactive-direct', 'BASE', 'inactive-user'), status: 'suspended' },
      exactMidMembership,
      {
        ...exactMidMembership,
        id: 'derived-top-user-1',
        group_id: 'TOP',
        visibility: 'private',
        connection_id: 'stale-connection',
      },
      {
        ...exactMidMembership,
        id: 'stale-derived',
        group_id: 'STALE',
        user_id: 'stale-user',
        source_group_id: 'REMOVED',
      },
      {
        ...directMembership('sibling-all', 'ALL-TARGET', 'sibling-user'),
        source: 'sibling_all_members',
        source_group_id: 'ALL-SOURCE',
      },
      {
        ...directMembership('sibling-elected', 'ROLE-TARGET', 'elected-user'),
        source: 'sibling_elected',
        source_group_id: 'ROLE-SOURCE',
      },
      {
        ...directMembership('sibling-parliament', 'SELECTED-TARGET', 'parliament-user'),
        source: 'sibling_parliament',
        source_group_id: 'SELECTED-SOURCE',
      },
      {
        ...directMembership('sibling-duplicate', 'ALL-TARGET', 'sibling-user'),
        source: 'sibling_all_members',
        source_group_id: 'OTHER-SOURCE',
      },
      {
        ...directMembership('manual', 'MANUAL-TARGET', 'manual-user'),
        source: 'imported',
        source_group_id: 'MANUAL-SOURCE',
        connection_id: 'manual-connection',
        membership_rule_id: 'manual-rule',
      },
      {
        ...directMembership('implicit-direct', 'BASE', 'implicit-user'),
        source: undefined,
      },
      {
        ...directMembership('legacy-sibling', 'LEGACY-SIBLING', 'legacy-sibling-user'),
        source: 'sibling_all_members',
        source_group_id: null,
        part_group_id: 'LEGACY-PART',
        base_group_id: 'LEGACY-BASE',
        connection_id: 'legacy-connection',
      },
      {
        ...directMembership('empty-sibling', 'EMPTY-SIBLING', 'empty-sibling-user'),
        source: 'sibling_elected',
        source_group_id: null,
        part_group_id: null,
        base_group_id: null,
      },
      {
        ...directMembership('mapped-manual', 'ALL-TARGET', 'mapped-manual-user'),
        source: 'imported',
        source_group_id: 'ALL-SOURCE',
        membership_rule_id: null,
        part_group_id: 'EXPLICIT-PART',
        base_group_id: 'EXPLICIT-BASE',
      },
      {
        ...directMembership('empty-manual', 'EMPTY-MANUAL', 'empty-manual-user'),
        source: 'imported',
        source_group_id: null,
        membership_rule_id: null,
        part_group_id: null,
        base_group_id: null,
      },
    ];

    const groups: Record<string, unknown>[] = [
      'BASE',
      'MID',
      'TOP',
      'LEGACY-PARENT',
      'LEGACY-CHILD',
      'ROLE-SOURCE',
      'ROLE-TARGET',
      'SELECTED-SOURCE',
      'SELECTED-TARGET',
      'ALL-SOURCE',
      'ALL-TARGET',
      'NONE-SOURCE',
      'NONE-TARGET',
      'UNRULED-SOURCE',
      'UNRULED-TARGET',
      'EXPLICIT-SOURCE',
      'EXPLICIT-TARGET',
      'BASE-GROUP',
      'OTHER-BASE',
    ].map(id => ({ id }));
    groups.push(
      { id: 'COMMITTEE', group_type: 'committee' },
      { id: 'INSTITUTION', group_type: 'institution' },
      { id: 'PARLIAMENT', group_type: 'parliament' },
      {
        id: 'ISOLATED',
        group_type: 'base',
        has_hierarchy_children: false,
        has_sibling_connections: false,
        connected_group_id: null,
        primary_sibling_membership_mode: null,
        sibling_membership_mode: null,
        sibling_role_id: null,
      }
    );

    const tx = createTx(memberships, connections, {
      groups,
      grants: [
        {
          id: 'grant-active',
          holder_group_id: 'BASE',
          scope_group_id: 'TOP',
          right_key: 'informationRight',
          connection_id: 'mid-top',
          status: 'active',
        },
        {
          id: 'grant-active',
          holder_group_id: 'BASE',
          scope_group_id: 'TOP',
          right_key: 'informationRight',
          connection_id: 'mid-top',
          status: 'active',
        },
        {
          id: 'grant-inactive',
          holder_group_id: 'BASE',
          scope_group_id: 'TOP',
          right_key: 'amendmentRight',
          connection_id: 'mid-top',
          status: 'pending',
        },
        {
          id: 'grant-unknown',
          holder_group_id: 'BASE',
          scope_group_id: 'TOP',
          right_key: 'unknownRight',
          connection_id: 'mid-top',
          status: 'active',
        },
      ],
      membershipRules,
      events: [
        { id: 'general-event', group_id: 'TOP', event_type: 'meeting' },
        { id: 'delegate-event', group_id: 'ISOLATED', event_type: 'delegate_assembly' },
        { id: 'scoped-event', group_id: 'TOP', event_type: 'meeting' },
        { id: 'missing-group-event', group_id: null, event_type: 'meeting' },
      ],
      delegateAllocations: [
        {
          id: 'allocation-existing',
          event_id: 'delegate-event',
          group_id: 'ROLE-SOURCE',
          allocated_seats: 3,
          confirmed_delegate_count: 2,
        },
        {
          id: 'allocation-new',
          event_id: 'delegate-event',
          group_id: 'ALL-SOURCE',
          allocated_seats: null,
          confirmed_delegate_count: null,
        },
        { id: 'allocation-missing-event', event_id: 'missing', group_id: 'BASE' },
        { id: 'allocation-general', event_id: 'general-event', group_id: 'BASE' },
        { id: 'allocation-missing-group', event_id: 'delegate-event', group_id: null },
      ],
      existingScopes: [
        { id: 'inactive-scope', event_id: 'general-event', status: 'pending' },
        { id: 'active-scope', event_id: 'scoped-event', status: 'active' },
        { id: 'active-scope-2', event_id: 'scoped-event', status: 'active' },
      ],
      existingAssignments: [
        {
          id: 'assignment-existing',
          target_event_id: 'delegate-event',
          source_group_id: 'ROLE-SOURCE',
          linked_event_id: 'linked-event',
          status: 'confirmed',
        },
      ],
      roles: [
        { id: 'wrong-name', group_id: 'TOP', name: 'Admin', scope: 'group' },
        { id: 'wrong-scope', group_id: 'TOP', name: 'Member', scope: 'event' },
        {
          id: 'guest-member',
          group_id: 'TOP',
          name: 'Member',
          scope: 'group',
          assignee_kind: 'guest',
        },
        {
          id: 'top-member',
          group_id: 'TOP',
          name: 'Member',
          scope: 'group',
          assignee_kind: 'member',
        },
      ],
      membershipRoles: [
        {
          id: 'existing-role-link',
          group_membership_id: 'derived-top-user-1',
          role_id: 'top-member',
        },
      ],
      existingHierarchyPaths: [{ id: 'old-path' }],
      existingRights: [{ id: 'old-right' }],
      existingOrigins: [{ id: 'old-origin' }],
      existingExclusivityLocks: [{ id: 'old-exclusivity' }],
      existingSiblingLocks: [{ id: 'old-sibling-lock' }],
    });

    const result = await reconcileGroupGraph(tx as never, {
      assignedById: 'actor',
      groupIds: [null, 'TOP', 'TOP'],
      userIds: [undefined, 'user-1'],
      eventIds: ['general-event'],
      reason: 'full-scenario',
    });

    expect(tx.mutate.group_connection.update).toHaveBeenCalled();
    expect(tx.mutate.group.update).toHaveBeenCalled();
    expect(tx.mutate.group_hierarchy_path.delete).toHaveBeenCalledWith({ id: 'old-path' });
    expect(tx.mutate.group_hierarchy_path.insert).toHaveBeenCalled();
    expect(tx.mutate.group_effective_right.delete).toHaveBeenCalledWith({ id: 'old-right' });
    expect(tx.mutate.group_effective_right.insert).toHaveBeenCalledTimes(1);
    expect(tx.mutate.group_membership.delete).toHaveBeenCalledWith({ id: 'stale-derived' });
    expect(tx.mutate.group_membership.update).toHaveBeenCalled();
    expect(tx.mutate.group_membership.insert).toHaveBeenCalled();
    expect(tx.mutate.group_membership_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 'top-member', assigned_by_id: 'actor' })
    );
    expect(tx.mutate.group_membership_origin.delete).toHaveBeenCalledWith({ id: 'old-origin' });
    expect(tx.mutate.group_membership_origin.insert).toHaveBeenCalled();
    expect(tx.mutate.group_membership_exclusivity_lock.delete).toHaveBeenCalledWith({
      id: 'old-exclusivity',
    });
    expect(tx.mutate.group_sibling_source_lock.delete).toHaveBeenCalledWith({
      id: 'old-sibling-lock',
    });
    expect(tx.mutate.group_sibling_source_lock.insert).toHaveBeenCalled();
    expect(tx.mutate.event_assembly_scope.insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: 'delegate-event', scope_kind: 'delegate_source' })
    );
    expect(tx.mutate.event_assembly_scope.insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: 'general-event', scope_kind: 'general_member_source' })
    );
    expect(tx.mutate.delegate_election_assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'assignment-existing', linked_event_id: 'linked-event' })
    );
    expect(tx.mutate.delegate_election_assignment.insert).toHaveBeenCalledWith(
      expect.objectContaining({ source_group_id: 'ALL-SOURCE', required_seats: 0 })
    );
    expect(result.affectedGroupIds).toContain('TOP');
    expect(result.affectedUserIds).toContain('user-2');
  });
});
