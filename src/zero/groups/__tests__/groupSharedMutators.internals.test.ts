import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  can: vi.fn(async (_ctx: unknown, _action: unknown, _target: { resource?: string }) => undefined),
  group: null as Record<string, any> | null,
  activeMembership: false,
}));

vi.mock('../../rbac/can', () => ({ can: mocks.can }));
vi.mock('../membership-helpers', () => ({
  isManualGroupMembershipSource: (source: string) => source === 'direct' || source === 'manual',
  loadGroupWithDerivedNetworkMeta: async () => mocks.group,
  userHasActiveMembershipInGroup: async () => mocks.activeMembership,
}));
vi.mock('../offline-membership-helpers', () => ({
  ensureOfflineDirectMembership: vi.fn(),
}));

import { groupSharedMutatorInternals as helpers } from '../shared-mutators';

function createTx(location: 'client' | 'server' = 'server') {
  const mutation = () => ({ insert: vi.fn(), update: vi.fn(), delete: vi.fn() });
  return {
    location,
    run: vi.fn(),
    mutate: {
      group_membership_role: mutation(),
      group_offline_membership_role: mutation(),
      group_guest_role: mutation(),
      role: mutation(),
    },
  } as any;
}

const ctx = { userID: 'actor', email: 'actor@example.test' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.group = null;
  mocks.activeMembership = false;
  let uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`
  );
});

describe('shared group mutator policy helpers', () => {
  it('validates amendment rights and guest-only sibling modes', () => {
    expect(helpers.isAllowedAmendmentActionRight(null, null)).toBe(false);
    expect(helpers.isAllowedAmendmentActionRight('amendments', null)).toBe(false);
    expect(helpers.isAllowedAmendmentActionRight('unknown', 'unknown')).toBe(false);
    expect(
      ['create', 'read', 'update', 'delete', 'manage'].some(action =>
        helpers.isAllowedAmendmentActionRight('amendments', action)
      )
    ).toBe(true);

    expect(helpers.requiresGuestAccessFlow({ group_type: 'base' })).toBe(false);
    expect(
      helpers.requiresGuestAccessFlow({
        group_type: 'sibling',
        primary_sibling_membership_mode: null,
      })
    ).toBe(false);
    expect(
      helpers.requiresGuestAccessFlow({
        group_type: 'sibling',
        primary_sibling_membership_mode: 'none',
      })
    ).toBe(false);
    expect(
      helpers.requiresGuestAccessFlow({
        group_type: 'sibling',
        primary_sibling_membership_mode: 'all_members',
      })
    ).toBe(true);
  });

  it('enforces default-role compatibility for base and guest-only groups', async () => {
    const tx = createTx();
    await expect(
      helpers.assertRoleDefaultCompatibility(tx, {
        groupId: 'group',
        assigneeKind: 'member',
        defaultRequestRole: false,
        defaultInviteRole: false,
      })
    ).resolves.toBeUndefined();

    mocks.group = null;
    await expect(
      helpers.assertRoleDefaultCompatibility(tx, {
        groupId: 'group',
        assigneeKind: 'member',
        defaultRequestRole: true,
        defaultInviteRole: false,
      })
    ).rejects.toThrow('Group not found');

    mocks.group = { group_type: 'sibling', primary_sibling_membership_mode: 'role_members' };
    await expect(
      helpers.assertRoleDefaultCompatibility(tx, {
        groupId: 'group',
        assigneeKind: 'member',
        defaultRequestRole: false,
        defaultInviteRole: true,
      })
    ).rejects.toThrow('Only guest roles');
    await expect(
      helpers.assertRoleDefaultCompatibility(tx, {
        groupId: 'group',
        assigneeKind: 'guest',
        defaultRequestRole: true,
        defaultInviteRole: false,
      })
    ).resolves.toBeUndefined();

    mocks.group = { group_type: 'base' };
    await expect(
      helpers.assertRoleDefaultCompatibility(tx, {
        groupId: 'group',
        assigneeKind: 'guest',
        defaultRequestRole: true,
        defaultInviteRole: true,
      })
    ).rejects.toThrow('Guest roles cannot');
    await expect(
      helpers.assertRoleDefaultCompatibility(tx, {
        groupId: 'group',
        assigneeKind: 'member',
        defaultRequestRole: true,
        defaultInviteRole: true,
      })
    ).resolves.toBeUndefined();
  });

  it('authorizes each supported role scope and tolerates an empty scope', async () => {
    const tx = createTx();
    for (const scope of [
      { group_id: 'group' },
      { event_id: 'event' },
      { amendment_id: 'amendment' },
      { blog_id: 'blog' },
      {},
    ]) {
      await helpers.authorizeScopedRoleMutation(tx, ctx, scope);
    }
    expect(mocks.can.mock.calls.map(call => call[2]?.resource)).toEqual([
      'groupAccessRoles',
      'events',
      'amendments',
      'blogs',
    ]);
  });

  it('loads and authorizes membership, offline membership, guest, and role records', async () => {
    const cases = [
      [helpers.loadMembershipForRoleMutation, 'Membership not found'],
      [helpers.loadOfflineMembershipForRoleMutation, 'Offline membership not found'],
      [helpers.loadGuestAccessForRoleMutation, 'Guest access not found'],
    ] as const;
    for (const [load, message] of cases) {
      const missing = createTx();
      missing.run.mockResolvedValueOnce(null);
      await expect(load(missing, ctx, 'id')).rejects.toThrow(message);

      const present = createTx();
      present.run.mockResolvedValueOnce({ id: 'id', group_id: 'group' });
      await expect(load(present, ctx, 'id')).resolves.toMatchObject({ id: 'id' });
    }

    const roleMissing = createTx();
    roleMissing.run.mockResolvedValueOnce(null);
    await expect(helpers.loadRole(roleMissing, 'role')).rejects.toThrow('Role not found');
    const rolePresent = createTx();
    rolePresent.run.mockResolvedValueOnce({ id: 'role' });
    await expect(helpers.loadRole(rolePresent, 'role')).resolves.toEqual({ id: 'role' });
  });

  it('authorizes role-holder history only on the server', async () => {
    const client = createTx('client');
    await helpers.authorizeRoleHolderHistoryMutation(client, ctx, 'role');
    await helpers.authorizeExistingRoleHolderHistoryMutation(client, ctx, 'history');
    expect(client.run).not.toHaveBeenCalled();

    const missingRole = createTx();
    missingRole.run.mockResolvedValueOnce(null);
    await expect(
      helpers.authorizeRoleHolderHistoryMutation(missingRole, ctx, 'role')
    ).rejects.toThrow('Role not found');

    const scopedRoles = [
      { id: 'role', group_id: 'group' },
      { id: 'role', event_id: 'event' },
      { id: 'role', amendment_id: 'amendment' },
      { id: 'role', blog_id: 'blog' },
    ];
    for (const role of scopedRoles) {
      const server = createTx();
      server.run.mockResolvedValueOnce(role);
      await helpers.authorizeRoleHolderHistoryMutation(server, ctx, 'role');
    }

    const historyMissing = createTx();
    historyMissing.run.mockResolvedValueOnce(null);
    await expect(
      helpers.authorizeExistingRoleHolderHistoryMutation(historyMissing, ctx, 'history')
    ).rejects.toThrow('Role holder history not found');
    const history = createTx();
    history.run.mockResolvedValueOnce({ role_id: 'role' }).mockResolvedValueOnce({ id: 'role' });
    await helpers.authorizeExistingRoleHolderHistoryMutation(history, ctx, 'history');
  });

  it('validates member and guest role assignment boundaries', async () => {
    const memberGuest = createTx();
    memberGuest.run.mockResolvedValueOnce({ id: 'guest', assignee_kind: 'guest' });
    await expect(
      helpers.assertRolesAssignableToMembers(memberGuest, ['guest'])
    ).rejects.toThrow('Guest roles');

    const memberWrongGroup = createTx();
    memberWrongGroup.run.mockResolvedValueOnce({
      id: 'role',
      assignee_kind: 'member',
      group_id: 'other',
      scope: 'group',
    });
    await expect(
      helpers.assertRolesAssignableToMembers(memberWrongGroup, ['role'], 'group')
    ).rejects.toThrow('target group');
    const memberWrongScope = createTx();
    memberWrongScope.run.mockResolvedValueOnce({
      id: 'role',
      assignee_kind: 'member',
      group_id: 'group',
      scope: 'event',
    });
    await expect(
      helpers.assertRolesAssignableToMembers(memberWrongScope, ['role'], 'group')
    ).rejects.toThrow('target group');
    const memberValid = createTx();
    memberValid.run.mockResolvedValueOnce({
      id: 'role',
      assignee_kind: 'member',
      group_id: 'group',
      scope: 'group',
    });
    await helpers.assertRolesAssignableToMembers(memberValid, ['', 'role', 'role'], 'group');

    const guestWrongGroup = createTx();
    guestWrongGroup.run.mockResolvedValueOnce({
      id: 'role',
      assignee_kind: 'guest',
      group_id: 'other',
      scope: 'group',
    });
    await expect(
      helpers.assertRolesAssignableToGuests(guestWrongGroup, 'group', ['role'])
    ).rejects.toThrow('target group');
    const guestWrongScope = createTx();
    guestWrongScope.run.mockResolvedValueOnce({
      id: 'role',
      assignee_kind: 'guest',
      group_id: 'group',
      scope: 'event',
    });
    await expect(
      helpers.assertRolesAssignableToGuests(guestWrongScope, 'group', ['role'])
    ).rejects.toThrow('target group');
    const guestMemberRole = createTx();
    guestMemberRole.run.mockResolvedValueOnce({
      id: 'role',
      assignee_kind: 'member',
      group_id: 'group',
      scope: 'group',
    });
    await expect(
      helpers.assertRolesAssignableToGuests(guestMemberRole, 'group', ['role'])
    ).rejects.toThrow('Only guest roles');
    const guestValid = createTx();
    guestValid.run.mockResolvedValueOnce({
      id: 'role',
      assignee_kind: 'guest',
      group_id: 'group',
      scope: 'group',
    });
    await helpers.assertRolesAssignableToGuests(guestValid, 'group', ['', 'role', 'role']);
  });

  it('validates direct membership eligibility for every group topology', async () => {
    const tx = createTx();
    mocks.group = null;
    await expect(
      helpers.assertCanDirectlyMutateOfficialMembership(tx, 'group', 'user')
    ).rejects.toThrow('Group not found');
    mocks.group = { group_type: 'hierarchical' };
    await expect(
      helpers.assertCanDirectlyMutateOfficialMembership(tx, 'group', 'user')
    ).rejects.toThrow('hierarchical');
    mocks.group = { group_type: 'sibling', primary_sibling_membership_mode: 'all_members' };
    await expect(
      helpers.assertCanDirectlyMutateOfficialMembership(tx, 'group', 'user')
    ).rejects.toThrow('guest access');
    mocks.group = {
      group_type: 'sibling',
      primary_sibling_membership_mode: 'legacy',
      connected_group_id: 'partner',
    };
    await expect(
      helpers.assertCanDirectlyMutateOfficialMembership(tx, 'group', 'user')
    ).rejects.toThrow('open sibling');
    mocks.group = {
      group_type: 'sibling',
      primary_sibling_membership_mode: 'none',
      connected_group_id: null,
    };
    await expect(
      helpers.assertCanDirectlyMutateOfficialMembership(tx, 'group', 'user')
    ).rejects.toThrow('open sibling');
    mocks.group = {
      group_type: 'sibling',
      primary_sibling_membership_mode: 'none',
      connected_group_id: 'partner',
    };
    mocks.activeMembership = false;
    await expect(
      helpers.assertCanDirectlyMutateOfficialMembership(tx, 'group', 'user')
    ).rejects.toThrow('active members');
    mocks.activeMembership = true;
    await expect(
      helpers.assertCanDirectlyMutateOfficialMembership(tx, 'group', 'user')
    ).resolves.toBe(mocks.group);
    mocks.group = { group_type: 'base' };
    await expect(
      helpers.assertCanDirectlyMutateOfficialMembership(tx, 'group', 'user')
    ).resolves.toBe(mocks.group);
  });
});

describe('shared group role-link helpers', () => {
  it('adds, reuses, removes, and synchronizes official membership roles', async () => {
    const existing = createTx();
    existing.run.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      helpers.addGroupMembershipRole(existing, {
        group_membership_id: 'membership',
        role_id: 'role',
      })
    ).resolves.toBe('existing');

    const inserted = createTx();
    inserted.run.mockResolvedValueOnce(null);
    await expect(
      helpers.addGroupMembershipRole(inserted, {
        group_membership_id: 'membership',
        role_id: 'role',
        assigned_by_id: 'actor',
      })
    ).resolves.toBe('uuid-1');
    expect(inserted.mutate.group_membership_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_by_id: 'actor' })
    );

    const insertedWithoutActor = createTx();
    insertedWithoutActor.run.mockResolvedValueOnce(null);
    await helpers.addGroupMembershipRole(insertedWithoutActor, {
      group_membership_id: 'membership',
      role_id: 'role',
    });
    expect(insertedWithoutActor.mutate.group_membership_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_by_id: null })
    );

    const removed = createTx();
    removed.run.mockResolvedValueOnce([{ id: 'one' }, { id: 'two' }]);
    await helpers.removeGroupMembershipRole(removed, {
      group_membership_id: 'membership',
      role_id: 'role',
    });
    expect(removed.mutate.group_membership_role.delete).toHaveBeenCalledTimes(2);

    const synced = createTx();
    synced.run
      .mockResolvedValueOnce([
        { id: 'keep-link', role_id: 'keep' },
        { id: 'remove-link', role_id: 'remove' },
      ])
      .mockResolvedValueOnce(null);
    await helpers.syncGroupMembershipRoles(synced, {
      group_membership_id: 'membership',
      role_ids: ['', 'keep', 'add', 'add'],
    });
    expect(synced.mutate.group_membership_role.delete).toHaveBeenCalledWith({ id: 'remove-link' });
    expect(synced.mutate.group_membership_role.insert).toHaveBeenCalledOnce();
  });

  it('covers offline and guest role link parity', async () => {
    const variants = [
      {
        add: helpers.addGroupOfflineMembershipRole,
        remove: helpers.removeGroupOfflineMembershipRole,
        sync: helpers.syncGroupOfflineMembershipRoles,
        key: 'group_offline_membership_id',
        table: 'group_offline_membership_role',
      },
      {
        add: helpers.addGroupGuestRole,
        remove: helpers.removeGroupGuestRole,
        sync: helpers.syncGroupGuestRoles,
        key: 'group_guest_access_id',
        table: 'group_guest_role',
      },
    ] as const;
    for (const variant of variants) {
      const existing = createTx();
      existing.run.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        variant.add(existing, { [variant.key]: 'owner', role_id: 'role' } as never)
      ).resolves.toBe('existing');

      const inserted = createTx();
      inserted.run.mockResolvedValueOnce(null);
      await variant.add(inserted, {
        [variant.key]: 'owner',
        role_id: 'role',
        assigned_by_id: null,
      } as never);
      expect(inserted.mutate[variant.table].insert).toHaveBeenCalledOnce();

      const removed = createTx();
      removed.run.mockResolvedValueOnce([{ id: 'one' }]);
      await variant.remove(removed, { [variant.key]: 'owner', role_id: 'role' } as never);
      expect(removed.mutate[variant.table].delete).toHaveBeenCalledOnce();

      const synced = createTx();
      synced.run
        .mockResolvedValueOnce([
          { id: 'keep-link', role_id: 'keep' },
          { id: 'remove-link', role_id: 'remove' },
        ])
        .mockResolvedValueOnce(null);
      await variant.sync(synced, {
        [variant.key]: 'owner',
        role_ids: ['', 'keep', 'add', 'add'],
      } as never);
      expect(synced.mutate[variant.table].delete).toHaveBeenCalledWith({ id: 'remove-link' });
      expect(synced.mutate[variant.table].insert).toHaveBeenCalledOnce();
    }
  });
});

describe('shared group default-role and offline-member helpers', () => {
  it('resolves every membership default-role fallback', async () => {
    const explicit = createTx();
    await expect(
      helpers.resolveDefaultMembershipRoleId(explicit, 'group', 'requested', 'explicit')
    ).resolves.toBe('explicit');
    await expect(
      helpers.resolveDefaultMembershipRoleId(explicit, 'group', 'active')
    ).resolves.toBeNull();

    const requested = createTx();
    requested.run.mockResolvedValueOnce([
      { id: 'guest', assignee_kind: 'guest', default_request_role: true },
      { id: 'request', assignee_kind: 'member', default_request_role: true },
    ]);
    await expect(
      helpers.resolveDefaultMembershipRoleId(requested, 'group', 'requested')
    ).resolves.toBe('request');

    const invited = createTx();
    invited.run.mockResolvedValueOnce([
      { id: 'invite', assignee_kind: 'member', default_invite_role: true },
    ]);
    await expect(
      helpers.resolveDefaultMembershipRoleId(invited, 'group', 'invited')
    ).resolves.toBe('invite');

    const fallback = createTx();
    fallback.run.mockResolvedValueOnce([
      { id: 'other', assignee_kind: 'member', name: 'Other' },
      { id: 'member', assignee_kind: 'member', name: 'Member' },
    ]);
    await expect(
      helpers.resolveDefaultMembershipRoleId(fallback, 'group', 'requested')
    ).resolves.toBe('member');
    const none = createTx();
    none.run.mockResolvedValueOnce([]);
    await expect(
      helpers.resolveDefaultMembershipRoleId(none, 'group', 'invited')
    ).resolves.toBeNull();
  });

  it('resolves every guest default-role fallback', async () => {
    const explicit = createTx();
    await expect(
      helpers.resolveDefaultGuestRoleId(explicit, 'group', 'requested', 'explicit')
    ).resolves.toBe('explicit');
    await expect(helpers.resolveDefaultGuestRoleId(explicit, 'group', 'active')).resolves.toBeNull();

    const requested = createTx();
    requested.run.mockResolvedValueOnce([
      { id: 'request', assignee_kind: 'guest', default_request_role: true },
      { id: 'member', assignee_kind: 'member', default_request_role: true },
    ]);
    await expect(helpers.resolveDefaultGuestRoleId(requested, 'group', 'requested')).resolves.toBe(
      'request'
    );
    const invited = createTx();
    invited.run.mockResolvedValueOnce([
      { id: 'invite', assignee_kind: 'guest', default_invite_role: true },
    ]);
    await expect(helpers.resolveDefaultGuestRoleId(invited, 'group', 'invited')).resolves.toBe(
      'invite'
    );
    const named = createTx();
    named.run.mockResolvedValueOnce([{ id: 'guest', assignee_kind: 'guest', name: 'Guest' }]);
    await expect(helpers.resolveDefaultGuestRoleId(named, 'group', 'requested')).resolves.toBe(
      'guest'
    );
    const first = createTx();
    first.run.mockResolvedValueOnce([{ id: 'first', assignee_kind: 'guest', name: 'Other' }]);
    await expect(helpers.resolveDefaultGuestRoleId(first, 'group', 'invited')).resolves.toBe('first');
    const none = createTx();
    none.run.mockResolvedValueOnce([]);
    await expect(helpers.resolveDefaultGuestRoleId(none, 'group', 'invited')).resolves.toBeNull();
  });

  it('assigns optional default invite roles and clears competing defaults', async () => {
    const withoutDefault = createTx();
    withoutDefault.run.mockResolvedValueOnce([]);
    await helpers.assignDefaultInviteRoleToOfflineMembership(withoutDefault, {
      groupId: 'group',
      groupOfflineMembershipId: 'offline-membership',
    });
    expect(withoutDefault.mutate.group_offline_membership_role.insert).not.toHaveBeenCalled();

    const withDefault = createTx();
    withDefault.run
      .mockResolvedValueOnce([
        { id: 'invite', assignee_kind: 'member', default_invite_role: true },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await helpers.assignDefaultInviteRoleToOfflineMembership(withDefault, {
      groupId: 'group',
      groupOfflineMembershipId: 'offline-membership',
      assignedById: 'actor',
    });
    expect(withDefault.mutate.group_offline_membership_role.insert).toHaveBeenCalledOnce();

    const noClear = createTx();
    await helpers.clearGroupRoleDefaults(noClear, { groupId: 'group' });
    expect(noClear.run).not.toHaveBeenCalled();

    const clear = createTx();
    clear.run.mockResolvedValueOnce([
      { id: 'keep', default_request_role: true, default_invite_role: true },
      { id: 'both', default_request_role: true, default_invite_role: true },
      { id: 'request', default_request_role: true, default_invite_role: false },
      { id: 'invite', default_request_role: false, default_invite_role: true },
      { id: 'none', default_request_role: false, default_invite_role: false },
    ]);
    await helpers.clearGroupRoleDefaults(clear, {
      groupId: 'group',
      keepRoleId: 'keep',
      clearRequestDefault: true,
      clearInviteDefault: true,
    });
    expect(clear.mutate.role.update).toHaveBeenCalledTimes(3);

    const requestOnly = createTx();
    requestOnly.run.mockResolvedValueOnce([
      { id: 'invite', default_request_role: false, default_invite_role: true },
    ]);
    await helpers.clearGroupRoleDefaults(requestOnly, {
      groupId: 'group',
      clearRequestDefault: true,
      clearInviteDefault: false,
    });
    expect(requestOnly.mutate.role.update).not.toHaveBeenCalled();
  });

  it('normalizes reasons and required names', () => {
    expect(helpers.normalizeOptionalReason(undefined)).toBeNull();
    expect(helpers.normalizeOptionalReason('   ')).toBeNull();
    expect(helpers.normalizeOptionalReason(' reason ')).toBe('reason');
    expect(() => helpers.normalizeRequiredName('  ')).toThrow('required');
    expect(helpers.normalizeRequiredName(' Name ')).toBe('Name');
  });

  it('authorizes base-only offline-member management and uniqueness', async () => {
    const tx = createTx();
    mocks.group = null;
    await expect(helpers.assertCanManageGroupOfflineMembers(tx, ctx, 'group')).rejects.toThrow(
      'Group not found'
    );
    mocks.group = { group_type: 'sibling' };
    await expect(helpers.assertCanManageGroupOfflineMembers(tx, ctx, 'group')).rejects.toThrow(
      'base groups'
    );
    mocks.group = { group_type: 'base' };
    await expect(helpers.assertCanManageGroupOfflineMembers(tx, ctx, 'group')).resolves.toBe(
      mocks.group
    );

    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await expect(
      helpers.loadGroupOfflineMemberForMutation(missing, ctx, 'offline')
    ).rejects.toThrow('Offline member not found');
    const present = createTx();
    present.run.mockResolvedValueOnce({ id: 'offline', group_id: 'group' });
    await expect(
      helpers.loadGroupOfflineMemberForMutation(present, ctx, 'offline')
    ).resolves.toMatchObject({ id: 'offline' });

    const absentUser = createTx();
    await helpers.assertUniqueConnectedOfflineUserWithinGroup(absentUser, {
      groupId: 'group',
      connectedUserId: null,
    });
    expect(absentUser.run).not.toHaveBeenCalled();
    const unique = createTx();
    unique.run.mockResolvedValueOnce([{ id: 'same' }]);
    await helpers.assertUniqueConnectedOfflineUserWithinGroup(unique, {
      groupId: 'group',
      connectedUserId: 'user',
      excludeOfflineMemberId: 'same',
    });
    const conflict = createTx();
    conflict.run.mockResolvedValueOnce([{ id: 'other' }]);
    await expect(
      helpers.assertUniqueConnectedOfflineUserWithinGroup(conflict, {
        groupId: 'group',
        connectedUserId: 'user',
        excludeOfflineMemberId: 'same',
      })
    ).rejects.toThrow('already connected');
  });
});
