import { beforeEach, describe, expect, it, vi } from 'vitest';

const membershipHelperMocks = vi.hoisted(() => ({
  buildGroupsById: vi.fn(),
  loadActiveHierarchyRelationships: vi.fn(),
  loadGroupWithDerivedNetworkMeta: vi.fn(),
}));
const offlineMembershipMocks = vi.hoisted(() => ({
  buildOfflineMembershipPersonKey: vi.fn(),
  loadEffectiveOfflineMembershipsForGroup: vi.fn(),
}));
const serverHelperMocks = vi.hoisted(() => ({
  isActiveGroupStatus: vi.fn((status: string | null | undefined) =>
    ['active', 'admin', 'member'].includes(status ?? '')
  ),
  recomputeEventCounters: vi.fn(),
  syncUserWithEventConversation: vi.fn(),
}));
const serverNotifyMocks = vi.hoisted(() => ({
  fireNotification: vi.fn(),
}));

vi.mock('../../groups/membership-helpers', () => membershipHelperMocks);

vi.mock('../../groups/offline-membership-helpers', () => offlineMembershipMocks);

vi.mock('../../server-helpers', () => serverHelperMocks);

vi.mock('../../server-notify', () => serverNotifyMocks);

vi.mock('@/features/groups/logic/hierarchy', () => ({
  resolveChildBaseGroups: vi.fn(() => []),
}));

import {
  reconcileGeneralAssemblyParticipantsForEvent,
  reconcileGeneralAssemblyParticipantsForGroups,
} from '../assembly-reconcile';

type RunValue = unknown[] | Record<string, unknown> | null;

function createTx(runValues: RunValue[]) {
  return {
    run: vi.fn().mockImplementation(() => Promise.resolve(runValues.shift())),
    mutate: {
      event_participant: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
      event_participant_role: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
      event_offline_participant: {
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
}

function generalAssemblyEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    title: 'Annual General Assembly',
    event_type: 'general_assembly',
    group_id: 'group-1',
    creator_id: 'creator-1',
    visibility: 'public',
    attendance_mode: 'online',
    location_type: null,
    start_date: Date.now() + 60_000,
    end_date: Date.now() + 120_000,
    status: 'active',
    ...overrides,
  };
}

beforeEach(() => {
  Object.values(membershipHelperMocks).forEach(mock => mock.mockReset());
  Object.values(offlineMembershipMocks).forEach(mock => mock.mockReset());
  Object.values(serverHelperMocks).forEach(mock => mock.mockReset());
  Object.values(serverNotifyMocks).forEach(mock => mock.mockReset());
  serverHelperMocks.isActiveGroupStatus.mockImplementation((status: string | null | undefined) =>
    ['active', 'admin', 'member'].includes(status ?? '')
  );
  membershipHelperMocks.loadGroupWithDerivedNetworkMeta.mockResolvedValue({
    id: 'group-1',
    group_type: 'base',
  });
  membershipHelperMocks.buildGroupsById.mockResolvedValue(new Map());
  membershipHelperMocks.loadActiveHierarchyRelationships.mockResolvedValue([]);
  offlineMembershipMocks.loadEffectiveOfflineMembershipsForGroup.mockResolvedValue([]);
  offlineMembershipMocks.buildOfflineMembershipPersonKey.mockReturnValue(null);
});

describe('reconcileGeneralAssemblyParticipantsForEvent notifications', () => {
  it('notifies each member when an upcoming general assembly invitation is created', async () => {
    const tx = createTx([
      generalAssemblyEvent(),
      [],
      [],
      [],
      [{ id: 'membership-1', user_id: 'member-1', status: 'active', source: 'direct' }],
    ]);

    await reconcileGeneralAssemblyParticipantsForEvent(tx as never, 'event-1', 'admin-1');

    expect(tx.mutate.event_participant.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: 'event-1',
        user_id: 'member-1',
        group_id: 'group-1',
        status: 'invited',
      })
    );
    expect(serverNotifyMocks.fireNotification).toHaveBeenCalledWith('notifyEventInvite', {
      senderId: 'admin-1',
      recipientUserId: 'member-1',
      eventId: 'event-1',
      eventTitle: 'Annual General Assembly',
    });
  });

  it('does not re-notify an existing participant', async () => {
    const tx = createTx([
      generalAssemblyEvent(),
      [],
      [{ id: 'participant-1', user_id: 'member-1', participant_roles: [] }],
      [],
      [{ id: 'membership-1', user_id: 'member-1', status: 'active', source: 'direct' }],
    ]);

    await reconcileGeneralAssemblyParticipantsForEvent(tx as never, 'event-1', 'admin-1');

    expect(tx.mutate.event_participant.insert).not.toHaveBeenCalled();
    expect(serverNotifyMocks.fireNotification).not.toHaveBeenCalledWith(
      'notifyEventInvite',
      expect.anything()
    );
  });

  it('does not invite or notify members for past general assemblies', async () => {
    const tx = createTx([
      generalAssemblyEvent({
        start_date: Date.now() - 120_000,
        end_date: Date.now() - 60_000,
      }),
      [],
      [],
      [],
      [{ id: 'membership-1', user_id: 'member-1', status: 'active', source: 'direct' }],
    ]);

    await reconcileGeneralAssemblyParticipantsForEvent(tx as never, 'event-1', 'admin-1');

    expect(tx.mutate.event_participant.insert).not.toHaveBeenCalled();
    expect(serverNotifyMocks.fireNotification).not.toHaveBeenCalledWith(
      'notifyEventInvite',
      expect.anything()
    );
  });

  it('skips cancelled general assemblies when reconciling a group', async () => {
    const tx = createTx([
      [
        generalAssemblyEvent({
          id: 'cancelled-event',
          status: 'cancelled',
        }),
      ],
    ]);

    await reconcileGeneralAssemblyParticipantsForGroups(tx as never, ['group-1'], 'admin-1');

    expect(tx.mutate.event_participant.insert).not.toHaveBeenCalled();
    expect(serverNotifyMocks.fireNotification).not.toHaveBeenCalledWith(
      'notifyEventInvite',
      expect.anything()
    );
  });
});
