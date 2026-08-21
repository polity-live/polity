import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  can: vi.fn(async () => undefined),
  requireAuthenticated: vi.fn(),
}));

vi.mock('../../rbac/can', () => ({ can: mocks.can }));
vi.mock('../../rbac/authorize', () => ({ requireAuthenticated: mocks.requireAuthenticated }));

import {
  eventSharedMutatorInternals as helpers,
  eventSharedMutators as mutators,
} from '../shared-mutators';

function mutationTable() {
  return {
    insert: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
}

function createTx(location: 'client' | 'server' = 'server') {
  return {
    clientID: 'client',
    mutationID: 1,
    reason: 'coverage',
    location,
    run: vi.fn(),
    mutate: {
      event: mutationTable(),
      event_participant: mutationTable(),
      event_participant_role: mutationTable(),
      event_offline_participant: mutationTable(),
      event_exception: mutationTable(),
      role: mutationTable(),
      action_right: mutationTable(),
    },
  } as any;
}

const ctx = { userID: 'actor', email: 'actor@example.test' } as never;

function eventArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event',
    title: 'Event',
    visibility: 'public',
    status: 'scheduled',
    event_type: 'meeting',
    location_type: 'physical',
    ...overrides,
  } as never;
}

function participantArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'participant',
    event_id: 'event',
    user_id: 'invitee',
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  let uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`
  );
  vi.spyOn(Date, 'now').mockReturnValue(1234);
});

describe('shared event policy helpers', () => {
  it('normalizes event modes, names, and reasons', () => {
    expect(helpers.isAssemblyEventType('general_assembly')).toBe(true);
    expect(helpers.isAssemblyEventType('delegate_assembly')).toBe(true);
    expect(helpers.isAssemblyEventType(null)).toBe(false);
    expect(helpers.resolveAttendanceMode({ attendance_mode: 'online' })).toBe('online');
    expect(helpers.resolveAttendanceMode({ attendance_mode: 'hybrid' })).toBe('hybrid');
    expect(helpers.resolveAttendanceMode({ location_type: 'online' })).toBe('online');
    expect(helpers.resolveAttendanceMode({ location_type: 'physical' })).toBe('offline');
    expect(helpers.normalizeRequiredName(' Name ')).toBe('Name');
    expect(() => helpers.normalizeRequiredName('  ')).toThrow('required');
    expect(helpers.normalizeOptionalReason(' Reason ')).toBe('Reason');
    expect(helpers.normalizeOptionalReason('  ')).toBeNull();
    expect(helpers.normalizeOptionalReason(undefined)).toBeNull();
  });

  it('loads and authorizes participants and offline participants', async () => {
    const missingParticipant = createTx();
    missingParticipant.run.mockResolvedValueOnce(null);
    await expect(
      helpers.loadParticipantForRoleMutation(missingParticipant, ctx, 'missing')
    ).rejects.toThrow('Participant not found');

    const participant = createTx();
    participant.run.mockResolvedValueOnce({ id: 'participant', event_id: 'event' });
    await expect(
      helpers.loadParticipantForRoleMutation(participant, ctx, 'participant')
    ).resolves.toMatchObject({ id: 'participant' });

    const missingEvent = createTx();
    missingEvent.run.mockResolvedValueOnce(null);
    await expect(
      helpers.assertCanManageEventOfflineParticipants(missingEvent, ctx, 'event')
    ).rejects.toThrow('Event not found');

    const online = createTx();
    online.run.mockResolvedValueOnce({ id: 'event', attendance_mode: 'online' });
    await expect(
      helpers.assertCanManageEventOfflineParticipants(online, ctx, 'event')
    ).rejects.toThrow('Online-only');

    const physical = createTx();
    physical.run.mockResolvedValueOnce({ id: 'event', location_type: 'physical' });
    await expect(
      helpers.assertCanManageEventOfflineParticipants(physical, ctx, 'event')
    ).resolves.toMatchObject({ id: 'event' });

    const missingOffline = createTx();
    missingOffline.run.mockResolvedValueOnce(null);
    await expect(
      helpers.loadOfflineParticipantForMutation(missingOffline, ctx, 'offline')
    ).rejects.toThrow('Offline participant not found');

    const loadedOffline = createTx();
    loadedOffline.run
      .mockResolvedValueOnce({ id: 'offline', event_id: 'event' })
      .mockResolvedValueOnce({ id: 'event', attendance_mode: 'hybrid' });
    await expect(
      helpers.loadOfflineParticipantForMutation(loadedOffline, ctx, 'offline')
    ).resolves.toMatchObject({ offlineParticipant: { id: 'offline' } });
  });

  it('detects connected-user conflicts and manages participant role links', async () => {
    const noUser = createTx();
    await helpers.assertUniqueConnectedOfflineUserWithinEvent(noUser, {
      eventId: 'event',
      connectedUserId: null,
    });
    expect(noUser.run).not.toHaveBeenCalled();

    const unique = createTx();
    unique.run.mockResolvedValueOnce([{ id: 'self' }]);
    await helpers.assertUniqueConnectedOfflineUserWithinEvent(unique, {
      eventId: 'event',
      connectedUserId: 'user',
      excludeOfflineParticipantId: 'self',
    });

    const conflict = createTx();
    conflict.run.mockResolvedValueOnce([{ id: 'other' }]);
    await expect(
      helpers.assertUniqueConnectedOfflineUserWithinEvent(conflict, {
        eventId: 'event',
        connectedUserId: 'user',
      })
    ).rejects.toThrow('already connected');

    const existing = createTx();
    existing.run.mockResolvedValueOnce({ id: 'link' });
    await expect(
      helpers.addEventParticipantRole(existing, {
        event_participant_id: 'participant',
        role_id: 'role',
      })
    ).resolves.toBe('link');

    const inserted = createTx();
    inserted.run.mockResolvedValueOnce(null);
    await expect(
      helpers.addEventParticipantRole(inserted, {
        event_participant_id: 'participant',
        role_id: 'role',
        assigned_by_id: 'actor',
      })
    ).resolves.toBe('uuid-1');
    expect(inserted.mutate.event_participant_role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_by_id: 'actor' })
    );

    const removed = createTx();
    removed.run.mockResolvedValueOnce([{ id: 'one' }, { id: 'two' }]);
    await helpers.removeEventParticipantRole(removed, {
      event_participant_id: 'participant',
      role_id: 'role',
    });
    expect(removed.mutate.event_participant_role.delete).toHaveBeenCalledTimes(2);

    const synced = createTx();
    synced.run
      .mockResolvedValueOnce([
        { id: 'keep-link', role_id: 'keep' },
        { id: 'remove-link', role_id: 'remove' },
      ])
      .mockResolvedValueOnce(null);
    await helpers.syncEventParticipantRoles(synced, {
      event_participant_id: 'participant',
      role_ids: ['keep', '', 'add', 'add'],
    });
    expect(synced.mutate.event_participant_role.delete).toHaveBeenCalledWith({ id: 'remove-link' });
    expect(synced.mutate.event_participant_role.insert).toHaveBeenCalledOnce();
  });

  it('resolves default roles for regular and assembly events', async () => {
    const irrelevant = createTx();
    await expect(
      helpers.resolveDefaultEventParticipantRoleId(irrelevant, 'event', 'active', 'explicit')
    ).resolves.toBeNull();

    const regularExplicit = createTx();
    regularExplicit.run.mockResolvedValueOnce({ event_type: 'meeting' });
    await expect(
      helpers.resolveDefaultEventParticipantRoleId(
        regularExplicit,
        'event',
        'requested',
        'explicit'
      )
    ).resolves.toBe('explicit');

    const assemblyExplicit = createTx();
    assemblyExplicit.run
      .mockResolvedValueOnce({ event_type: 'general_assembly' })
      .mockResolvedValueOnce({ id: 'guest', event_id: 'event', assignee_kind: 'guest' });
    await expect(
      helpers.resolveDefaultEventParticipantRoleId(assemblyExplicit, 'event', 'invited', 'guest')
    ).resolves.toBe('guest');

    for (const invalidRole of [
      null,
      { id: 'role', event_id: 'other', assignee_kind: 'guest' },
      { id: 'role', event_id: 'event', assignee_kind: 'member' },
    ]) {
      const invalid = createTx();
      invalid.run
        .mockResolvedValueOnce({ event_type: 'delegate_assembly' })
        .mockResolvedValueOnce(invalidRole);
      await expect(
        helpers.resolveDefaultEventParticipantRoleId(invalid, 'event', 'requested', 'role')
      ).rejects.toThrow('guest roles');
    }

    const requested = createTx();
    requested.run
      .mockResolvedValueOnce({ event_type: 'meeting' })
      .mockResolvedValueOnce([{ id: 'request', default_request_role: true }]);
    await expect(
      helpers.resolveDefaultEventParticipantRoleId(requested, 'event', 'requested')
    ).resolves.toBe('request');

    const invited = createTx();
    invited.run
      .mockResolvedValueOnce({ event_type: 'meeting' })
      .mockResolvedValueOnce([{ id: 'invite', default_invite_role: true }]);
    await expect(
      helpers.resolveDefaultEventParticipantRoleId(invited, 'event', 'invited')
    ).resolves.toBe('invite');

    const guestByName = createTx();
    guestByName.run
      .mockResolvedValueOnce({ event_type: 'general_assembly' })
      .mockResolvedValueOnce([
        { id: 'member', assignee_kind: 'member' },
        { id: 'guest', name: 'Gast', assignee_kind: 'guest' },
      ]);
    await expect(
      helpers.resolveDefaultEventParticipantRoleId(guestByName, 'event', 'requested')
    ).resolves.toBe('guest');

    const guestFirst = createTx();
    guestFirst.run
      .mockResolvedValueOnce({ event_type: 'delegate_assembly' })
      .mockResolvedValueOnce([{ id: 'first', name: 'Other', assignee_kind: 'guest' }]);
    await expect(
      helpers.resolveDefaultEventParticipantRoleId(guestFirst, 'event', 'invited')
    ).resolves.toBe('first');

    const noGuest = createTx();
    noGuest.run
      .mockResolvedValueOnce({ event_type: 'delegate_assembly' })
      .mockResolvedValueOnce([]);
    await expect(
      helpers.resolveDefaultEventParticipantRoleId(noGuest, 'event', 'invited')
    ).resolves.toBeNull();

    const participantByName = createTx();
    participantByName.run
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{ id: 'participant', name: 'Participant' }]);
    await expect(
      helpers.resolveDefaultEventParticipantRoleId(participantByName, 'event', 'invited')
    ).resolves.toBe('participant');

    const regularNone = createTx();
    regularNone.run.mockResolvedValueOnce(null).mockResolvedValueOnce([]);
    await expect(
      helpers.resolveDefaultEventParticipantRoleId(regularNone, 'event', 'requested')
    ).resolves.toBeNull();
  });

  it('clears defaults and validates event role compatibility', async () => {
    const noop = createTx();
    await helpers.clearEventRoleDefaults(noop, { eventId: 'event' });
    expect(noop.run).not.toHaveBeenCalled();

    const cleared = createTx();
    cleared.run.mockResolvedValueOnce([
      { id: 'keep', default_request_role: true, default_invite_role: true },
      { id: 'request', default_request_role: true, default_invite_role: false },
      { id: 'invite', default_request_role: false, default_invite_role: true },
      { id: 'none', default_request_role: false, default_invite_role: false },
    ]);
    await helpers.clearEventRoleDefaults(cleared, {
      eventId: 'event',
      keepRoleId: 'keep',
      clearRequestDefault: true,
      clearInviteDefault: true,
    });
    expect(cleared.mutate.role.update).toHaveBeenCalledTimes(2);

    const noDefaults = createTx();
    await helpers.assertValidEventRoleDefaults(noDefaults, {
      eventId: 'event',
      assigneeKind: 'member',
      defaultRequestRole: false,
      defaultInviteRole: false,
    });

    const assemblyMember = createTx();
    assemblyMember.run.mockResolvedValueOnce({ event_type: 'general_assembly' });
    await expect(
      helpers.assertValidEventRoleDefaults(assemblyMember, {
        eventId: 'event',
        assigneeKind: 'member',
        defaultRequestRole: true,
        defaultInviteRole: false,
      })
    ).rejects.toThrow('guest roles');

    const regularGuest = createTx();
    regularGuest.run.mockResolvedValueOnce({ event_type: 'meeting' });
    await expect(
      helpers.assertValidEventRoleDefaults(regularGuest, {
        eventId: 'event',
        assigneeKind: 'guest',
        defaultRequestRole: false,
        defaultInviteRole: true,
      })
    ).rejects.toThrow('only be used');

    const allowed = createTx();
    allowed.run.mockResolvedValueOnce({ event_type: 'delegate_assembly' });
    await expect(
      helpers.assertValidEventRoleDefaults(allowed, {
        eventId: 'event',
        assigneeKind: 'guest',
        defaultRequestRole: true,
        defaultInviteRole: true,
      })
    ).resolves.toBeUndefined();
  });
});

describe('shared event CRUD and offline roster mutators', () => {
  it('creates full events, updates attendance, and cancels', async () => {
    for (const args of [
      eventArgs(),
      eventArgs({ visibility: undefined }),
      eventArgs({ group_id: 'group', attendance_mode: 'online' }),
      eventArgs({
        attendance_mode: 'hybrid',
        change_request_vote_order: 'newest_first',
        gender_quota_enabled: true,
        accreditation_required: true,
      }),
    ]) {
      const tx = createTx();
      await mutators.create.fn({ tx, ctx, args });
      expect(tx.mutate.event.insert).toHaveBeenCalledOnce();
      expect(tx.mutate.event_participant.insert).toHaveBeenCalledOnce();
    }

    const full = createTx();
    await mutators.createFull.fn({ tx: full, ctx, args: { event: eventArgs() } as never });
    expect(full.mutate.event.insert).toHaveBeenCalledOnce();

    const unchanged = createTx();
    unchanged.run.mockResolvedValueOnce({ delegate_election_mode: 'users' });
    await mutators.update.fn({ tx: unchanged, ctx, args: { id: 'event' } as never });
    expect(unchanged.mutate.event.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ attendance_mode: expect.anything() })
    );

    const attendance = createTx();
    attendance.run.mockResolvedValueOnce({ attendance_mode: 'offline', location_type: 'physical' });
    await mutators.update.fn({
      tx: attendance,
      ctx,
      args: { id: 'event', attendance_mode: 'online' } as never,
    });
    expect(attendance.mutate.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ attendance_mode: 'online' })
    );

    const location = createTx();
    location.run.mockResolvedValueOnce({ attendance_mode: null, location_type: 'physical' });
    await mutators.update.fn({
      tx: location,
      ctx,
      args: { id: 'event', location_type: 'online' } as never,
    });
    expect(location.mutate.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ attendance_mode: 'online' })
    );

    const cancelled = createTx();
    await mutators.cancel.fn({
      tx: cancelled,
      ctx,
      args: { id: 'event', cancel_reason: 'Reason' } as never,
    });
    expect(cancelled.mutate.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', cancelled_by_id: 'actor' })
    );
  });

  it('creates, updates, and deletes offline participants with policy checks', async () => {
    const inherited = createTx();
    inherited.run.mockResolvedValueOnce({ id: 'event', attendance_mode: 'offline' });
    await expect(
      mutators.createOfflineParticipant.fn({
        tx: inherited,
        ctx,
        args: { id: 'offline', event_id: 'event', source_type: 'group_member' } as never,
      })
    ).rejects.toThrow('managed automatically');

    const conflict = createTx();
    conflict.run
      .mockResolvedValueOnce({ id: 'event', attendance_mode: 'hybrid' })
      .mockResolvedValueOnce([{ id: 'other' }]);
    await expect(
      mutators.createOfflineParticipant.fn({
        tx: conflict,
        ctx,
        args: {
          id: 'offline',
          event_id: 'event',
          source_type: 'event_extra',
          first_name: 'A',
          last_name: 'B',
          connected_user_id: 'user',
        } as never,
      })
    ).rejects.toThrow('already connected');

    const offline = createTx();
    offline.run.mockResolvedValueOnce({ id: 'event', attendance_mode: 'offline' });
    await mutators.createOfflineParticipant.fn({
      tx: offline,
      ctx,
      args: {
        id: 'offline',
        event_id: 'event',
        source_type: 'event_extra',
        first_name: ' First ',
        last_name: ' Last ',
      } as never,
    });
    expect(offline.mutate.event_offline_participant.insert).toHaveBeenCalledWith(
      expect.objectContaining({ participation_channel: 'offline', reason_not_signed_up: null })
    );

    const hybrid = createTx();
    hybrid.run
      .mockResolvedValueOnce({ id: 'event', attendance_mode: 'hybrid' })
      .mockResolvedValueOnce([]);
    await mutators.createOfflineParticipant.fn({
      tx: hybrid,
      ctx,
      args: {
        id: 'offline',
        event_id: 'event',
        source_type: 'event_extra',
        first_name: 'First',
        last_name: 'Last',
        reason_not_signed_up: ' Reason ',
        connected_user_id: 'user',
        participation_channel: 'online',
        attendance_status: 'present',
      } as never,
    });
    expect(hybrid.mutate.event_offline_participant.insert).toHaveBeenCalledWith(
      expect.objectContaining({ participation_channel: 'online', reason_not_signed_up: 'Reason' })
    );

    const hybridDefault = createTx();
    hybridDefault.run.mockResolvedValueOnce({ id: 'event', attendance_mode: 'hybrid' });
    await mutators.createOfflineParticipant.fn({
      tx: hybridDefault,
      ctx,
      args: {
        id: 'offline-default',
        event_id: 'event',
        source_type: 'event_extra',
        first_name: 'First',
        last_name: 'Last',
        connected_user_id: undefined,
      } as never,
    });

    for (const changedField of ['first_name', 'last_name', 'reason_not_signed_up'] as const) {
      const inheritedUpdate = createTx();
      inheritedUpdate.run
        .mockResolvedValueOnce({ id: 'offline', event_id: 'event', source_type: 'group_member' })
        .mockResolvedValueOnce({ id: 'event', attendance_mode: 'offline' });
      await expect(
        mutators.updateOfflineParticipant.fn({
          tx: inheritedUpdate,
          ctx,
          args: { id: 'offline', [changedField]: 'Changed' } as never,
        })
      ).rejects.toThrow('attendance data');
    }

    const inheritedAttendance = createTx();
    inheritedAttendance.run
      .mockResolvedValueOnce({
        id: 'offline',
        event_id: 'event',
        source_type: 'group_member',
        connected_user_id: null,
        participation_channel: 'offline',
      })
      .mockResolvedValueOnce({ id: 'event', attendance_mode: 'hybrid' });
    await mutators.updateOfflineParticipant.fn({
      tx: inheritedAttendance,
      ctx,
      args: { id: 'offline', attendance_status: 'present' } as never,
    });

    const updated = createTx();
    updated.run
      .mockResolvedValueOnce({
        id: 'offline',
        event_id: 'event',
        source_type: 'event_extra',
        connected_user_id: 'old',
        participation_channel: 'offline',
      })
      .mockResolvedValueOnce({ id: 'event', attendance_mode: 'hybrid' })
      .mockResolvedValueOnce([]);
    await mutators.updateOfflineParticipant.fn({
      tx: updated,
      ctx,
      args: {
        id: 'offline',
        first_name: ' New ',
        last_name: ' Name ',
        reason_not_signed_up: ' ',
        connected_user_id: 'new',
        attendance_status: 'present',
        participation_channel: 'online',
      } as never,
    });
    expect(updated.mutate.event_offline_participant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'New',
        connected_user_id: 'new',
        participation_channel: 'online',
      })
    );

    const explicitNull = createTx();
    explicitNull.run
      .mockResolvedValueOnce({
        id: 'offline',
        event_id: 'event',
        source_type: 'event_extra',
        connected_user_id: 'old',
        participation_channel: 'online',
      })
      .mockResolvedValueOnce({ id: 'event', attendance_mode: 'hybrid' });
    await mutators.updateOfflineParticipant.fn({
      tx: explicitNull,
      ctx,
      args: { id: 'offline', connected_user_id: null } as never,
    });
    expect(explicitNull.mutate.event_offline_participant.update).toHaveBeenCalledWith(
      expect.objectContaining({ connected_user_id: null, participation_channel: 'online' })
    );

    const preserved = createTx();
    preserved.run
      .mockResolvedValueOnce({
        id: 'offline',
        event_id: 'event',
        source_type: 'event_extra',
        connected_user_id: null,
        participation_channel: 'offline',
      })
      .mockResolvedValueOnce({ id: 'event', attendance_mode: 'offline' });
    await mutators.updateOfflineParticipant.fn({
      tx: preserved,
      ctx,
      args: { id: 'offline' } as never,
    });
    expect(preserved.mutate.event_offline_participant.update).toHaveBeenCalledWith(
      expect.objectContaining({ participation_channel: 'offline' })
    );

    const inheritedDelete = createTx();
    inheritedDelete.run
      .mockResolvedValueOnce({ id: 'offline', event_id: 'event', source_type: 'group_member' })
      .mockResolvedValueOnce({ id: 'event', attendance_mode: 'offline' });
    await expect(
      mutators.deleteOfflineParticipant.fn({
        tx: inheritedDelete,
        ctx,
        args: { id: 'offline' },
      })
    ).rejects.toThrow('cannot be deleted');

    const deleted = createTx();
    deleted.run
      .mockResolvedValueOnce({ id: 'offline', event_id: 'event', source_type: 'event_extra' })
      .mockResolvedValueOnce({ id: 'event', attendance_mode: 'offline' });
    await mutators.deleteOfflineParticipant.fn({ tx: deleted, ctx, args: { id: 'offline' } });
    expect(deleted.mutate.event_offline_participant.delete).toHaveBeenCalledWith({ id: 'offline' });
  });

  it('imports distinct offline participants', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce({ id: 'event', attendance_mode: 'hybrid' }).mockResolvedValueOnce([
      {
        source_type: 'event_extra',
        first_name: ' Existing ',
        last_name: ' Person ',
        reason_not_signed_up: null,
      },
      {
        source_type: 'group_member',
        first_name: 'Ignored',
        last_name: 'Member',
        reason_not_signed_up: null,
      },
    ]);
    await mutators.importOfflineParticipants.fn({
      tx,
      ctx,
      args: {
        event_id: 'event',
        entries: [
          { first_name: 'existing', last_name: 'person', reason_not_signed_up: null },
          { first_name: 'New', last_name: 'Person', reason_not_signed_up: ' Reason ' },
          { first_name: ' new ', last_name: ' person ', reason_not_signed_up: 'reason' },
        ],
      } as never,
    });
    expect(tx.mutate.event_offline_participant.insert).toHaveBeenCalledOnce();

    const offline = createTx();
    offline.run
      .mockResolvedValueOnce({ id: 'event', attendance_mode: 'offline' })
      .mockResolvedValueOnce([]);
    await mutators.importOfflineParticipants.fn({
      tx: offline,
      ctx,
      args: { event_id: 'event', entries: [{ first_name: 'One', last_name: 'Person' }] } as never,
    });
  });
});

describe('shared participant, role, exception, and meeting mutators', () => {
  it('joins and invites participants with explicit and default roles', async () => {
    const explicitJoin = createTx();
    explicitJoin.run.mockResolvedValueOnce([]).mockResolvedValueOnce(null);
    await mutators.joinEvent.fn({
      tx: explicitJoin,
      ctx,
      args: participantArgs({
        initial_role_ids: ['', 'role', 'role'],
        status: 'active',
        visibility: 'private',
      }),
    });
    expect(explicitJoin.mutate.event_participant_role.insert).toHaveBeenCalledOnce();

    const defaultJoin = createTx();
    defaultJoin.run
      .mockResolvedValueOnce({ event_type: 'meeting' })
      .mockResolvedValueOnce([{ id: 'participant-role', name: 'Participant' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await mutators.joinEvent.fn({
      tx: defaultJoin,
      ctx,
      args: participantArgs({ user_id: undefined }),
    });
    expect(defaultJoin.mutate.event_participant.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'actor', status: 'requested', visibility: 'public' })
    );

    const noRoleJoin = createTx();
    noRoleJoin.run.mockResolvedValueOnce(null).mockResolvedValueOnce([]);
    await mutators.joinEvent.fn({
      tx: noRoleJoin,
      ctx,
      args: participantArgs({ user_id: undefined, status: 'active' }),
    });
    expect(noRoleJoin.mutate.event_participant_role.insert).not.toHaveBeenCalled();

    const missingInvitee = createTx();
    await expect(
      mutators.inviteParticipant.fn({
        tx: missingInvitee,
        ctx,
        args: participantArgs({ user_id: null }),
      })
    ).rejects.toThrow('user_id is required');

    const explicitInvite = createTx();
    explicitInvite.run.mockResolvedValueOnce([]).mockResolvedValueOnce(null);
    await mutators.inviteParticipant.fn({
      tx: explicitInvite,
      ctx,
      args: participantArgs({ initial_role_ids: ['guest'], visibility: 'private' }),
    });
    expect(explicitInvite.mutate.event_participant_role.insert).toHaveBeenCalledOnce();

    const noRoleInvite = createTx();
    noRoleInvite.run.mockResolvedValueOnce(null).mockResolvedValueOnce([]);
    await mutators.inviteParticipant.fn({ tx: noRoleInvite, ctx, args: participantArgs() });
    expect(noRoleInvite.mutate.event_participant_role.insert).not.toHaveBeenCalled();
  });

  it('leaves, updates, finalizes, and assigns participant roles', async () => {
    const clientLeave = createTx('client');
    await mutators.leaveEvent.fn({ tx: clientLeave, ctx, args: { id: 'participant' } });
    expect(clientLeave.run).not.toHaveBeenCalled();

    const missingLeave = createTx();
    missingLeave.run.mockResolvedValueOnce(null);
    await expect(
      mutators.leaveEvent.fn({ tx: missingLeave, ctx, args: { id: 'participant' } })
    ).rejects.toThrow('Participant not found');

    for (const participant of [
      { id: 'participant', user_id: 'actor', event_id: 'event' },
      { id: 'participant', user_id: 'other', event_id: 'event' },
    ]) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce(participant);
      await mutators.leaveEvent.fn({ tx, ctx, args: { id: 'participant' } });
      expect(tx.mutate.event_participant.delete).toHaveBeenCalledOnce();
    }

    const clientUpdate = createTx('client');
    await mutators.updateParticipant.fn({
      tx: clientUpdate,
      ctx,
      args: { id: 'participant', status: 'active' } as never,
    });
    expect(clientUpdate.mutate.event_participant.update).toHaveBeenCalledOnce();

    const missingUpdate = createTx();
    missingUpdate.run.mockResolvedValueOnce(null);
    await expect(
      mutators.updateParticipant.fn({
        tx: missingUpdate,
        ctx,
        args: { id: 'participant' } as never,
      })
    ).rejects.toThrow('Participant not found');

    for (const participant of [
      { id: 'participant', user_id: 'actor', event_id: 'event' },
      { id: 'participant', user_id: 'other', event_id: 'event' },
    ]) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce(participant);
      await mutators.updateParticipant.fn({ tx, ctx, args: { id: 'participant' } as never });
      expect(tx.mutate.event_participant.update).not.toHaveBeenCalled();
    }

    const finalized = createTx();
    await mutators.finalizeDelegates.fn({ tx: finalized, ctx, args: { eventId: 'event' } });
    expect(finalized.mutate.event.update).toHaveBeenCalledOnce();

    const add = createTx();
    add.run
      .mockResolvedValueOnce({ id: 'participant', event_id: 'event' })
      .mockResolvedValueOnce(null);
    await mutators.addParticipantRole.fn({
      tx: add,
      ctx,
      args: { event_participant_id: 'participant', role_id: 'role' },
    });

    const remove = createTx();
    remove.run
      .mockResolvedValueOnce({ id: 'participant', event_id: 'event' })
      .mockResolvedValueOnce([{ id: 'link' }]);
    await mutators.removeParticipantRole.fn({
      tx: remove,
      ctx,
      args: { event_participant_id: 'participant', role_id: 'role' },
    });

    const sync = createTx();
    sync.run
      .mockResolvedValueOnce({ id: 'participant', event_id: 'event' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);
    await mutators.syncParticipantRoles.fn({
      tx: sync,
      ctx,
      args: { event_participant_id: 'participant', role_ids: ['role'] },
    });
  });

  it('creates, updates, and deletes event roles', async () => {
    const created = createTx();
    created.run
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ event_type: 'meeting' })
      .mockResolvedValueOnce([]);
    await mutators.createRole.fn({
      tx: created,
      ctx,
      args: {
        id: 'role',
        event_id: 'event',
        name: 'Role',
        default_request_role: true,
        assignee_kind: 'member',
      } as never,
    });
    expect(created.mutate.role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 0, scope: 'event' })
    );

    const complete = createTx();
    complete.run.mockResolvedValueOnce([{ id: 'existing' }]);
    await mutators.createRole.fn({
      tx: complete,
      ctx,
      args: {
        id: 'role',
        event_id: 'event',
        name: 'Role',
        description: 'D',
        group_id: 'group',
        amendment_id: 'amendment',
        blog_id: 'blog',
        assignment_mode: 'self',
        visibility: 'private',
        term_start_date: 1,
        is_recurring: true,
        recurrence_pattern: 'weekly',
        recurrence_rule: 'rule',
        recurrence_interval: 2,
        recurrence_days: ['mon'],
        recurrence_end_date: 3,
        scheduled_revote_date: 4,
        default_request_role: false,
        default_invite_role: false,
        assignee_kind: 'guest',
        sort_order: 9,
      } as never,
    });
    expect(complete.mutate.role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 9, assignee_kind: 'guest' })
    );

    const defaults = createTx();
    defaults.run.mockResolvedValueOnce([]);
    await mutators.createRole.fn({
      tx: defaults,
      ctx,
      args: { id: 'default-role', event_id: 'event', name: 'Default' } as never,
    });
    expect(defaults.mutate.role.insert).toHaveBeenCalledWith(
      expect.objectContaining({ assignee_kind: 'member', default_request_role: false })
    );

    const missingRole = createTx();
    missingRole.run.mockResolvedValueOnce(null);
    await mutators.updateRole.fn({
      tx: missingRole,
      ctx,
      args: { id: 'role', name: 'Updated' } as never,
    });

    const updated = createTx();
    updated.run
      .mockResolvedValueOnce({
        id: 'role',
        event_id: 'event',
        assignee_kind: null,
        default_request_role: false,
        default_invite_role: false,
      })
      .mockResolvedValueOnce({ event_type: 'meeting' })
      .mockResolvedValueOnce([
        { id: 'role', default_request_role: true, default_invite_role: true },
        { id: 'other', default_request_role: true, default_invite_role: true },
      ]);
    await mutators.updateRole.fn({
      tx: updated,
      ctx,
      args: {
        id: 'role',
        assignee_kind: 'member',
        default_request_role: true,
        default_invite_role: true,
      } as never,
    });
    expect(updated.mutate.role.update).toHaveBeenCalled();

    const guestUpdate = createTx();
    guestUpdate.run
      .mockResolvedValueOnce({
        id: 'guest-role',
        event_id: 'event',
        assignee_kind: 'guest',
        default_request_role: false,
        default_invite_role: true,
      })
      .mockResolvedValueOnce({ event_type: 'general_assembly' });
    await mutators.updateRole.fn({
      tx: guestUpdate,
      ctx,
      args: { id: 'guest-role' } as never,
    });

    const fallbackUpdate = createTx();
    fallbackUpdate.run
      .mockResolvedValueOnce({
        id: 'member-role',
        event_id: 'event',
        assignee_kind: null,
        default_request_role: false,
        default_invite_role: false,
      })
      .mockResolvedValueOnce({ event_type: 'meeting' });
    await mutators.updateRole.fn({
      tx: fallbackUpdate,
      ctx,
      args: { id: 'member-role' } as never,
    });

    const clientDelete = createTx('client');
    await mutators.deleteRole.fn({ tx: clientDelete, ctx, args: { id: 'role' } });
    const serverDelete = createTx();
    serverDelete.run.mockResolvedValueOnce({ id: 'role', event_id: 'event' });
    await mutators.deleteRole.fn({ tx: serverDelete, ctx, args: { id: 'role' } });
    const unscopedDelete = createTx();
    unscopedDelete.run.mockResolvedValueOnce({ id: 'role', event_id: null });
    await mutators.deleteRole.fn({ tx: unscopedDelete, ctx, args: { id: 'role' } });
  });

  it('manages exceptions and meeting bookings', async () => {
    const created = createTx();
    await mutators.createException.fn({
      tx: created,
      ctx,
      args: { id: 'exception', parent_event_id: 'event', exception_date: 1 } as never,
    });

    const clientUpdate = createTx('client');
    await mutators.updateException.fn({
      tx: clientUpdate,
      ctx,
      args: { id: 'exception' } as never,
    });
    const serverUpdate = createTx();
    serverUpdate.run.mockResolvedValueOnce({ id: 'exception', parent_event_id: 'event' });
    await mutators.updateException.fn({
      tx: serverUpdate,
      ctx,
      args: { id: 'exception' } as never,
    });
    const unscopedUpdate = createTx();
    unscopedUpdate.run.mockResolvedValueOnce(null);
    await mutators.updateException.fn({
      tx: unscopedUpdate,
      ctx,
      args: { id: 'exception' } as never,
    });

    const clientDelete = createTx('client');
    await mutators.deleteException.fn({ tx: clientDelete, ctx, args: { id: 'exception' } });
    const serverDelete = createTx();
    serverDelete.run.mockResolvedValueOnce({ id: 'exception', parent_event_id: 'event' });
    await mutators.deleteException.fn({ tx: serverDelete, ctx, args: { id: 'exception' } });
    const unscopedDelete = createTx();
    unscopedDelete.run.mockResolvedValueOnce({ id: 'exception', parent_event_id: null });
    await mutators.deleteException.fn({ tx: unscopedDelete, ctx, args: { id: 'exception' } });

    const booked = createTx();
    await mutators.bookMeeting.fn({
      tx: booked,
      ctx,
      args: { event_id: 'event', instance_date: null } as never,
    });

    for (const [instanceDate, participants, expectedDeletes] of [
      [null, [{ id: 'zero', instance_date: 0 }], 1],
      [undefined, [{ id: 'missing' }], 1],
      [
        5,
        [
          { id: 'other', instance_date: 4 },
          { id: 'match', instance_date: 5 },
        ],
        1,
      ],
      [6, [{ id: 'other', instance_date: 4 }], 0],
    ] as const) {
      const tx = createTx();
      tx.run.mockResolvedValueOnce(participants);
      await mutators.cancelMeetingBooking.fn({
        tx,
        ctx,
        args: { event_id: 'event', instance_date: instanceDate } as never,
      });
      expect(tx.mutate.event_participant.delete).toHaveBeenCalledTimes(expectedDeletes);
    }
  });
});
