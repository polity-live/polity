import { describe, expect, it, vi } from 'vitest';

import { buildHierarchyMembershipPlans, reconcileGroupGraph } from '../group-graph-reconcile';

function createTx(initialMemberships: readonly any[], connections: readonly any[]) {
  const run = vi.fn();
  run
    .mockResolvedValueOnce([
      { id: 'B1', group_type: 'base', has_hierarchy_children: false },
      { id: 'B2', group_type: 'base', has_hierarchy_children: false },
      { id: 'H1', group_type: 'hierarchical', has_hierarchy_children: true },
    ])
    .mockResolvedValueOnce(connections)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(initialMemberships)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: 'role-h1-member',
        group_id: 'H1',
        name: 'Member',
        scope: 'group',
        assignee_kind: 'member',
      },
    ])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);

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
});
