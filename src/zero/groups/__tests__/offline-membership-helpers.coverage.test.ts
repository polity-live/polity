import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ancestors: ['ancestor-a', 'ancestor-b'] as string[],
  groupsById: new Map<string, { id: string; group_type?: string | null }>(),
  relationships: [] as Record<string, unknown>[],
}));

vi.mock('@/features/groups/logic/hierarchy', () => ({
  resolveHierarchicalAncestors: () => mocks.ancestors,
}));
vi.mock('../../server-helpers', () => ({
  isActiveGroupStatus: (status: string | null | undefined) => status === 'active',
}));
vi.mock('../membership-helpers', () => ({
  buildGroupsById: () => mocks.groupsById,
  filterHierarchyRelationships: (relationships: unknown[]) => relationships,
  loadActiveHierarchyRelationships: () => mocks.relationships,
}));
vi.mock('../../network/membershipRules', () => ({
  normalizeMembershipRule: (rule: Record<string, any> | null | undefined) =>
    rule?.member_source_group_id && rule?.member_target_group_id && rule?.membership_mode
      ? rule
      : null,
}));

import {
  buildOfflineMembershipPersonKey,
  clearAutomaticOfflineSiblingMemberships,
  ensureOfflineDirectMembership,
  isAutomaticOfflineMembershipSource,
  isManualOfflineMembershipSource,
  loadEffectiveOfflineMembershipsByGroupIds,
  loadEffectiveOfflineMembershipsForGroup,
  offlineMembershipHelperInternals as helpers,
  reconcileOfflineHierarchyForBaseGroup,
  recomputeOfflineSiblingGroupMemberships,
  recomputeOfflineSiblingMembershipsForGroup,
} from '../offline-membership-helpers';

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      group_offline_membership: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  } as any;
}

