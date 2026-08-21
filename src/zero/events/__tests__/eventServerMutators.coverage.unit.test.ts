import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  function query(table: string, calls: unknown[][] = []): any {
    return new Proxy(
      { table, calls },
      {
        get(target, property) {
          if (property in target) return target[property as keyof typeof target];
          return (...args: unknown[]) => query(table, [...calls, [property, ...args]]);
        },
      }
    );
  }

  const zql = new Proxy({}, { get: (_target, table) => query(String(table)) });
  const shared = new Proxy(
    {},
    {
      get(target, property) {
        if (!(property in target)) {
          (target as Record<PropertyKey, unknown>)[property] = { fn: vi.fn(async () => undefined) };
        }
        return (target as Record<PropertyKey, unknown>)[property];
      },
    }
  ) as Record<string, { fn: ReturnType<typeof vi.fn> }>;

  return {
    zql,
    shared,
    fireNotification: vi.fn(),
    eventTitle: vi.fn(async () => 'Event title'),
    groupName: vi.fn(async () => 'Group name'),
    userName: vi.fn(async () => 'User name'),
    isActiveEventStatus: vi.fn((status: string | null | undefined) => status === 'active'),
    isActiveGroupStatus: vi.fn((status: string | null | undefined) => status === 'active'),
    ensureEventConversation: vi.fn(async () => undefined),
    recomputeEventCounters: vi.fn(async () => undefined),
    recomputeGroupCounters: vi.fn(async () => undefined),
    syncUserWithEventConversation: vi.fn(async () => undefined),
    reconcileAssembly: vi.fn(async () => undefined),
    reconcileDelegates: vi.fn(async () => ({ affectedGroupIds: [] })),
    reconcileGroupGraph: vi.fn(async () => undefined),
    syncHashtags: vi.fn(async () => undefined),
    completeProcessTask: vi.fn(async () => undefined),
    reorderVoteSteps: vi.fn(async () => undefined),
    loadGroup: vi.fn(async () => ({ id: 'group' })),
    canCreateDelegateAssembly: vi.fn(() => true),
    hasOpenSnapshot: vi.fn((rows: readonly { open?: boolean }[]) => rows.some(row => row.open)),
    resolveAttendanceMode: vi.fn(
      (event: { attendance_mode?: string | null; location_type?: string | null }) =>
        event.attendance_mode === 'online' || event.attendance_mode === 'hybrid'
          ? event.attendance_mode
          : event.location_type === 'online'
            ? 'online'
            : 'offline'
    ),
    defaultRoles: [
      {
        name: 'Organizer',
        description: 'Organizer',
        permissions: [{ resource: 'events', action: 'manage' }],
        default_request_role: false,
        default_invite_role: false,
        assignee_kind: 'member',
      },
      {
        name: 'Participant',
        description: 'Participant',
        permissions: [],
        default_request_role: true,
        default_invite_role: true,
        assignee_kind: 'member',
      },
      {
        name: 'Fallbacks',
        description: 'Fallbacks',
        permissions: [],
      },
    ] as Record<string, any>[],
    guestRole: {
      name: 'Guest',
      description: 'Guest',
      permissions: [],
      default_request_role: true,
      default_invite_role: true,
      assignee_kind: 'guest',
    } as Record<string, any>,
  };
});

vi.mock('../../schema', () => ({ zql: mocks.zql }));
vi.mock('../../mutators', () => ({ mutators: { events: mocks.shared } }));
vi.mock('../../server-notify', () => ({ fireNotification: mocks.fireNotification }));
vi.mock('../../amendments/server-mutators', () => ({
  amendmentServerMutators: {
    completeProcessTaskWithEvent: { fn: mocks.completeProcessTask },
  },
}));
vi.mock('../../common/server-hashtags', () => ({
  syncEntityHashtagsForCreate: mocks.syncHashtags,
}));
vi.mock('../../server-helpers', () => ({
  eventTitle: mocks.eventTitle,
  groupName: mocks.groupName,
  userName: mocks.userName,
  isActiveEventStatus: mocks.isActiveEventStatus,
  isActiveGroupStatus: mocks.isActiveGroupStatus,
  ensureEventConversation: mocks.ensureEventConversation,
  recomputeEventCounters: mocks.recomputeEventCounters,
  recomputeGroupCounters: mocks.recomputeGroupCounters,
  syncUserWithEventConversation: mocks.syncUserWithEventConversation,
}));
vi.mock('../../rbac/constants', () => ({
  DEFAULT_EVENT_ROLES: mocks.defaultRoles,
  DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE: mocks.guestRole,
}));
vi.mock('../assembly-reconcile', () => ({
  reconcileGeneralAssemblyParticipantsForEvent: mocks.reconcileAssembly,
}));
vi.mock('../delegate-allocation-reconcile', () => ({
  reconcileDelegateAllocationsForEvent: mocks.reconcileDelegates,
}));
vi.mock('../../network/group-graph-reconcile', () => ({
  reconcileGroupGraph: mocks.reconcileGroupGraph,
}));
vi.mock('../../groups/membership-helpers', () => ({
  loadGroupWithDerivedNetworkMeta: mocks.loadGroup,
}));
vi.mock('@/features/events/logic/delegateAssemblyEligibility', () => ({
  canCreateDelegateAssemblyForGroup: mocks.canCreateDelegateAssembly,
  DELEGATE_ASSEMBLY_GROUP_ELIGIBILITY_MESSAGE: 'ineligible delegate assembly group',
}));
vi.mock('@/features/change-requests/logic/changeRequestVoteOrder', () => ({
  normalizeChangeRequestVoteOrder: (value: string | null | undefined) => value ?? 'agenda_order',
}));
vi.mock('../../agendas/change-request-vote-ordering', () => ({
  reorderOpenChangeRequestVoteStepsForEvent: mocks.reorderVoteSteps,
}));
vi.mock('../attendance-mode', () => ({
  ATTENDANCE_MODE_CHANGE_LOCKED_MESSAGE: 'attendance locked',
  hasOpenElectorateSnapshot: mocks.hasOpenSnapshot,
  resolveEventAttendanceMode: mocks.resolveAttendanceMode,
}));

