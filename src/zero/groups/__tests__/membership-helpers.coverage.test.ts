import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  counters: { group: vi.fn(), user: vi.fn(), conversation: vi.fn() },
  derivedRelationships: [] as Record<string, any>[],
}));

vi.mock('../../server-helpers', () => ({
  isActiveGroupStatus: (status: string | null | undefined) =>
    ['active', 'admin', 'member'].includes(status ?? ''),
  recomputeGroupCounters: mocks.counters.group,
  recomputeUserCounters: mocks.counters.user,
  syncUserWithGroupConversation: mocks.counters.conversation,
}));
vi.mock('../../network/derived', () => ({
  getDefaultDerivedGroupNetworkMeta: () => ({
    group_type: 'base',
    has_hierarchy_children: false,
    has_sibling_connections: false,
    connected_group_id: null,
    primary_sibling_membership_mode: null,
    sibling_membership_mode: null,
    sibling_role_id: null,
  }),
  deriveGroupRelationships: () => mocks.derivedRelationships,
}));
vi.mock('../../network/membershipRules', () => ({
  normalizeMembershipRule: (rule: Record<string, any> | null | undefined) =>
    rule?.member_source_group_id && rule?.member_target_group_id && rule?.membership_mode
      ? rule
      : null,
}));

import {
  assertValidSiblingConfiguration,
  buildGroupsById,
  clearAutomaticSiblingMemberships,
  filterHierarchyRelationships,
  groupMembershipHelperInternals as helpers,
  isAutomaticGroupMembershipSource,
  isManualGroupMembershipSource,
  isSiblingAutomaticMembershipSource,
  isSiblingGroupType,
  loadActiveHierarchyRelationships,
  loadGroupWithDerivedNetworkMeta,
  loadGroupsWithDerivedNetworkMeta,
  recomputeSiblingGroupMemberships,
  recomputeSiblingMembershipsForGroup,
  syncSiblingSourceGroups,
  userHasActiveMembershipInGroup,
} from '../membership-helpers';

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      group_membership: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      group_membership_role: { insert: vi.fn() },
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.derivedRelationships = [];
  let uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`
  );
});

describe('membership helper primitives', () => {
  it('classifies sources, group types, relationship endpoints, and network modes', () => {
    expect(isSiblingAutomaticMembershipSource(null)).toBe(false);
    expect(isSiblingAutomaticMembershipSource('sibling_all_members')).toBe(true);
    expect(isAutomaticGroupMembershipSource('derived')).toBe(true);
    expect(isAutomaticGroupMembershipSource('sibling_elected')).toBe(true);
    expect(isAutomaticGroupMembershipSource('direct')).toBe(false);
    expect(isManualGroupMembershipSource('direct')).toBe(true);
    expect(isManualGroupMembershipSource(null)).toBe(false);
    expect(isSiblingGroupType('sibling')).toBe(true);
    expect(isSiblingGroupType('base')).toBe(false);

    const groups = new Map([
      ['base', { group_type: 'base' }],
      ['sibling', { group_type: 'sibling' }],
    ]);
    expect(
      filterHierarchyRelationships(
        [
          { id: 'base', group_id: 'base', related_group_id: 'missing' },
          { id: 'missing-source', group_id: 'missing', related_group_id: 'base' },
          { id: 'source-sibling', group_id: 'sibling', related_group_id: 'base' },
          { id: 'target-sibling', group_id: 'base', related_group_id: 'sibling' },
        ],
        groups
      ).map(item => item.id)
    ).toEqual(['base', 'missing-source']);

    expect(
      helpers.getDirectionalMembershipContexts({ group_a_id: 'a', group_b_id: 'b' }, null)
    ).toEqual([]);
    expect(
      helpers.getDirectionalMembershipContexts(
        { group_a_id: 'a', group_b_id: 'b' },
        {
          member_source_group_id: 'a',
          member_target_group_id: 'b',
          membership_mode: 'all_members',
        }
      )
    ).toHaveLength(1);
    expect(helpers.isActiveGroupConnectionStatus('active')).toBe(true);
    expect(helpers.isActiveGroupConnectionStatus('accepted')).toBe(false);
    expect(
      ['all_members', 'role_members', 'selected_source_groups', 'none'].map(
        helpers.getNetworkMembershipSourceForMode
      )
    ).toEqual(['sibling_all_members', 'sibling_elected', 'sibling_parliament', null]);
  });

  it('loads filtered/all groups and normalizes persisted or default metadata', async () => {
    const filtered = createTx();
    filtered.run.mockResolvedValueOnce([
      { id: 'defaulted' },
      {
        id: 'persisted',
        group_type: 'sibling',
        has_hierarchy_children: true,
        has_sibling_connections: true,
        connected_group_id: 'partner',
        primary_sibling_membership_mode: 'all_members',
        sibling_membership_mode: 'legacy',
        sibling_role_id: 'role',
      },
    ]);
    const groups = await loadGroupsWithDerivedNetworkMeta(filtered, ['', 'defaulted', 'defaulted']);
    expect(groups[0]).toMatchObject({ group_type: 'base', connected_group_id: null });
    expect(groups[1]).toMatchObject({ group_type: 'sibling', connected_group_id: 'partner' });

    const all = createTx();
    all.run.mockResolvedValueOnce([]);
    await expect(loadGroupsWithDerivedNetworkMeta(all)).resolves.toEqual([]);
    const byIdTx = createTx();
    byIdTx.run.mockResolvedValueOnce([{ id: 'group' }]);
    await expect(buildGroupsById(byIdTx)).resolves.toEqual(
      new Map([['group', expect.objectContaining({ id: 'group' })]])
    );
    const missing = createTx();
    missing.run.mockResolvedValueOnce([]);
    await expect(loadGroupsWithDerivedNetworkMeta(missing, [])).resolves.toEqual([]);

    const one = createTx();
    one.run.mockResolvedValueOnce([{ id: 'one' }]);
    await expect(loadGroupWithDerivedNetworkMeta(one, 'one')).resolves.toMatchObject({ id: 'one' });
    const absent = createTx();
    absent.run.mockResolvedValueOnce([]);
    await expect(loadGroupWithDerivedNetworkMeta(absent, 'absent')).resolves.toBeNull();
  });

  it('loads active non-sibling hierarchy relationships', async () => {
    mocks.derivedRelationships = [
      { id: 'hierarchy', relationship_type: 'parent', group_id: 'base', related_group_id: 'other' },
      { id: 'peer', relationship_type: 'sibling', group_id: 'base', related_group_id: 'other' },
      {
        id: 'sibling-endpoint',
        relationship_type: 'parent',
        group_id: 'base',
        related_group_id: 'sibling',
      },
    ];
    const tx = createTx();
    tx.run.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(
      loadActiveHierarchyRelationships(
        tx,
        new Map([
          ['base', { group_type: 'base' }],
          ['other', { group_type: 'hierarchical' }],
          ['sibling', { group_type: 'sibling' }],
        ])
      )
    ).resolves.toEqual([expect.objectContaining({ id: 'hierarchy' })]);
  });

  it('adds/reuses member role links and resolves member-role defaults', async () => {
    const existing = createTx();
    existing.run.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      helpers.addGroupMembershipRoleLink(existing, {
        group_membership_id: 'membership',
        role_id: 'role',
      })
    ).resolves.toBe('existing');
    const inserted = createTx();
    inserted.run.mockResolvedValueOnce(null);
    await helpers.addGroupMembershipRoleLink(inserted, {
      group_membership_id: 'membership',
      role_id: 'role',
      assigned_by_id: 'actor',
    });
    expect(inserted.mutate.group_membership_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_by_id: 'actor' })
    );
    const noActor = createTx();
    noActor.run.mockResolvedValueOnce(null);
    await helpers.addGroupMembershipRoleLink(noActor, {
      group_membership_id: 'membership',
      role_id: 'role',
    });
    expect(noActor.mutate.group_membership_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_by_id: null })
    );

    const absentRole = createTx();
    absentRole.run.mockResolvedValueOnce([]);
    await helpers.ensureMemberRoleLink(absentRole, 'membership', 'group');
    const role = createTx();
    role.run
      .mockResolvedValueOnce([
        { id: 'guest-member', name: 'Member', assignee_kind: 'guest' },
        { id: 'member', name: 'Member', assignee_kind: 'member' },
      ])
      .mockResolvedValueOnce(null);
    await helpers.ensureMemberRoleLink(role, 'membership', 'group');
    expect(role.mutate.group_membership_role.insert).toHaveBeenCalled();
  });

  it('loads active users for groups and roles', async () => {
    const group = createTx();
    group.run.mockResolvedValueOnce([
      { user_id: 'active', status: 'active' },
      { user_id: 'inactive', status: 'inactive' },
    ]);
    await expect(helpers.getActiveUserIdsForGroup(group, 'group')).resolves.toEqual(
      new Set(['active'])
    );
    const noLinks = createTx();
    noLinks.run.mockResolvedValueOnce([]);
    await expect(helpers.getActiveUsersForGroupRole(noLinks, 'group', 'role')).resolves.toEqual(
      new Set()
    );
    const linked = createTx();
    linked.run
      .mockResolvedValueOnce([{ group_membership_id: 'membership' }])
      .mockResolvedValueOnce([
        { id: 'membership', group_id: 'group', user_id: 'active', status: 'active' },
        { id: 'wrong-group', group_id: 'other', user_id: 'other', status: 'active' },
        { id: 'inactive', group_id: 'group', user_id: 'inactive', status: 'inactive' },
        { id: 'unlinked', group_id: 'group', user_id: 'unlinked', status: 'active' },
      ]);
    await expect(helpers.getActiveUsersForGroupRole(linked, 'group', 'role')).resolves.toEqual(
      new Set(['active'])
    );
  });
});

describe('automatic sibling membership derivation', () => {
  it('merges exactly-one selected sources and skips ambiguous or already desired users', async () => {
    const empty = createTx();
    await helpers.addSelectedSourceGroupMembershipSources(empty, [], new Map());
    expect(empty.run).not.toHaveBeenCalled();

    const tx = createTx();
    tx.run
      .mockResolvedValueOnce([
        { user_id: 'one', status: 'active' },
        { user_id: 'ambiguous', status: 'active' },
        { user_id: 'existing', status: 'active' },
      ])
      .mockResolvedValueOnce([
        { user_id: 'one', status: 'active' },
        { user_id: 'ambiguous', status: 'active' },
        { user_id: 'outside', status: 'active' },
        { user_id: 'existing', status: 'active' },
      ])
      .mockResolvedValueOnce([{ user_id: 'ambiguous', status: 'active' }]);
    const desired = new Map([
      ['existing', { source: 'sibling_all_members', sourceGroupId: 'connected' }],
    ]);
    await helpers.addSelectedSourceGroupMembershipSources(
      tx,
      [{ connectedGroupId: 'connected', selectedSourceGroupIds: ['source-a', 'source-b'] }],
      desired
    );
    expect(desired.get('one')).toEqual({ source: 'sibling_parliament', sourceGroupId: 'source-a' });
    expect(desired.has('ambiguous')).toBe(false);
  });

  it('derives all-member, role-member, and selected-source connection membership sources', async () => {
    const connections = [
      { id: 'no-rule', status: 'active', created_at: 0 },
      { id: 'inactive', status: 'inactive', created_at: 1 },
      { id: 'unknown', status: 'active', created_at: 2 },
      { id: 'all', status: 'active', created_at: 3 },
      { id: 'all-duplicate', status: 'active', created_at: 3.5 },
      { id: 'role-missing', status: 'active', created_at: 4 },
      { id: 'role', status: 'active', created_at: 5 },
      { id: 'selected-empty', status: 'active', created_at: 6 },
      { id: 'selected', status: 'active', created_at: 7 },
      { id: 'other-target', status: 'active', created_at: 8 },
    ];
    const rule = (id: string, mode: string, extra: Record<string, unknown> = {}) => ({
      id: `rule-${id}`,
      connection_id: id,
      member_source_group_id: `source-${id}`,
      member_target_group_id: id === 'other-target' ? 'other' : 'target',
      membership_mode: mode,
      ...extra,
    });
    const rules = [
      rule('inactive', 'all_members'),
      rule('unknown', 'unknown'),
      rule('all', 'all_members'),
      rule('all-duplicate', 'all_members'),
      rule('role-missing', 'role_members'),
      rule('role', 'role_members', { required_source_role_id: 'role-id' }),
      rule('selected-empty', 'selected_source_groups'),
      rule('selected', 'selected_source_groups'),
      rule('other-target', 'all_members'),
    ];
    const origins = [
      { membership_rule_id: 'rule-selected', eligible_origin_group_id: 'selected-source' },
      { membership_rule_id: 'other', eligible_origin_group_id: 'ignored' },
    ];
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(connections)
      .mockResolvedValueOnce(rules)
      .mockResolvedValueOnce(origins)
      .mockResolvedValueOnce([
        { user_id: 'all-user', status: 'active' },
        { user_id: 'inactive-user', status: 'inactive' },
      ])
      .mockResolvedValueOnce([{ user_id: 'all-user', status: 'active' }])
      .mockResolvedValueOnce([
        { group_membership_id: 'all-membership' },
        { group_membership_id: 'role-membership' },
      ])
      .mockResolvedValueOnce([
        { id: 'all-membership', group_id: 'source-role', user_id: 'all-user', status: 'active' },
        { id: 'role-membership', group_id: 'source-role', user_id: 'role-user', status: 'active' },
      ])
      .mockResolvedValueOnce([{ user_id: 'selected-user', status: 'active' }])
      .mockResolvedValueOnce([{ user_id: 'selected-user', status: 'active' }]);
    const desired = await helpers.getDesiredGroupConnectionMembershipSources(tx, 'target');
    expect([...desired.keys()]).toEqual(
      expect.arrayContaining(['all-user', 'role-user', 'selected-user'])
    );
  });

  it('upserts unchanged, patched, and new automatic memberships', async () => {
    const unchanged = createTx();
    unchanged.run
      .mockResolvedValueOnce({
        id: 'membership',
        status: 'active',
        visibility: 'public',
        source: 'sibling_all_members',
        source_group_id: null,
      })
      .mockResolvedValueOnce([]);
    await helpers.upsertAutomaticSiblingMembership(unchanged, {
      groupId: 'group',
      userId: 'user',
      source: 'sibling_all_members',
    });
    expect(unchanged.mutate.group_membership.update).not.toHaveBeenCalled();

    const patched = createTx();
    patched.run
      .mockResolvedValueOnce({
        id: 'membership',
        status: 'inactive',
        visibility: 'private',
        source: 'sibling_elected',
        source_group_id: 'old',
      })
      .mockResolvedValueOnce([]);
    await helpers.upsertAutomaticSiblingMembership(patched, {
      groupId: 'group',
      userId: 'user',
      source: 'sibling_all_members',
      sourceGroupId: 'new',
    });
    expect(patched.mutate.group_membership.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', visibility: 'public', source_group_id: 'new' })
    );

    const inserted = createTx();
    inserted.run.mockResolvedValueOnce(null).mockResolvedValueOnce([]);
    await helpers.upsertAutomaticSiblingMembership(inserted, {
      groupId: 'group',
      userId: 'user',
      source: 'sibling_all_members',
      sourceGroupId: null,
    });
    expect(inserted.mutate.group_membership.insert).toHaveBeenCalled();
  });

  it('recomputes, traverses, and clears sibling memberships with counter parity', async () => {
    const recompute = createTx();
    recompute.run
      .mockResolvedValueOnce([
        { id: 'manual', user_id: 'manual', source: 'direct' },
        {
          id: 'keep',
          user_id: 'keep',
          source: 'sibling_all_members',
          status: 'active',
          source_group_id: 'source',
        },
        {
          id: 'remove',
          user_id: 'remove',
          source: 'sibling_elected',
          status: 'inactive',
          source_group_id: 'source',
        },
      ])
      .mockResolvedValueOnce([{ id: 'connection', status: 'active', created_at: 1 }])
      .mockResolvedValueOnce([
        {
          id: 'rule',
          connection_id: 'connection',
          member_source_group_id: 'source',
          member_target_group_id: 'target',
          membership_mode: 'all_members',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { user_id: 'keep', status: 'active' },
        { user_id: 'new', status: 'active' },
      ])
      .mockResolvedValueOnce({
        id: 'keep',
        status: 'active',
        visibility: 'public',
        source: 'sibling_all_members',
        source_group_id: 'source',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);
    await recomputeSiblingGroupMemberships(recompute, 'target');
    expect(recompute.mutate.group_membership.delete).toHaveBeenCalledWith({ id: 'remove' });
    expect(recompute.mutate.group_membership.insert).toHaveBeenCalled();

    const traversal = createTx();
    traversal.run
      .mockResolvedValueOnce([{ id: 'connection' }])
      .mockResolvedValueOnce([
        {
          id: 'rule',
          connection_id: 'connection',
          member_source_group_id: 'source',
          member_target_group_id: 'target',
          membership_mode: 'all_members',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await expect(recomputeSiblingMembershipsForGroup(traversal, 'source')).resolves.toEqual(
      new Set(['target'])
    );

    const disconnected = createTx();
    disconnected.run.mockResolvedValue([]);
    disconnected.run
      .mockResolvedValueOnce([{ id: 'connection' }])
      .mockResolvedValueOnce([
        {
          id: 'rule',
          connection_id: 'connection',
          member_source_group_id: 'unrelated-source',
          member_target_group_id: 'unrelated-target',
          membership_mode: 'all_members',
        },
      ])
      .mockResolvedValueOnce([]);
    await expect(recomputeSiblingMembershipsForGroup(disconnected, 'group')).resolves.toEqual(
      new Set()
    );

    const originTraversal = createTx();
    originTraversal.run.mockResolvedValue([]);
    originTraversal.run
      .mockResolvedValueOnce([{ id: 'connection' }])
      .mockResolvedValueOnce([
        {
          id: 'rule',
          connection_id: 'connection',
          member_source_group_id: 'source',
          member_target_group_id: 'target',
          membership_mode: 'selected_source_groups',
        },
      ])
      .mockResolvedValueOnce([{ membership_rule_id: 'rule', eligible_origin_group_id: 'origin' }]);
    await expect(recomputeSiblingMembershipsForGroup(originTraversal, 'origin')).resolves.toEqual(
      new Set(['target'])
    );

    const none = createTx();
    none.run.mockResolvedValueOnce([{ id: 'manual', user_id: 'user', source: 'direct' }]);
    await clearAutomaticSiblingMemberships(none, 'group');
    const cleared = createTx();
    cleared.run.mockResolvedValueOnce([
      { id: 'auto', user_id: 'user', source: 'sibling_all_members' },
      { id: 'manual', user_id: 'other', source: 'direct' },
    ]);
    await clearAutomaticSiblingMemberships(cleared, 'group');
    expect(cleared.mutate.group_membership.delete).toHaveBeenCalledOnce();
  });

  it('detects active membership and keeps the source-sync compatibility no-op', async () => {
    const inactive = createTx();
    inactive.run.mockResolvedValueOnce([{ status: 'inactive' }]);
    await expect(userHasActiveMembershipInGroup(inactive, 'user', 'group')).resolves.toBe(false);
    const active = createTx();
    active.run.mockResolvedValueOnce([{ status: 'inactive' }, { status: 'active' }]);
    await expect(userHasActiveMembershipInGroup(active, 'user', 'group')).resolves.toBe(true);
    await expect(syncSiblingSourceGroups(createTx(), 'group', ['source'])).resolves.toBeUndefined();
  });
});

describe('sibling configuration validation', () => {
  it('rejects each invalid non-sibling and sibling configuration', async () => {
    await expect(
      assertValidSiblingConfiguration(createTx(), {
        groupId: 'group',
        groupType: 'base',
      })
    ).resolves.toBeUndefined();
    for (const extra of [
      { connectedGroupId: 'other' },
      { siblingMembershipMode: 'open' },
      { siblingRoleId: 'role' },
      { parliamentSourceGroupIds: ['', 'source', 'source'] },
    ]) {
      await expect(
        assertValidSiblingConfiguration(createTx(), {
          groupId: 'group',
          groupType: 'base',
          ...extra,
        })
      ).rejects.toThrow('Only sibling');
    }
    await expect(
      assertValidSiblingConfiguration(createTx(), { groupId: 'group', groupType: 'sibling' })
    ).rejects.toThrow('connected group');
    await expect(
      assertValidSiblingConfiguration(createTx(), {
        groupId: 'group',
        groupType: 'sibling',
        connectedGroupId: 'other',
      })
    ).rejects.toThrow('membership mode');
    await expect(
      assertValidSiblingConfiguration(createTx(), {
        groupId: 'group',
        groupType: 'sibling',
        connectedGroupId: 'group',
        siblingMembershipMode: 'open',
      })
    ).rejects.toThrow('itself');
    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await expect(
      assertValidSiblingConfiguration(missing, {
        groupId: 'group',
        groupType: 'sibling',
        connectedGroupId: 'other',
        siblingMembershipMode: 'open',
      })
    ).rejects.toThrow('not found');
  });

  it('validates elected and parliament-specific role/source rules', async () => {
    const electedNoRole = createTx();
    electedNoRole.run.mockResolvedValueOnce({ id: 'other' });
    await expect(
      assertValidSiblingConfiguration(electedNoRole, {
        groupId: 'group',
        groupType: 'sibling',
        connectedGroupId: 'other',
        siblingMembershipMode: 'elected',
      })
    ).rejects.toThrow('connected role');
    for (const role of [
      null,
      { group_id: 'wrong', scope: 'group', assignee_kind: 'member' },
      { group_id: 'other', scope: 'event', assignee_kind: 'member' },
      { group_id: 'other', scope: 'group', assignee_kind: 'guest' },
      { group_id: 'other', scope: 'group', assignee_kind: 'member' },
    ]) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce({ id: 'other' }).mockResolvedValueOnce(role);
      const promise = assertValidSiblingConfiguration(tx, {
        groupId: 'group',
        groupType: 'sibling',
        connectedGroupId: 'other',
        siblingMembershipMode: 'elected',
        siblingRoleId: 'role',
      });
      if (role?.assignee_kind === 'member' && role.group_id === 'other' && role.scope === 'group') {
        await expect(promise).resolves.toBeUndefined();
      } else {
        await expect(promise).rejects.toThrow();
      }
    }

    const roleOnOpen = createTx();
    roleOnOpen.run.mockResolvedValueOnce({ id: 'other' });
    await expect(
      assertValidSiblingConfiguration(roleOnOpen, {
        groupId: 'group',
        groupType: 'sibling',
        connectedGroupId: 'other',
        siblingMembershipMode: 'open',
        siblingRoleId: 'role',
      })
    ).rejects.toThrow('Only elected');

    const parliamentEmpty = createTx();
    parliamentEmpty.run.mockResolvedValueOnce({ id: 'other' });
    await expect(
      assertValidSiblingConfiguration(parliamentEmpty, {
        groupId: 'group',
        groupType: 'sibling',
        connectedGroupId: 'other',
        siblingMembershipMode: 'parliament',
      })
    ).rejects.toThrow('source group');
    const parliamentSelf = createTx();
    parliamentSelf.run.mockResolvedValueOnce({ id: 'other' });
    await expect(
      assertValidSiblingConfiguration(parliamentSelf, {
        groupId: 'group',
        groupType: 'sibling',
        connectedGroupId: 'other',
        siblingMembershipMode: 'parliament',
        parliamentSourceGroupIds: ['group'],
      })
    ).rejects.toThrow('itself');
    const openSources = createTx();
    openSources.run.mockResolvedValueOnce({ id: 'other' });
    await expect(
      assertValidSiblingConfiguration(openSources, {
        groupId: 'group',
        groupType: 'sibling',
        connectedGroupId: 'other',
        siblingMembershipMode: 'open',
        parliamentSourceGroupIds: ['source'],
      })
    ).rejects.toThrow('Only parliament');
    const validParliament = createTx();
    validParliament.run.mockResolvedValueOnce({ id: 'other' });
    await expect(
      assertValidSiblingConfiguration(validParliament, {
        groupId: 'group',
        groupType: 'sibling',
        connectedGroupId: 'other',
        siblingMembershipMode: 'parliament',
        parliamentSourceGroupIds: ['source'],
      })
    ).resolves.toBeUndefined();
  });
});