const activeMembership = (id: string, groupId = 'group') => ({
  id: `membership-${id}`,
  group_id: groupId,
  group_offline_member_id: id,
  status: 'active',
  source: 'direct',
  source_group_id: null,
  group_offline_member: { id, connected_user_id: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ancestors = ['ancestor-a', 'ancestor-b'];
  mocks.groupsById = new Map();
  mocks.relationships = [];
  let uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`
  );
});

describe('offline membership primitives', () => {
  it('normalizes identities, sources, contexts, statuses, modes, and keys', () => {
    expect(helpers.normalizeSourceGroupId(undefined)).toBeNull();
    expect(helpers.normalizeSourceGroupId('source')).toBe('source');
    expect(buildOfflineMembershipPersonKey({ connectedUserId: 'user', offlineMemberId: 'off' })).toBeNull();
    expect(buildOfflineMembershipPersonKey({ offlineMemberId: 'off' })).toBe('offline:off');
    expect(buildOfflineMembershipPersonKey({})).toBeNull();
    expect(isManualOfflineMembershipSource('direct')).toBe(true);
    expect(isManualOfflineMembershipSource(null)).toBe(false);
    expect(isAutomaticOfflineMembershipSource('derived')).toBe(true);
    expect(isAutomaticOfflineMembershipSource('sibling_all_members')).toBe(true);
    expect(isAutomaticOfflineMembershipSource(null)).toBe(false);
    expect(isAutomaticOfflineMembershipSource('direct')).toBe(false);
    expect(helpers.isEffectiveOfflineMembership(activeMembership('off'))).toBe(true);
    expect(helpers.isEffectiveOfflineMembership({ status: 'inactive' })).toBe(false);
    expect(
      helpers.isEffectiveOfflineMembership({
        status: 'active',
        group_offline_member: { connected_user_id: 'user' },
      })
    ).toBe(false);
    expect(helpers.getDirectionalMembershipContexts({ group_a_id: 'a', group_b_id: 'b' }, null)).toEqual([]);
    expect(
      helpers.getDirectionalMembershipContexts(
        { group_a_id: 'a', group_b_id: 'b' },
        { member_source_group_id: 'a', member_target_group_id: 'b', membership_mode: 'all_members' }
      )
    ).toHaveLength(1);
    expect(helpers.isActiveGroupConnectionStatus('active')).toBe(true);
    expect(helpers.isActiveGroupConnectionStatus('pending')).toBe(false);
    expect(
      ['all_members', 'role_members', 'selected_source_groups', 'unknown'].map(
        helpers.getNetworkMembershipSourceForMode
      )
    ).toEqual(['sibling_all_members', 'sibling_elected', 'sibling_parliament', null]);
    expect(helpers.getOfflineMembershipKey('group', 'off')).toBe('group:off');
  });

  it('loads effective memberships for one, many, and no groups', async () => {
    const one = createTx();
    one.run.mockResolvedValueOnce([
      activeMembership('active'),
      { ...activeMembership('inactive'), status: 'inactive' },
      {
        ...activeMembership('connected'),
        group_offline_member: { id: 'connected', connected_user_id: 'user' },
      },
    ]);
    await expect(loadEffectiveOfflineMembershipsForGroup(one, 'group')).resolves.toHaveLength(1);

    const none = createTx();
    await expect(loadEffectiveOfflineMembershipsByGroupIds(none, [])).resolves.toEqual([]);
    expect(none.run).not.toHaveBeenCalled();

    const many = createTx();
    many.run.mockResolvedValueOnce([activeMembership('active'), { ...activeMembership('inactive'), status: 'inactive' }]);
    await expect(loadEffectiveOfflineMembershipsByGroupIds(many, ['group', 'group'])).resolves.toHaveLength(1);
  });

  it('filters role-linked memberships by link, group, status, and connected user', async () => {
    const none = createTx();
    none.run.mockResolvedValueOnce([]);
    await expect(helpers.getActiveOfflineMembersForGroupRole(none, 'group', 'role')).resolves.toEqual([]);

    const linked = createTx();
    linked.run
      .mockResolvedValueOnce([
        { group_offline_membership_id: 'valid' },
        { group_offline_membership_id: 'inactive' },
        { group_offline_membership_id: 'connected' },
        { group_offline_membership_id: 'wrong-group' },
      ])
      .mockResolvedValueOnce([
        { ...activeMembership('valid'), id: 'valid' },
        { ...activeMembership('inactive'), id: 'inactive', status: 'inactive' },
        {
          ...activeMembership('connected'),
          id: 'connected',
          group_offline_member: { id: 'connected', connected_user_id: 'user' },
        },
        { ...activeMembership('wrong-group', 'other'), id: 'wrong-group' },
        { ...activeMembership('unlinked'), id: 'unlinked' },
      ]);
    await expect(helpers.getActiveOfflineMembersForGroupRole(linked, 'group', 'role')).resolves.toEqual([
      expect.objectContaining({ id: 'valid' }),
    ]);
  });
});

describe('offline membership upserts and sibling derivation', () => {
  it('keeps identical memberships, patches changed fields, and inserts direct/derived/sibling rows', async () => {
    const same = createTx();
    same.run.mockResolvedValueOnce({
      id: 'same',
      status: 'active',
      visibility: 'public',
      source: 'direct',
      source_group_id: null,
    });
    await expect(
      helpers.upsertOfflineMembership(same, {
        groupId: 'group',
        groupOfflineMemberId: 'off',
        source: 'direct',
      })
    ).resolves.toBe('same');
    expect(same.mutate.group_offline_membership.update).not.toHaveBeenCalled();

    const changed = createTx();
    changed.run.mockResolvedValueOnce({
      id: 'changed',
      status: 'inactive',
      visibility: 'private',
      source: 'direct',
      source_group_id: null,
    });
    await helpers.upsertOfflineMembership(changed, {
      groupId: 'group',
      groupOfflineMemberId: 'off',
      status: 'active',
      visibility: 'public',
      source: 'derived',
      sourceGroupId: 'base',
    });
    expect(changed.mutate.group_offline_membership.update).toHaveBeenCalledWith({
      id: 'changed',
      status: 'active',
      visibility: 'public',
      source: 'derived',
      source_group_id: 'base',
    });

    const direct = createTx();
    direct.run.mockResolvedValueOnce(null);
    await ensureOfflineDirectMembership(direct, { groupId: 'group', groupOfflineMemberId: 'direct' });
    const derived = createTx();
    derived.run.mockResolvedValueOnce(null);
    await helpers.upsertHierarchyDerivedOfflineMembership(derived, {
      groupId: 'ancestor',
      groupOfflineMemberId: 'derived',
      baseGroupId: 'base',
    });
    const sibling = createTx();
    sibling.run.mockResolvedValueOnce(null);
    await helpers.upsertAutomaticSiblingOfflineMembership(sibling, {
      groupId: 'sibling',
      groupOfflineMemberId: 'auto',
      source: 'sibling_all_members',
    });
    expect(sibling.mutate.group_offline_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({ source_group_id: null })
    );
  });

  it('merges selected sources only for connected members with exactly one origin', async () => {
    const empty = createTx();
    await helpers.addSelectedOfflineSourceGroupMembershipSources(empty, [], new Map());
    expect(empty.run).not.toHaveBeenCalled();

    const tx = createTx();
    tx.run
      .mockResolvedValueOnce([activeMembership('one'), activeMembership('ambiguous'), activeMembership('existing')])
      .mockResolvedValueOnce([activeMembership('one'), activeMembership('ambiguous'), activeMembership('outside'), activeMembership('existing')])
      .mockResolvedValueOnce([activeMembership('ambiguous')]);
    const desired = new Map([
      ['existing', { source: 'sibling_all_members' as const, sourceGroupId: 'connected' }],
    ]);
    await helpers.addSelectedOfflineSourceGroupMembershipSources(
      tx,
      [{ connectedGroupId: 'connected', selectedSourceGroupIds: ['source-a', 'source-b'] }],
      desired
    );
    expect(desired.get('one')).toEqual({ source: 'sibling_parliament', sourceGroupId: 'source-a' });
    expect(desired.has('ambiguous')).toBe(false);
  });

  it('derives all, elected, and selected connection membership sources with stable precedence', async () => {
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
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce(connections)
      .mockResolvedValueOnce(rules)
      .mockResolvedValueOnce([
        { membership_rule_id: 'rule-selected', eligible_origin_group_id: 'selected-source' },
      ])
      .mockResolvedValueOnce([activeMembership('all-user')])
      .mockResolvedValueOnce([activeMembership('all-user')])
      .mockResolvedValueOnce([
        { group_offline_membership_id: 'all-membership' },
        { group_offline_membership_id: 'role-membership' },
      ])
      .mockResolvedValueOnce([
        { ...activeMembership('all-user', 'source-role'), id: 'all-membership' },
        { ...activeMembership('role-user', 'source-role'), id: 'role-membership' },
      ])
      .mockResolvedValueOnce([activeMembership('selected-user')])
      .mockResolvedValueOnce([activeMembership('selected-user')]);
    const desired = await helpers.getDesiredOfflineGroupConnectionMembershipSources(tx, 'target');
    expect([...desired.keys()]).toEqual(expect.arrayContaining(['all-user', 'role-user', 'selected-user']));
  });
});

describe('offline membership reconciliation', () => {
  it('clears only automatic sibling rows', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce([
      { id: 'manual', source: 'direct' },
      { id: 'derived', source: 'derived' },
      { id: 'auto', source: 'sibling_elected' },
    ]);
    await clearAutomaticOfflineSiblingMemberships(tx, 'group');
    expect(tx.mutate.group_offline_membership.delete).toHaveBeenCalledOnce();
    expect(tx.mutate.group_offline_membership.delete).toHaveBeenCalledWith({ id: 'auto' });
  });

  it('keeps matching automatic rows, removes stale variants, and creates missing rows', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce([
        { id: 'manual', group_offline_member_id: 'manual', source: 'direct' },
        { id: 'keep', group_offline_member_id: 'keep', source: 'sibling_all_members', source_group_id: 'source', status: 'active', visibility: 'public' },
        { id: 'missing', group_offline_member_id: 'missing', source: 'sibling_elected', source_group_id: 'source', status: 'active' },
        { id: 'wrong-source', group_offline_member_id: 'keep', source: 'sibling_elected', source_group_id: 'source', status: 'active' },
        { id: 'wrong-group', group_offline_member_id: 'keep', source: 'sibling_all_members', source_group_id: 'other', status: 'active' },
        { id: 'inactive', group_offline_member_id: 'keep', source: 'sibling_all_members', source_group_id: 'source', status: 'inactive' },
      ])
      .mockResolvedValueOnce([{ id: 'connection', status: 'active', created_at: 1 }])
      .mockResolvedValueOnce([{
        id: 'rule',
        connection_id: 'connection',
        member_source_group_id: 'source',
        member_target_group_id: 'target',
        membership_mode: 'all_members',
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([activeMembership('keep'), activeMembership('new')])
      .mockResolvedValueOnce({ id: 'keep', status: 'active', visibility: 'public', source: 'sibling_all_members', source_group_id: 'source' })
      .mockResolvedValueOnce(null);
    await expect(recomputeOfflineSiblingGroupMemberships(tx, 'target')).resolves.toEqual(new Set(['target']));
    expect(tx.mutate.group_offline_membership.delete).toHaveBeenCalledTimes(4);
    expect(tx.mutate.group_offline_membership.insert).toHaveBeenCalledOnce();
  });

  it('traverses recipient, source, origin, disconnected, and revisited connection paths', async () => {
    const source = createTx();
    source.run.mockResolvedValue([]);
    source.run
      .mockResolvedValueOnce([{ id: 'connection' }])
      .mockResolvedValueOnce([{
        id: 'rule', connection_id: 'connection', member_source_group_id: 'source',
        member_target_group_id: 'target', membership_mode: 'all_members',
      }])
      .mockResolvedValueOnce([]);
    await expect(recomputeOfflineSiblingMembershipsForGroup(source, 'source')).resolves.toEqual(new Set(['target']));

    const disconnected = createTx();
    disconnected.run.mockResolvedValue([]);
    disconnected.run
      .mockResolvedValueOnce([{ id: 'connection' }])
      .mockResolvedValueOnce([{
        id: 'rule', connection_id: 'connection', member_source_group_id: 'x',
        member_target_group_id: 'y', membership_mode: 'all_members',
      }])
      .mockResolvedValueOnce([]);
    await expect(recomputeOfflineSiblingMembershipsForGroup(disconnected, 'group')).resolves.toEqual(new Set());

    const origin = createTx();
    origin.run.mockResolvedValue([]);
    origin.run
      .mockResolvedValueOnce([{ id: 'connection' }])
      .mockResolvedValueOnce([{
        id: 'rule', connection_id: 'connection', member_source_group_id: 'source',
        member_target_group_id: 'target', membership_mode: 'selected_source_groups',
      }])
      .mockResolvedValueOnce([{ membership_rule_id: 'rule', eligible_origin_group_id: 'origin' }]);
    await expect(recomputeOfflineSiblingMembershipsForGroup(origin, 'origin')).resolves.toEqual(new Set(['target']));
  });

  it('reconciles hierarchy removals, retained rows, and new projections', async () => {
    const tx = createTx();
    tx.run
      .mockResolvedValueOnce([
        activeMembership('direct', 'base'),
        { ...activeMembership('inactive', 'base'), status: 'inactive' },
        {
          ...activeMembership('connected', 'base'),
          group_offline_member: { id: 'connected', connected_user_id: 'user' },
        },
      ])
      .mockResolvedValueOnce([
        { id: 'keep', group_id: 'ancestor-a', group_offline_member_id: 'direct' },
        { id: 'stale', group_id: 'old-ancestor', group_offline_member_id: 'direct' },
      ])
      .mockResolvedValueOnce(null);
    const result = await reconcileOfflineHierarchyForBaseGroup(tx, 'base');
    expect(tx.mutate.group_offline_membership.delete).toHaveBeenCalledWith({ id: 'stale' });
    expect(tx.mutate.group_offline_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'ancestor-b', group_offline_member_id: 'direct' })
    );
    expect(result.affectedGroupIds).toEqual(
      new Set(['ancestor-a', 'ancestor-b', 'old-ancestor'])
    );
  });
});