import {
  eventServerMutatorInternals as helpers,
  eventServerMutators as mutators,
} from '../server-mutators';

function mutationTable() {
  return {
    insert: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
}

function createTx(responses: Record<string, unknown | unknown[]> = {}) {
  const queues = new Map(
    Object.entries(responses).map(([table, values]) => [
      table,
      Array.isArray(values) && values.length > 0 && Array.isArray(values[0])
        ? [...(values as unknown[][])]
        : [values],
    ])
  );
  return {
    location: 'server',
    run: vi.fn(async (query: { table: string }) => {
      const queue = queues.get(query.table);
      return queue?.shift() ?? [];
    }),
    mutate: {
      role: mutationTable(),
      action_right: mutationTable(),
      event_participant: mutationTable(),
      event_participant_role: mutationTable(),
      event_offline_participant: mutationTable(),
      conversation: mutationTable(),
    },
  } as any;
}

function queueTx(responses: Record<string, unknown[]>) {
  const queues = new Map(Object.entries(responses).map(([table, values]) => [table, [...values]]));
  const tx = createTx();
  tx.run.mockImplementation(async (query: { table: string }) => {
    const queue = queues.get(query.table);
    if (!queue || queue.length === 0) return [];
    return queue.shift();
  });
  return tx;
}

const ctx = { userID: 'actor', email: 'actor@example.test' } as never;

function eventArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event',
    title: 'Event',
    event_type: 'meeting',
    group_id: null,
    visibility: 'public',
    ...overrides,
  } as never;
}

