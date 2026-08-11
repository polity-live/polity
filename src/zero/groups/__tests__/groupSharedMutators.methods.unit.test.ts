import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  can: vi.fn(async () => undefined),
  requireAuthenticated: vi.fn(),
  group: { group_type: 'base' } as Record<string, any> | null,
  activeMembership: true,
  ensureOffline: vi.fn(async () => 'offline-membership'),
}));

vi.mock('../../rbac/can', () => ({ can: mocks.can }));
vi.mock('../../rbac/authorize', () => ({ requireAuthenticated: mocks.requireAuthenticated }));
vi.mock('../membership-helpers', () => ({
  isManualGroupMembershipSource: (source: string) => source === 'direct' || source === 'manual',
  loadGroupWithDerivedNetworkMeta: async () => mocks.group,
  userHasActiveMembershipInGroup: async () => mocks.activeMembership,
}));
vi.mock('../offline-membership-helpers', () => ({
  ensureOfflineDirectMembership: mocks.ensureOffline,
}));

import { groupSharedMutators as mutators } from '../shared-mutators';

function mutationTable() {
  return { insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
}

function createTx(location: 'client' | 'server' = 'server') {
  return {
    clientID: 'client',
    mutationID: 1,
    reason: 'test',
    location,
    run: vi.fn(),
    mutate: {
      group: mutationTable(),
      group_offline_member: mutationTable(),
      group_offline_membership_role: mutationTable(),
      group_membership: mutationTable(),
      group_membership_role: mutationTable(),
      group_guest_access: mutationTable(),
      group_guest_role: mutationTable(),
      role: mutationTable(),
      action_right: mutationTable(),
      role_holder_history: mutationTable(),
    },
  } as any;
}

const ctx = { userID: 'actor', email: 'actor@example.test' } as never;

function membershipArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'membership',
    group_id: 'group',
    user_id: 'user',
    status: 'requested',
    visibility: '',
    ...overrides,
  } as never;
}

function guestArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guest-access',
    group_id: 'group',
    user_id: 'user',
    status: 'invited',
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.group = { group_type: 'base' };
  mocks.activeMembership = true;
  mocks.ensureOffline.mockResolvedValue('offline-membership');
  let uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`
  );
});

describe('shared group CRUD and offline-member mutators', () => {
  it('creates base/full groups and updates or deletes existing groups', async () => {
    const base = createTx();
    await mutators.create.fn({ tx: base, ctx, args: { id: 'group', name: 'Group' } as never });
    expect(base.mutate.group.insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_type: 'base', owner_id: 'actor' })
    );

    const hierarchical = createTx();
    await mutators.createFull.fn({
      tx: hierarchical,
      ctx,
      args: { group: { id: 'group', name: 'Group', group_type: 'hierarchical' } } as never,
    });
    expect(hierarchical.mutate.group.insert).toHaveBeenCalledWith(
      expect.objectContaining({ group_type: 'hierarchical' })
    );

    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await expect(
      mutators.update.fn({ tx: missing, ctx, args: { id: 'group', name: 'Updated' } as never })
    ).rejects.toThrow('Group not found');
    const updated = createTx();
    updated.run.mockResolvedValueOnce({ id: 'group' });
    await mutators.update.fn({ tx: updated, ctx, args: { id: 'group', name: 'Updated' } as never });
    expect(updated.mutate.group.update).toHaveBeenCalled();
    const deleted = createTx();
    await mutators.delete.fn({ tx: deleted, ctx, args: { id: 'group' } });
    expect(deleted.mutate.group.delete).toHaveBeenCalledWith({ id: 'group' });
  });

  it('creates offline members with null and explicit optional values', async () => {
    const minimal = createTx();
    minimal.run.mockResolvedValueOnce([]);
    await mutators.createOfflineMember.fn({
      tx: minimal,
      ctx,
      args: {
        id: 'offline',
        group_id: 'group',
        first_name: ' First ',
        last_name: ' Last ',
      } as never,
    });
    expect(minimal.mutate.group_offline_member.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'First',
        last_name: 'Last',
        reason_not_signed_up: null,
        connected_user_id: null,
      })
    );

    const complete = createTx();
    complete.run
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'invite-role', assignee_kind: 'member', default_invite_role: true },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await mutators.createOfflineMember.fn({
      tx: complete,
      ctx,
      args: {
        id: 'offline',
        group_id: 'group',
        first_name: 'First',
        last_name: 'Last',
        reason_not_signed_up: ' Reason ',
        connected_user_id: 'user',
      } as never,
    });
    expect(complete.mutate.group_offline_member.insert).toHaveBeenCalledWith(
      expect.objectContaining({ reason_not_signed_up: 'Reason', connected_user_id: 'user' })
    );
    expect(complete.mutate.group_offline_membership_role.insert).toHaveBeenCalledOnce();
  });

  it('updates every optional offline-member field or preserves omitted values', async () => {
    const omitted = createTx();
    omitted.run.mockResolvedValueOnce({
      id: 'offline',
      group_id: 'group',
      connected_user_id: null,
    });
    await mutators.updateOfflineMember.fn({ tx: omitted, ctx, args: { id: 'offline' } as never });
    expect(omitted.mutate.group_offline_member.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ first_name: expect.anything() })
    );

    const complete = createTx();
    complete.run
      .mockResolvedValueOnce({ id: 'offline', group_id: 'group', connected_user_id: 'old' })
      .mockResolvedValueOnce([]);
    await mutators.updateOfflineMember.fn({
      tx: complete,
      ctx,
      args: {
        id: 'offline',
        first_name: ' New ',
        last_name: ' Name ',
        reason_not_signed_up: '  ',
        connected_user_id: 'new-user',
      } as never,
    });
    expect(complete.mutate.group_offline_member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'New',
        last_name: 'Name',
        reason_not_signed_up: null,
        connected_user_id: 'new-user',
      })
    );

    const explicitNull = createTx();
    explicitNull.run.mockResolvedValueOnce({
      id: 'offline',
      group_id: 'group',
      connected_user_id: 'old',
    });
    await mutators.updateOfflineMember.fn({
      tx: explicitNull,
      ctx,
      args: { id: 'offline', connected_user_id: null } as never,
    });
    expect(explicitNull.mutate.group_offline_member.update).toHaveBeenCalledWith(
      expect.objectContaining({ connected_user_id: null })
    );
  });

  it('deletes and deduplicates imported offline members', async () => {
    const deleted = createTx();
    deleted.run.mockResolvedValueOnce({ id: 'offline', group_id: 'group' });
    await mutators.deleteOfflineMember.fn({ tx: deleted, ctx, args: { id: 'offline' } });
    expect(deleted.mutate.group_offline_member.delete).toHaveBeenCalledWith({ id: 'offline' });

    const imported = createTx();
    imported.run
      .mockResolvedValueOnce([
        { first_name: 'Existing', last_name: 'Person', reason_not_signed_up: null },
        { first_name: 'Reason', last_name: 'Person', reason_not_signed_up: 'WHY' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await mutators.importOfflineMembers.fn({
      tx: imported,
      ctx,
      args: {
        group_id: 'group',
        entries: [
          { first_name: ' existing ', last_name: ' person ', reason_not_signed_up: null },
          { first_name: 'New', last_name: 'Person', reason_not_signed_up: null },
          { first_name: 'New', last_name: 'Person', reason_not_signed_up: null },
          { first_name: 'Other', last_name: 'Person', reason_not_signed_up: ' Reason ' },
        ],
      } as never,
    });
    expect(imported.mutate.group_offline_member.insert).toHaveBeenCalledTimes(2);
    expect(mocks.ensureOffline).toHaveBeenCalledTimes(2);
  });
});

describe('shared membership and guest-access mutators', () => {
  it('joins with inferred or explicit roles', async () => {
    const inferredNone = createTx();
    inferredNone.run.mockResolvedValueOnce([]);
    await mutators.joinGroup.fn({ tx: inferredNone, ctx, args: membershipArgs() });
    expect(inferredNone.mutate.group_membership.insert).toHaveBeenCalled();

    const explicit = createTx();
    explicit.run
      .mockResolvedValueOnce({
        id: 'role',
        assignee_kind: 'member',
        group_id: 'group',
        scope: 'group',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await mutators.joinGroup.fn({
      tx: explicit,
      ctx,
      args: membershipArgs({ initial_role_id: 'role' }),
    });
    expect(explicit.mutate.group_membership_role.insert).toHaveBeenCalledOnce();
  });

  it('validates guest access requests and all existing-access states', async () => {
    mocks.group = null;
    await expect(
      mutators.requestGuestAccess.fn({ tx: createTx(), ctx, args: guestArgs() })
    ).rejects.toThrow('Group not found');
    mocks.group = { group_type: 'base' };
    await expect(
      mutators.requestGuestAccess.fn({ tx: createTx(), ctx, args: guestArgs() })
    ).rejects.toThrow('official memberships');
    mocks.group = { group_type: 'sibling', primary_sibling_membership_mode: 'all_members' };

    const official = createTx();
    official.run.mockResolvedValueOnce({ id: 'membership' });
    await expect(
      mutators.requestGuestAccess.fn({ tx: official, ctx, args: guestArgs() })
    ).rejects.toThrow('membership record');

    const active = createTx();
    active.run
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'existing', status: 'active' });
    await expect(
      mutators.requestGuestAccess.fn({ tx: active, ctx, args: guestArgs() })
    ).rejects.toThrow('already have guest access');

    const pendingNoRole = createTx();
    pendingNoRole.run
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'existing', status: 'revoked' });
    await mutators.requestGuestAccess.fn({ tx: pendingNoRole, ctx, args: guestArgs() });
    expect(pendingNoRole.mutate.group_guest_access.update).toHaveBeenCalled();
    expect(pendingNoRole.mutate.group_guest_role.insert).not.toHaveBeenCalled();

    const pendingRole = createTx();
    pendingRole.run
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing', status: 'requested' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await mutators.requestGuestAccess.fn({
      tx: pendingRole,
      ctx,
      args: guestArgs({ role_ids: ['guest-role'] }),
    });
    expect(pendingRole.mutate.group_guest_role.insert).toHaveBeenCalledOnce();

    const createdNoRole = createTx();
    createdNoRole.run
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await mutators.requestGuestAccess.fn({ tx: createdNoRole, ctx, args: guestArgs() });
    expect(createdNoRole.mutate.group_guest_access.insert).toHaveBeenCalled();

    const createdRole = createTx();
    createdRole.run
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await mutators.requestGuestAccess.fn({
      tx: createdRole,
      ctx,
      args: guestArgs({ role_ids: ['guest-role'] }),
    });
    expect(createdRole.mutate.group_guest_role.insert).toHaveBeenCalledOnce();
  });

  it('guards tutorial, automatic, self, and managed membership leaves', async () => {
    const tutorial = createTx();
    tutorial.run
      .mockResolvedValueOnce({
        id: 'membership',
        status: 'requested',
        user_id: 'actor',
        group_id: 'group',
        source: 'direct',
      })
      .mockResolvedValueOnce({ tutorial_run_id: 'tutorial' });
    await mutators.leaveGroup.fn({ tx: tutorial, ctx, args: { id: 'membership' } });
    expect(tutorial.mutate.group_membership.delete).not.toHaveBeenCalled();

    const requestedNormal = createTx();
    requestedNormal.run
      .mockResolvedValueOnce({
        id: 'membership',
        status: 'requested',
        user_id: 'actor',
        group_id: 'group',
        source: 'direct',
      })
      .mockResolvedValueOnce({ tutorial_run_id: null });
    await mutators.leaveGroup.fn({ tx: requestedNormal, ctx, args: { id: 'membership' } });
    expect(requestedNormal.mutate.group_membership.delete).toHaveBeenCalled();

    const automatic = createTx();
    automatic.run.mockResolvedValueOnce({
      user_id: 'actor',
      group_id: 'group',
      source: 'hierarchy',
    });
    await expect(
      mutators.leaveGroup.fn({ tx: automatic, ctx, args: { id: 'membership' } })
    ).rejects.toThrow('direct memberships');

    const managed = createTx();
    managed.run.mockResolvedValueOnce({ user_id: 'other', group_id: 'group', source: 'direct' });
    await mutators.leaveGroup.fn({ tx: managed, ctx, args: { id: 'membership' } });
    expect(mocks.can).toHaveBeenCalled();

    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await mutators.leaveGroup.fn({ tx: missing, ctx, args: { id: 'membership' } });
    expect(missing.mutate.group_membership.delete).toHaveBeenCalled();
  });

  it('invites members with required users and optional roles', async () => {
    await expect(
      mutators.inviteMember.fn({
        tx: createTx(),
        ctx,
        args: membershipArgs({ user_id: null }),
      })
    ).rejects.toThrow('user_id');

    const noRole = createTx();
    noRole.run.mockResolvedValueOnce([]);
    await mutators.inviteMember.fn({ tx: noRole, ctx, args: membershipArgs() });
    expect(noRole.mutate.group_membership.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'invited' })
    );

    const role = createTx();
    role.run
      .mockResolvedValueOnce({
        id: 'role',
        assignee_kind: 'member',
        group_id: 'group',
        scope: 'group',
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await mutators.inviteMember.fn({
      tx: role,
      ctx,
      args: membershipArgs({ initial_role_id: 'role' }),
    });
    expect(role.mutate.group_membership_role.insert).toHaveBeenCalledOnce();
  });

  it('accepts only existing manual invitations with self/admin parity', async () => {
    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await expect(
      mutators.acceptInvitation.fn({ tx: missing, ctx, args: { id: 'membership' } })
    ).rejects.toThrow('Membership not found');
    const automatic = createTx();
    automatic.run.mockResolvedValueOnce({
      user_id: 'actor',
      group_id: 'group',
      source: 'hierarchy',
    });
    await expect(
      mutators.acceptInvitation.fn({ tx: automatic, ctx, args: { id: 'membership' } })
    ).rejects.toThrow('Automatic');
    const self = createTx();
    self.run.mockResolvedValueOnce({ user_id: 'actor', group_id: 'group', source: 'direct' });
    await mutators.acceptInvitation.fn({ tx: self, ctx, args: { id: 'membership' } });
    const admin = createTx();
    admin.run.mockResolvedValueOnce({ user_id: 'other', group_id: 'group', source: 'direct' });
    await mutators.acceptInvitation.fn({ tx: admin, ctx, args: { id: 'membership' } });
    expect(admin.mutate.group_membership.update).toHaveBeenCalledWith({
      id: 'membership',
      status: 'active',
    });
  });

  it('updates only existing direct memberships and skips id-only patches', async () => {
    const missing = createTx();
    missing.run.mockResolvedValueOnce(null);
    await expect(
      mutators.updateMembership.fn({ tx: missing, ctx, args: { id: 'membership' } })
    ).rejects.toThrow('Membership not found');
    const automatic = createTx();
    automatic.run.mockResolvedValueOnce({ source: 'hierarchy', group_id: 'group' });
    await expect(
      mutators.updateMembership.fn({ tx: automatic, ctx, args: { id: 'membership' } })
    ).rejects.toThrow('direct memberships');
    const noPatch = createTx();
    noPatch.run.mockResolvedValueOnce({ source: 'direct', group_id: 'group' });
    await mutators.updateMembership.fn({ tx: noPatch, ctx, args: { id: 'membership' } });
    expect(noPatch.mutate.group_membership.update).not.toHaveBeenCalled();
    const patched = createTx();
    patched.run.mockResolvedValueOnce({ source: 'direct', group_id: 'group' });
    await mutators.updateMembership.fn({
      tx: patched,
      ctx,
      args: { id: 'membership', status: 'active' } as never,
    });
    expect(patched.mutate.group_membership.update).toHaveBeenCalled();
  });
});

describe('shared guest invitation and role-link mutators', () => {
  it('requires guest roles and updates or creates guest invitations', async () => {
    await expect(
      mutators.inviteGuest.fn({ tx: createTx(), ctx, args: guestArgs({ role_ids: undefined }) })
    ).rejects.toThrow('at least one');
    await expect(
      mutators.inviteGuest.fn({ tx: createTx(), ctx, args: guestArgs({ role_ids: ['', ''] }) })
    ).rejects.toThrow('at least one');

    const existing = createTx();
    existing.run
      .mockResolvedValueOnce({
        id: 'guest-role',
        group_id: 'group',
        scope: 'group',
        assignee_kind: 'guest',
      })
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await mutators.inviteGuest.fn({
      tx: existing,
      ctx,
      args: guestArgs({ role_ids: ['guest-role', 'guest-role'] }),
    });
    expect(existing.mutate.group_guest_access.update).toHaveBeenCalled();

    const created = createTx();
    created.run
      .mockResolvedValueOnce({
        id: 'guest-role',
        group_id: 'group',
        scope: 'group',
        assignee_kind: 'guest',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await mutators.inviteGuest.fn({
      tx: created,
      ctx,
      args: guestArgs({ role_ids: ['guest-role'] }),
    });
    expect(created.mutate.group_guest_access.insert).toHaveBeenCalled();
  });

  it('accepts and revokes guest access with self/admin parity', async () => {
    for (const method of [mutators.acceptGuestInvitation, mutators.revokeGuestAccess]) {
      const missing = createTx();
      missing.run.mockResolvedValueOnce(null);
      await expect(method.fn({ tx: missing, ctx, args: { id: 'guest' } })).rejects.toThrow(
        'Guest access not found'
      );
      const self = createTx();
      self.run.mockResolvedValueOnce({ id: 'guest', user_id: 'actor', group_id: 'group' });
      await method.fn({ tx: self, ctx, args: { id: 'guest' } });
      const admin = createTx();
      admin.run.mockResolvedValueOnce({ id: 'guest', user_id: 'other', group_id: 'group' });
      await method.fn({ tx: admin, ctx, args: { id: 'guest' } });
      expect(admin.mutate.group_guest_access.update).toHaveBeenCalled();
    }
  });

  it('runs membership/offline/guest role wrapper mutators', async () => {
    const cases = [
      {
        method: mutators.addMembershipRole,
        args: { group_membership_id: 'owner', role_id: 'role' },
        rows: [
          { id: 'owner', group_id: 'group' },
          { id: 'role', assignee_kind: 'member', group_id: 'group', scope: 'group' },
          null,
        ],
      },
      {
        method: mutators.removeMembershipRole,
        args: { group_membership_id: 'owner', role_id: 'role' },
        rows: [{ id: 'owner', group_id: 'group' }, []],
      },
      {
        method: mutators.syncMembershipRoles,
        args: { group_membership_id: 'owner', role_ids: [] },
        rows: [{ id: 'owner', group_id: 'group' }, []],
      },
      {
        method: mutators.addOfflineMembershipRole,
        args: { group_offline_membership_id: 'owner', role_id: 'role' },
        rows: [
          { id: 'owner', group_id: 'group' },
          { id: 'role', assignee_kind: 'member', group_id: 'group', scope: 'group' },
          null,
        ],
      },
      {
        method: mutators.removeOfflineMembershipRole,
        args: { group_offline_membership_id: 'owner', role_id: 'role' },
        rows: [{ id: 'owner', group_id: 'group' }, []],
      },
      {
        method: mutators.syncOfflineMembershipRoles,
        args: { group_offline_membership_id: 'owner', role_ids: [] },
        rows: [{ id: 'owner', group_id: 'group' }, []],
      },
      {
        method: mutators.addGuestRole,
        args: { group_guest_access_id: 'owner', role_id: 'role' },
        rows: [
          { id: 'owner', group_id: 'group' },
          { id: 'role', assignee_kind: 'guest', group_id: 'group', scope: 'group' },
          null,
        ],
      },
      {
        method: mutators.removeGuestRole,
        args: { group_guest_access_id: 'owner', role_id: 'role' },
        rows: [{ id: 'owner', group_id: 'group' }, []],
      },
    ];
    for (const item of cases) {
      const tx = createTx();
      for (const row of item.rows) tx.run.mockResolvedValueOnce(row);
      await item.method.fn({ tx, ctx, args: item.args as never });
    }

    const emptyGuestSync = createTx();
    emptyGuestSync.run.mockResolvedValueOnce({ id: 'guest', group_id: 'group' });
    await expect(
      mutators.syncGuestRoles.fn({
        tx: emptyGuestSync,
        ctx,
        args: { group_guest_access_id: 'guest', role_ids: [] },
      })
    ).rejects.toThrow('at least one');
    const guestSync = createTx();
    guestSync.run
      .mockResolvedValueOnce({ id: 'guest', group_id: 'group' })
      .mockResolvedValueOnce({
        id: 'role',
        assignee_kind: 'guest',
        group_id: 'group',
        scope: 'group',
      })
      .mockResolvedValueOnce([{ id: 'keep', role_id: 'role' }]);
    await mutators.syncGuestRoles.fn({
      tx: guestSync,
      ctx,
      args: { group_guest_access_id: 'guest', role_ids: ['role'] },
    });
  });
});

describe('shared role, right, and holder-history mutators', () => {
  it('creates roles with every default and explicit persistence field', async () => {
    const defaults = createTx();
    await mutators.createRole.fn({
      tx: defaults,
      ctx,
      args: { id: 'role', name: 'Role', scope: 'event', event_id: 'event' } as never,
    });
    expect(defaults.mutate.role.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment_mode: 'assigned',
        visibility: 'public',
        term_start_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        recurrence_rule: null,
        recurrence_interval: null,
        recurrence_days: null,
        recurrence_end_date: null,
        scheduled_revote_date: null,
        default_request_role: false,
        default_invite_role: false,
        assignee_kind: 'member',
        sort_order: 0,
      })
    );

    mocks.group = { group_type: 'base' };
    const explicit = createTx();
    explicit.run.mockResolvedValueOnce([]);
    await mutators.createRole.fn({
      tx: explicit,
      ctx,
      args: {
        id: 'role',
        name: 'Role',
        scope: 'group',
        group_id: 'group',
        assignment_mode: 'elected',
        visibility: 'private',
        term_start_date: 1,
        is_recurring: true,
        recurrence_pattern: 'monthly',
        recurrence_rule: 'rule',
        recurrence_interval: 2,
        recurrence_days: [1],
        recurrence_end_date: 3,
        scheduled_revote_date: 4,
        default_request_role: true,
        default_invite_role: true,
        assignee_kind: 'member',
        sort_order: 5,
      } as never,
    });
    expect(explicit.mutate.role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assignment_mode: 'elected', is_recurring: true, sort_order: 5 })
    );
  });

  it('updates and deletes absent or scoped roles', async () => {
    const absentUpdate = createTx();
    absentUpdate.run.mockResolvedValueOnce(null);
    await mutators.updateRole.fn({ tx: absentUpdate, ctx, args: { id: 'role' } as never });
    const absentDelete = createTx();
    absentDelete.run.mockResolvedValueOnce(null);
    await mutators.deleteRole.fn({ tx: absentDelete, ctx, args: { id: 'role' } });

    mocks.group = { group_type: 'base' };
    const groupRole = createTx();
    groupRole.run
      .mockResolvedValueOnce({
        id: 'role',
        group_id: 'group',
        assignee_kind: 'member',
        default_request_role: false,
        default_invite_role: false,
      })
      .mockResolvedValueOnce([]);
    await mutators.updateRole
      .fn({
        tx: groupRole,
        ctx,
        args: {
          id: 'role',
          assignee_kind: 'guest',
          default_request_role: true,
          default_invite_role: true,
        } as never,
      })
      .catch(() => undefined);

    const compatibleGroupRole = createTx();
    compatibleGroupRole.run.mockResolvedValueOnce({
      id: 'role',
      group_id: 'group',
      assignee_kind: 'member',
      default_request_role: false,
      default_invite_role: false,
    });
    await mutators.updateRole.fn({
      tx: compatibleGroupRole,
      ctx,
      args: { id: 'role', assignee_kind: 'member' } as never,
    });

    const eventRole = createTx();
    eventRole.run.mockResolvedValueOnce({ id: 'role', event_id: 'event' });
    await mutators.updateRole.fn({ tx: eventRole, ctx, args: { id: 'role' } as never });
    const deleted = createTx();
    deleted.run.mockResolvedValueOnce({ id: 'role', blog_id: 'blog' });
    await mutators.deleteRole.fn({ tx: deleted, ctx, args: { id: 'role' } });
  });

  it('validates amendment and guest-event action rights', async () => {
    await expect(
      mutators.assignActionRight.fn({
        tx: createTx(),
        ctx,
        args: {
          id: 'right',
          role_id: 'role',
          amendment_id: 'amendment',
          resource: 'invalid',
          action: 'invalid',
        } as never,
      })
    ).rejects.toThrow('not valid');

    const mismatchMissing = createTx();
    mismatchMissing.run.mockResolvedValueOnce(null);
    await expect(
      mutators.assignActionRight.fn({
        tx: mismatchMissing,
        ctx,
        args: {
          id: 'right',
          role_id: 'role',
          amendment_id: 'amendment',
          resource: 'amendments',
          action: 'view',
        } as never,
      })
    ).rejects.toThrow('scope');

    const mismatch = createTx();
    mismatch.run.mockResolvedValueOnce({ id: 'role', amendment_id: 'other' });
    await expect(
      mutators.assignActionRight.fn({
        tx: mismatch,
        ctx,
        args: {
          id: 'right',
          role_id: 'role',
          amendment_id: 'amendment',
          resource: 'amendments',
          action: 'view',
        } as never,
      })
    ).rejects.toThrow('scope');

    for (const action of ['active_voting', 'passive_voting']) {
      const guestVote = createTx();
      guestVote.run.mockResolvedValueOnce({
        id: 'role',
        event_id: 'event',
        assignee_kind: 'guest',
      });
      await expect(
        mutators.assignActionRight.fn({
          tx: guestVote,
          ctx,
          args: {
            id: 'right',
            role_id: 'role',
            event_id: 'event',
            resource: 'events',
            action,
          } as never,
        })
      ).rejects.toThrow('Guest event roles');
    }

    const allowed = createTx();
    allowed.run.mockResolvedValueOnce({ id: 'role', event_id: 'event', assignee_kind: 'member' });
    await mutators.assignActionRight.fn({
      tx: allowed,
      ctx,
      args: {
        id: 'right',
        role_id: 'role',
        event_id: 'event',
        resource: 'events',
        action: 'read',
      } as never,
    });
    expect(allowed.mutate.action_right.insert).toHaveBeenCalled();
  });

  it('removes rights and creates/updates holder history with authorization parity', async () => {
    const absent = createTx();
    absent.run.mockResolvedValueOnce(null);
    await mutators.removeActionRight.fn({ tx: absent, ctx, args: { id: 'right' } });
    const present = createTx();
    present.run.mockResolvedValueOnce({ id: 'right', group_id: 'group' });
    await mutators.removeActionRight.fn({ tx: present, ctx, args: { id: 'right' } });

    const clientCreate = createTx('client');
    await mutators.createRoleHolderHistory.fn({
      tx: clientCreate,
      ctx,
      args: { id: 'history', role_id: 'role' } as never,
    });
    const clientUpdate = createTx('client');
    await mutators.updateRoleHolderHistory.fn({
      tx: clientUpdate,
      ctx,
      args: { id: 'history', end_date: 1 } as never,
    });
    expect(clientCreate.mutate.role_holder_history.insert).toHaveBeenCalled();
    expect(clientUpdate.mutate.role_holder_history.update).toHaveBeenCalled();
  });
});