function participantArgs(overrides: Record<string, unknown> = {}) {
  return {
    id: 'participant',
    event_id: 'event',
    user_id: 'user',
    status: 'requested',
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadGroup.mockResolvedValue({ id: 'group' });
  mocks.canCreateDelegateAssembly.mockReturnValue(true);
  let uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`
  );
  vi.spyOn(Date, 'now').mockReturnValue(1234);
});

describe('server event helper contracts', () => {
  it('adds and synchronizes participant role links', async () => {
    const existing = queueTx({ event_participant_role: [{ id: 'existing' }] });
    await expect(
      helpers.addEventParticipantRoleLink(existing, {
        event_participant_id: 'participant',
        role_id: 'role',
      })
    ).resolves.toBe('existing');

    const inserted = queueTx({ event_participant_role: [null] });
    await expect(
      helpers.addEventParticipantRoleLink(inserted, {
        event_participant_id: 'participant',
        role_id: 'role',
        assigned_by_id: 'actor',
      })
    ).resolves.toBe('uuid-1');

    const synced = queueTx({
      event_participant_role: [
        [
          { id: 'keep-link', role_id: 'keep' },
          { id: 'remove-link', role_id: 'remove' },
        ],
        null,
      ],
    });
    await helpers.syncEventParticipantRoleLinks(synced, {
      event_participant_id: 'participant',
      role_ids: ['keep', '', 'add', 'add'],
    });
    expect(synced.mutate.event_participant_role.delete).toHaveBeenCalledWith({ id: 'remove-link' });
    expect(synced.mutate.event_participant_role.insert).toHaveBeenCalledOnce();
  });

  it('compares role sets and classifies organizer-like roles', () => {
    expect(helpers.sameStringSet(['a'], [])).toBe(false);
    expect(helpers.sameStringSet(['a'], ['b'])).toBe(false);
    expect(helpers.sameStringSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(helpers.isOrganizerLikeRole(null)).toBe(false);
    expect(helpers.isOrganizerLikeRole({ name: 'Organizer' })).toBe(true);
    expect(helpers.isOrganizerLikeRole({ name: 'Admin' })).toBe(true);
    expect(
      helpers.isOrganizerLikeRole({
        name: 'Manager',
        action_rights: [{ resource: 'events', action: 'manage' }],
      })
    ).toBe(true);
    expect(
      helpers.isOrganizerLikeRole({
        action_rights: [{ resource: 'events', action: 'manage_participants' }],
      })
    ).toBe(true);
    expect(
      helpers.isOrganizerLikeRole({
        action_rights: [{ resource: 'notifications', action: 'manageNotifications' }],
      })
    ).toBe(true);
    expect(
      helpers.isOrganizerLikeRole({
        action_rights: [{ resource: 'notifications', action: 'read' }],
      })
    ).toBe(false);
    expect(helpers.isOrganizerLikeRole({ action_rights: null })).toBe(false);
  });

  it('loads role ids, role details, summaries, and organizer flags', async () => {
    const ids = queueTx({
      event_participant_role: [[{ role_id: 'role' }, { role_id: '' }, { role_id: null }]],
    });
    await expect(helpers.eventParticipantRoleIds(ids, 'participant')).resolves.toEqual(['role']);

    const roles = queueTx({ role: [{ name: 'One' }, null] });
    await expect(helpers.eventRolesWithRights(roles, ['one', 'two'])).resolves.toHaveLength(2);

    await expect(helpers.eventRoleSummary(createTx(), [], 'Fallback')).resolves.toBe('Fallback');
    const summary = queueTx({ role: [{ name: 'One' }, null] });
    await expect(helpers.eventRoleSummary(summary, ['one', 'two'])).resolves.toBe('One, Role');

    const organizer = queueTx({ role: [{ name: 'Organizer' }] });
    await expect(helpers.hasOrganizerLikeRole(organizer, ['one'])).resolves.toBe(true);
    const member = queueTx({ role: [{ name: 'Member' }] });
    await expect(helpers.hasOrganizerLikeRole(member, ['one'])).resolves.toBe(false);
  });

  it('notifies promotion, demotion, ordinary change, and ignores irrelevant changes', async () => {
    const inactive = createTx();
    await helpers.notifyActiveEventParticipantRoleChange(
      inactive,
      'actor',
      { id: 'participant', event_id: 'event', user_id: 'user', status: 'invited' },
      []
    );
    expect(inactive.run).not.toHaveBeenCalled();

    const unchanged = queueTx({ event_participant_role: [[{ role_id: 'same' }]] });
    await helpers.notifyActiveEventParticipantRoleChange(
      unchanged,
      'actor',
      { id: 'participant', event_id: 'event', user_id: 'user', status: 'active' },
      ['same']
    );

    const cases = [
      {
        previous: ['member'],
        next: 'organizer',
        roles: [{ name: 'Member' }, { name: 'Organizer' }, { name: 'Organizer' }],
        notification: 'notifyOrganizerPromoted',
      },
      {
        previous: ['organizer'],
        next: 'member',
        roles: [{ name: 'Organizer' }, { name: 'Member' }, { name: 'Member' }],
        notification: 'notifyOrganizerDemoted',
      },
      {
        previous: ['member'],
        next: 'other',
        roles: [{ name: 'Member' }, { name: 'Other' }, { name: 'Other' }],
        notification: 'notifyParticipationRoleChanged',
      },
    ];
    for (const scenario of cases) {
      mocks.fireNotification.mockClear();
      const tx = queueTx({
        event_participant_role: [[{ role_id: scenario.next }]],
        role: scenario.roles,
      });
      await helpers.notifyActiveEventParticipantRoleChange(
        tx,
        'actor',
        { id: 'participant', event_id: 'event', user_id: 'user', status: 'active' },
        scenario.previous
      );
      expect(mocks.fireNotification).toHaveBeenCalledWith(
        scenario.notification,
        expect.any(Object)
      );
    }
  });

  it('checks event participation eligibility', async () => {
    const missing = queueTx({ event: [null] });
    await expect(
      helpers.assertEventParticipationEligibility(missing, {
        event_id: 'event',
        user_id: 'user',
        allowInviteOnlyEvent: false,
      })
    ).rejects.toThrow('Event not found');

    const delegateGuest = queueTx({ event: [{ event_type: 'delegate_assembly' }] });
    await expect(
      helpers.assertEventParticipationEligibility(delegateGuest, {
        event_id: 'event',
        user_id: 'user',
        allowInviteOnlyEvent: true,
        allowAssemblyGuestInvite: true,
      })
    ).resolves.toBeTruthy();

    const delegateRejected = queueTx({
      event: [{ event_type: 'delegate_assembly' }],
      event_delegate: [[]],
    });
    await expect(
      helpers.assertEventParticipationEligibility(delegateRejected, {
        event_id: 'event',
        user_id: 'user',
        allowInviteOnlyEvent: false,
      })
    ).rejects.toThrow('confirmed delegates');

    const delegateConfirmed = queueTx({
      event: [{ event_type: 'delegate_assembly' }],
      event_delegate: [[{ status: 'pending' }, { status: 'confirmed' }]],
    });
    await expect(
      helpers.assertEventParticipationEligibility(delegateConfirmed, {
        event_id: 'event',
        user_id: 'user',
        allowInviteOnlyEvent: false,
      })
    ).resolves.toBeTruthy();

    const assemblyGuest = queueTx({ event: [{ event_type: 'general_assembly' }] });
    await expect(
      helpers.assertEventParticipationEligibility(assemblyGuest, {
        event_id: 'event',
        user_id: 'user',
        allowInviteOnlyEvent: true,
        allowAssemblyGuestInvite: true,
      })
    ).resolves.toBeTruthy();

    const missingGroup = queueTx({ event: [{ event_type: 'general_assembly', group_id: null }] });
    await expect(
      helpers.assertEventParticipationEligibility(missingGroup, {
        event_id: 'event',
        user_id: 'user',
        allowInviteOnlyEvent: false,
      })
    ).rejects.toThrow('missing its associated group');

    const nonMember = queueTx({
      event: [{ event_type: 'general_assembly', group_id: 'group' }],
      group_membership: [[{ status: 'left' }]],
    });
    await expect(
      helpers.assertEventParticipationEligibility(nonMember, {
        event_id: 'event',
        user_id: 'user',
        allowInviteOnlyEvent: false,
      })
    ).rejects.toThrow('active members');

    const member = queueTx({
      event: [{ event_type: 'general_assembly', group_id: 'group' }],
      group_membership: [[{ status: 'left' }, { status: 'active' }]],
    });
    await expect(
      helpers.assertEventParticipationEligibility(member, {
        event_id: 'event',
        user_id: 'user',
        allowInviteOnlyEvent: false,
      })
    ).resolves.toBeTruthy();

    const inviteOnly = queueTx({ event: [{ event_type: 'on_invite' }] });
    await expect(
      helpers.assertEventParticipationEligibility(inviteOnly, {
        event_id: 'event',
        user_id: 'user',
        allowInviteOnlyEvent: false,
      })
    ).rejects.toThrow('invitation only');
    const invited = queueTx({ event: [{ event_type: 'on_invite' }] });
    await expect(
      helpers.assertEventParticipationEligibility(invited, {
        event_id: 'event',
        user_id: 'user',
        allowInviteOnlyEvent: true,
      })
    ).resolves.toBeTruthy();
  });

  it('checks delegate and group membership records directly', async () => {
    const delegates = queueTx({
      event_delegate: [[{ status: 'pending' }, { status: 'confirmed' }]],
    });
    await expect(helpers.isConfirmedDelegateForEvent(delegates, 'event', 'user')).resolves.toBe(
      true
    );
    const noDelegate = queueTx({ event_delegate: [[]] });
    await expect(helpers.isConfirmedDelegateForEvent(noDelegate, 'event', 'user')).resolves.toBe(
      false
    );
    const memberships = queueTx({ group_membership: [[{ status: 'left' }, { status: 'active' }]] });
    await expect(helpers.isActiveMemberOfGroup(memberships, 'group', 'user')).resolves.toBe(true);
    const noMembership = queueTx({ group_membership: [[]] });
    await expect(helpers.isActiveMemberOfGroup(noMembership, 'group', 'user')).resolves.toBe(false);
  });

  it('detects guest invites from explicit and default roles', async () => {
    const explicit = queueTx({
      role: [
        [
          { id: 'guest', assignee_kind: 'guest' },
          { id: 'other', assignee_kind: 'member' },
        ],
      ],
    });
    await expect(
      helpers.isGuestInviteForEvent(explicit, {
        event_id: 'event',
        initial_role_ids: ['', 'guest', 'guest'],
        initial_role_id: 'ignored',
      })
    ).resolves.toBe(true);

    const singular = queueTx({ role: [[{ id: 'guest', assignee_kind: 'guest' }]] });
    await expect(
      helpers.isGuestInviteForEvent(singular, { event_id: 'event', initial_role_id: 'guest' })
    ).resolves.toBe(true);

    const defaults = queueTx({ role: [[{ id: 'guest', assignee_kind: 'guest' }]] });
    await expect(helpers.isGuestInviteForEvent(defaults, { event_id: 'event' })).resolves.toBe(
      true
    );
    const mixed = queueTx({
      role: [
        [
          { id: 'guest', assignee_kind: 'guest' },
          { id: 'member', assignee_kind: 'member' },
        ],
      ],
    });
    await expect(helpers.isGuestInviteForEvent(mixed, { event_id: 'event' })).resolves.toBe(false);
    const empty = queueTx({ role: [[]] });
    await expect(helpers.isGuestInviteForEvent(empty, { event_id: 'event' })).resolves.toBe(false);
  });

  it('normalizes offline participation channels', async () => {
    const missing = queueTx({ event: [null] });
    await helpers.normalizeOfflineParticipantChannelsForEvent(missing, 'event');
    expect(missing.mutate.event_offline_participant.update).not.toHaveBeenCalled();

    const cases = [
      { mode: 'offline', rows: [{ id: 'one', participation_channel: 'online' }], updates: 1 },
      {
        mode: 'hybrid',
        rows: [
          { id: 'one', connected_user_id: 'user', participation_channel: 'hybrid' },
          { id: 'two', connected_user_id: null, participation_channel: 'online' },
        ],
        updates: 2,
      },
      {
        mode: 'online',
        rows: [
          { id: 'one', connected_user_id: 'user', participation_channel: 'offline' },
          { id: 'two', connected_user_id: null, participation_channel: 'hybrid' },
        ],
        updates: 1,
      },
      {
        mode: 'online',
        rows: [{ id: 'same', connected_user_id: 'user', participation_channel: 'online' }],
        updates: 0,
      },
    ];
    for (const scenario of cases) {
      const tx = queueTx({
        event: [{ attendance_mode: scenario.mode }],
        event_offline_participant: [scenario.rows],
      });
      await helpers.normalizeOfflineParticipantChannelsForEvent(tx, 'event');
      expect(tx.mutate.event_offline_participant.update).toHaveBeenCalledTimes(scenario.updates);
    }
  });

  it('locks attendance changes after vote or election snapshots', async () => {
    const clear = queueTx({
      agenda_item: [[{ id: 'agenda' }]],
      vote: [[{ open: false }]],
      election: [[{ open: false }]],
    });
    await expect(helpers.assertAttendanceModeCanChange(clear, 'event')).resolves.toBeUndefined();
    const vote = queueTx({
      agenda_item: [[{ id: 'agenda' }]],
      vote: [[{ open: true }]],
      election: [[]],
    });
    await expect(helpers.assertAttendanceModeCanChange(vote, 'event')).rejects.toThrow(
      'attendance locked'
    );
    const election = queueTx({
      agenda_item: [[{ id: 'agenda' }]],
      vote: [[]],
      election: [[{ open: true }]],
    });
    await expect(helpers.assertAttendanceModeCanChange(election, 'event')).rejects.toThrow(
      'attendance locked'
    );
    const none = queueTx({ agenda_item: [[]] });
    await expect(helpers.assertAttendanceModeCanChange(none, 'event')).resolves.toBeUndefined();
  });

  it('validates delegate assembly groups and status transitions', async () => {
    await expect(helpers.assertDelegateAssemblyGroupEligibility(createTx(), null)).rejects.toThrow(
      'linked to a group'
    );
    mocks.loadGroup.mockResolvedValueOnce(null as never);
    await expect(
      helpers.assertDelegateAssemblyGroupEligibility(createTx(), 'group')
    ).rejects.toThrow('not found');
    mocks.canCreateDelegateAssembly.mockReturnValueOnce(false);
    await expect(
      helpers.assertDelegateAssemblyGroupEligibility(createTx(), 'group')
    ).rejects.toThrow('ineligible');
    await expect(
      helpers.assertDelegateAssemblyGroupEligibility(createTx(), 'group')
    ).resolves.toBeUndefined();

    const unchanged = createTx();
    await helpers.assertEventStatusTransitionEligibility(unchanged, {
      event_id: 'event',
      user_id: 'user',
      old_status: 'active',
      new_status: 'active',
    });
    const undefinedStatus = createTx();
    await helpers.assertEventStatusTransitionEligibility(undefinedStatus, {
      event_id: 'event',
      user_id: 'user',
      old_status: 'invited',
      new_status: undefined,
    });
    const activatedInvite = queueTx({ event: [{ event_type: 'on_invite' }] });
    await expect(
      helpers.assertEventStatusTransitionEligibility(activatedInvite, {
        event_id: 'event',
        user_id: 'user',
        old_status: 'invited',
        new_status: 'active',
      })
    ).resolves.toBeUndefined();
    const activatedRequest = queueTx({ event: [{ event_type: 'meeting' }] });
    await expect(
      helpers.assertEventStatusTransitionEligibility(activatedRequest, {
        event_id: 'event',
        user_id: 'user',
        old_status: 'requested',
        new_status: 'active',
      })
    ).resolves.toBeUndefined();
  });
});

describe('server event mutator orchestration', () => {
  it('delegates creator RBAC bootstrap and runs event-specific server effects', async () => {
    const regular = queueTx({
      event_participant: [{ id: 'creator' }],
      event_participant_role: [[], null],
    });
    await mutators.create.fn({ tx: regular, ctx, args: eventArgs() });
    expect(regular.mutate.role.insert).not.toHaveBeenCalled();
    expect(regular.mutate.action_right.insert).not.toHaveBeenCalled();
    expect(regular.mutate.event_participant.update).not.toHaveBeenCalled();

    const delegate = queueTx({ event_participant: [null], event_participant_role: [[], null] });
    await mutators.create.fn({
      tx: delegate,
      ctx,
      args: eventArgs({
        event_type: 'delegate_assembly',
        group_id: 'group',
        visibility: undefined,
      }),
    });
    expect(mocks.reconcileDelegates).toHaveBeenCalled();
    expect(mocks.reconcileGroupGraph).toHaveBeenCalled();

    const general = queueTx({ event_participant: [null], event_participant_role: [[], null] });
    await mutators.create.fn({
      tx: general,
      ctx,
      args: eventArgs({ event_type: 'general_assembly', group_id: 'group' }),
    });
    expect(mocks.reconcileAssembly).toHaveBeenCalled();

    const invitation = queueTx({
      event_participant: [null],
      event_participant_role: [[], null, [], null],
    });
    await mutators.create.fn({
      tx: invitation,
      ctx,
      args: eventArgs({
        event_type: 'on_invite',
        group_id: 'group',
        invited_user_ids: ['actor', 'invitee'],
        visibility: undefined,
      }),
    });
    expect(invitation.mutate.event_participant.insert).toHaveBeenCalledOnce();
    expect(mocks.recomputeGroupCounters).toHaveBeenCalled();

    const participantTemplate = mocks.defaultRoles[1];
    const originalName = participantTemplate.name;
    const originalInviteDefault = participantTemplate.default_invite_role;
    participantTemplate.name = 'Member';
    participantTemplate.default_invite_role = false;
    const noDefaultInvite = queueTx({
      event_participant: [{ id: 'creator' }],
      event_participant_role: [[], null],
    });
    await mutators.create.fn({
      tx: noDefaultInvite,
      ctx,
      args: eventArgs({
        event_type: 'on_invite',
        group_id: null,
        invited_user_ids: ['invitee'],
        visibility: undefined,
      }),
    });
    participantTemplate.name = originalName;
    participantTemplate.default_invite_role = originalInviteDefault;
  });

  it('creates full events and wraps offline roster changes', async () => {
    const full = queueTx({ event_participant: [null], event_participant_role: [[], null] });
    await mutators.createFull.fn({
      tx: full,
      ctx,
      args: {
        event: eventArgs(),
        hashtags: ['one'],
        process_task_completions: [{ id: 'completion' }],
      } as never,
    });
    expect(mocks.syncHashtags).toHaveBeenCalled();
    expect(mocks.completeProcessTask).toHaveBeenCalledOnce();

    const fullDefaults = queueTx({ event_participant: [null], event_participant_role: [[], null] });
    await mutators.createFull.fn({
      tx: fullDefaults,
      ctx,
      args: { event: eventArgs(), hashtags: [] } as never,
    });

    const created = createTx();
    await mutators.createOfflineParticipant.fn({
      tx: created,
      ctx,
      args: { id: 'offline', event_id: 'event' } as never,
    });
    const imported = createTx();
    await mutators.importOfflineParticipants.fn({
      tx: imported,
      ctx,
      args: { event_id: 'event', entries: [] } as never,
    });

    for (const method of ['updateOfflineParticipant', 'deleteOfflineParticipant'] as const) {
      const missing = queueTx({ event_offline_participant: [null] });
      await mutators[method].fn({ tx: missing, ctx, args: { id: 'offline' } as never });
      const existing = queueTx({
        event_offline_participant: [{ id: 'offline', event_id: 'event' }],
      });
      await mutators[method].fn({ tx: existing, ctx, args: { id: 'offline' } as never });
    }
  });

  it('joins and invites event participants', async () => {
    const requested = queueTx({ event: [{ event_type: 'meeting' }] });
    await mutators.joinEvent.fn({ tx: requested, ctx, args: participantArgs() });
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyParticipationRequest',
      expect.any(Object)
    );

    const active = queueTx({ event: [{ event_type: 'meeting' }] });
    await mutators.joinEvent.fn({ tx: active, ctx, args: participantArgs({ status: 'active' }) });
    expect(mocks.syncUserWithEventConversation).toHaveBeenCalled();

    const passive = queueTx({ event: [{ event_type: 'meeting' }] });
    await mutators.joinEvent.fn({ tx: passive, ctx, args: participantArgs({ status: 'invited' }) });

    const absentInvitee = createTx();
    await mutators.inviteParticipant.fn({
      tx: absentInvitee,
      ctx,
      args: participantArgs({ user_id: null }),
    });

    const invited = queueTx({
      role: [[{ id: 'guest', assignee_kind: 'guest' }]],
      event: [{ event_type: 'general_assembly' }],
    });
    await mutators.inviteParticipant.fn({
      tx: invited,
      ctx,
      args: participantArgs({ initial_role_id: 'guest' }),
    });
    expect(mocks.fireNotification).toHaveBeenCalledWith('notifyEventInvite', expect.any(Object));
  });

  it('handles every leave-event notification outcome', async () => {
    const missing = queueTx({ event_participant: [null] });
    await mutators.leaveEvent.fn({ tx: missing, ctx, args: { id: 'participant' } });

    for (const [userId, status, notification] of [
      ['actor', 'requested', 'notifyEventRequestWithdrawn'],
      ['actor', 'invited', 'notifyEventInvitationDeclined'],
      ['actor', 'active', 'notifyParticipationWithdrawn'],
      ['other', 'requested', 'notifyParticipationRejected'],
      ['other', 'active', 'notifyParticipationRemoved'],
    ]) {
      mocks.fireNotification.mockClear();
      const tx = queueTx({
        event_participant: [{ id: 'participant', event_id: 'event', user_id: userId, status }],
      });
      await mutators.leaveEvent.fn({ tx, ctx, args: { id: 'participant' } });
      expect(mocks.fireNotification).toHaveBeenCalledWith(notification, expect.any(Object));
    }
  });

  it('updates participants and participant roles', async () => {
    const missing = queueTx({ event_participant: [null] });
    await mutators.updateParticipant.fn({ tx: missing, ctx, args: { id: 'participant' } as never });

    const ordinary = queueTx({
      event_participant: [
        { id: 'participant', event_id: 'event', user_id: 'actor', status: 'active' },
      ],
    });
    await mutators.updateParticipant.fn({
      tx: ordinary,
      ctx,
      args: { id: 'participant' } as never,
    });

    const accepted = queueTx({
      event_participant: [
        { id: 'participant', event_id: 'event', user_id: 'actor', status: 'invited' },
      ],
      event: [{ event_type: 'meeting' }],
    });
    await mutators.updateParticipant.fn({
      tx: accepted,
      ctx,
      args: { id: 'participant', status: 'active' } as never,
    });
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyEventInvitationAccepted',
      expect.any(Object)
    );

    const approved = queueTx({
      event_participant: [
        { id: 'participant', event_id: 'event', user_id: 'other', status: 'requested' },
      ],
      event: [{ event_type: 'meeting' }],
    });
    await mutators.updateParticipant.fn({
      tx: approved,
      ctx,
      args: { id: 'participant', status: 'active' } as never,
    });
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyParticipationApproved',
      expect.any(Object)
    );

    for (const method of [
      'addParticipantRole',
      'removeParticipantRole',
      'syncParticipantRoles',
    ] as const) {
      const missingRole = queueTx({ event_participant: [null] });
      await mutators[method].fn({
        tx: missingRole,
        ctx,
        args: { event_participant_id: 'participant', role_id: 'role', role_ids: ['role'] } as never,
      });

      const participant = queueTx({
        event_participant: [
          { id: 'participant', event_id: 'event', user_id: 'user', status: 'invited' },
        ],
        event_participant_role: [[], []],
      });
      await mutators[method].fn({
        tx: participant,
        ctx,
        args: { event_participant_id: 'participant', role_id: 'role', role_ids: ['role'] } as never,
      });
    }
  });

  it('updates event settings, conversations, assembly state, and accreditation', async () => {
    const missing = queueTx({ event: [null] });
    await mutators.update.fn({ tx: missing, ctx, args: { id: 'event' } as never });

    const unchanged = queueTx({
      event: [
        {
          id: 'event',
          event_type: 'meeting',
          attendance_mode: 'offline',
          title: 'Old',
          change_request_vote_order: 'agenda_order',
        },
      ],
    });
    await mutators.update.fn({ tx: unchanged, ctx, args: { id: 'event' } as never });

    const accreditation = queueTx({
      event: [
        {
          id: 'event',
          event_type: 'meeting',
          accreditation_required: false,
          attendance_mode: 'offline',
          title: 'Old',
        },
      ],
      agenda_item: [[{ id: 'agenda' }]],
      vote: [[{ electorate_snapshotted_at: null }]],
      election: [[{ electorate_snapshotted_at: null }]],
    });
    await mutators.update.fn({
      tx: accreditation,
      ctx,
      args: { id: 'event', accreditation_required: true } as never,
    });

    for (const [votes, elections] of [
      [[{ electorate_snapshotted_at: 1 }], []],
      [[], [{ electorate_snapshotted_at: 1 }]],
    ] as const) {
      const locked = queueTx({
        event: [{ id: 'event', event_type: 'meeting', accreditation_required: false }],
        agenda_item: [[{ id: 'agenda' }]],
        vote: [votes],
        election: [elections],
      });
      await expect(
        mutators.update.fn({
          tx: locked,
          ctx,
          args: { id: 'event', accreditation_required: true } as never,
        })
      ).rejects.toThrow('Accreditation requirements');
    }

    const general = queueTx({
      event: [
        {
          id: 'event',
          event_type: 'meeting',
          group_id: 'old-group',
          attendance_mode: 'offline',
          title: 'Old',
          change_request_vote_order: 'agenda_order',
        },
      ],
      agenda_item: [[], []],
      conversation: [{ id: 'conversation' }],
      event_offline_participant: [
        [{ id: 'offline', connected_user_id: 'user', participation_channel: 'offline' }],
      ],
    });
    await mutators.update.fn({
      tx: general,
      ctx,
      args: {
        id: 'event',
        event_type: 'general_assembly',
        group_id: 'new-group',
        attendance_mode: 'online',
        title: ' ',
        change_request_vote_order: 'newest_first',
      } as never,
    });
    expect(mocks.reorderVoteSteps).toHaveBeenCalled();
    expect(general.mutate.conversation.update).toHaveBeenCalledWith({
      id: 'conversation',
      name: null,
    });
    expect(mocks.reconcileAssembly).toHaveBeenCalled();

    const delegate = queueTx({
      event: [
        {
          id: 'event',
          event_type: 'delegate_assembly',
          group_id: 'group',
          attendance_mode: 'offline',
          title: 'Same',
        },
      ],
      conversation: [null],
    });
    await mutators.update.fn({
      tx: delegate,
      ctx,
      args: {
        id: 'event',
        event_type: 'delegate_assembly',
        group_id: 'group',
        title: 'Changed',
      } as never,
    });
    expect(mocks.reconcileDelegates).toHaveBeenCalled();
  });

  it('cancels events and wraps role notifications', async () => {
    const grouped = queueTx({ event: [{ group_id: 'group' }] });
    await mutators.cancel.fn({
      tx: grouped,
      ctx,
      args: { id: 'event', cancel_reason: 'Reason' } as never,
    });
    expect(mocks.recomputeGroupCounters).toHaveBeenCalled();
    const ungrouped = queueTx({ event: [null] });
    await mutators.cancel.fn({
      tx: ungrouped,
      ctx,
      args: { id: 'event', cancel_reason: 'Reason' } as never,
    });

    await mutators.createRole.fn({
      tx: createTx(),
      ctx,
      args: { id: 'role', event_id: 'event', name: 'Role' } as never,
    });
    await mutators.createRole.fn({
      tx: createTx(),
      ctx,
      args: { id: 'role', event_id: null, name: 'Role' } as never,
    });
    const deleted = queueTx({ role: [{ id: 'role', event_id: 'event', name: 'Role' }] });
    await mutators.deleteRole.fn({ tx: deleted, ctx, args: { id: 'role' } });
    const missing = queueTx({ role: [null] });
    await mutators.deleteRole.fn({ tx: missing, ctx, args: { id: 'role' } });
  });

  it('enforces meeting capacity and records booking changes', async () => {
    const missing = queueTx({ event_participant: [[]], event: [null] });
    await mutators.bookMeeting.fn({
      tx: missing,
      ctx,
      args: { event_id: 'event', instance_date: null } as never,
    });
    const unbookable = queueTx({ event_participant: [[]], event: [{ is_bookable: false }] });
    await mutators.bookMeeting.fn({
      tx: unbookable,
      ctx,
      args: { event_id: 'event', instance_date: null } as never,
    });

    const full = queueTx({
      event_participant: [[{ user_id: 'creator' }, { user_id: 'user', instance_date: 0 }]],
      event: [{ is_bookable: true, creator_id: 'creator', max_bookings: 1 }],
    });
    await mutators.bookMeeting.fn({
      tx: full,
      ctx,
      args: { event_id: 'event', instance_date: null } as never,
    });

    const available = queueTx({
      event_participant: [
        [
          { user_id: 'creator' },
          { user_id: 'other', instance_date: 4 },
          { user_id: 'same', instance_date: 5 },
        ],
      ],
      event: [{ is_bookable: true, creator_id: 'creator', max_bookings: null }],
    });
    await mutators.bookMeeting.fn({
      tx: available,
      ctx,
      args: { event_id: 'event', instance_date: 6 },
    });
    expect(mocks.fireNotification).toHaveBeenCalledWith('notifyMeetingBooked', expect.any(Object));

    await mutators.cancelMeetingBooking.fn({
      tx: createTx(),
      ctx,
      args: { event_id: 'event', instance_date: undefined } as never,
    });
    expect(mocks.fireNotification).toHaveBeenCalledWith(
      'notifyMeetingCancelled',
      expect.any(Object)
    );
  });
});
