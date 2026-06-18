import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createEventFn: vi.fn(),
  updateEventFn: vi.fn(),
  eventTitleMock: vi.fn(),
  groupNameMock: vi.fn(),
  fireNotificationMock: vi.fn(),
  recomputeEventCountersMock: vi.fn(),
  recomputeGroupCountersMock: vi.fn(),
  ensureEventConversationMock: vi.fn(),
  syncUserWithEventConversationMock: vi.fn(),
  reconcileGeneralAssemblyParticipantsForEventMock: vi.fn(),
  reconcileDelegateAllocationsForEventMock: vi.fn(),
}));

vi.mock('../../mutators', () => ({
  mutators: {
    events: {
      create: { fn: mocks.createEventFn },
      update: { fn: mocks.updateEventFn },
    },
  },
}));

vi.mock('../../server-helpers', () => ({
  eventTitle: mocks.eventTitleMock,
  groupName: mocks.groupNameMock,
  userName: vi.fn(),
  isActiveEventStatus: vi.fn((status: string | null | undefined) =>
    ['active', 'confirmed', 'member', 'admin'].includes(status ?? '')
  ),
  isActiveGroupStatus: vi.fn((status: string | null | undefined) =>
    ['active', 'member', 'admin'].includes(status ?? '')
  ),
  ensureEventConversation: mocks.ensureEventConversationMock,
  recomputeEventCounters: mocks.recomputeEventCountersMock,
  recomputeGroupCounters: mocks.recomputeGroupCountersMock,
  syncUserWithEventConversation: mocks.syncUserWithEventConversationMock,
}));

vi.mock('../../server-notify', () => ({
  fireNotification: mocks.fireNotificationMock,
}));

vi.mock('../../rbac/constants', () => ({
  DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE: {
    name: 'Guest',
    description: null,
    permissions: [],
    default_request_role: false,
    default_invite_role: false,
    assignee_kind: 'guest',
  },
  DEFAULT_EVENT_ROLES: [
    {
      name: 'Organizer',
      description: null,
      permissions: [],
      default_request_role: false,
      default_invite_role: false,
      assignee_kind: 'member',
    },
  ],
}));

vi.mock('../assembly-reconcile', () => ({
  reconcileGeneralAssemblyParticipantsForEvent:
    mocks.reconcileGeneralAssemblyParticipantsForEventMock,
}));

vi.mock('../delegate-allocation-reconcile', () => ({
  reconcileDelegateAllocationsForEvent: mocks.reconcileDelegateAllocationsForEventMock,
}));

vi.mock('../../groups/membership-helpers', () => ({
  loadGroupWithDerivedNetworkMeta: vi.fn(),
}));

vi.mock('@/features/events/logic/delegateAssemblyEligibility', () => ({
  canCreateDelegateAssemblyForGroup: vi.fn(() => true),
  DELEGATE_ASSEMBLY_GROUP_ELIGIBILITY_MESSAGE: 'Delegate assembly unavailable.',
}));

import { eventServerMutators } from '../server-mutators';

function createTx() {
  return {
    run: vi.fn(),
    mutate: {
      role: {
        insert: vi.fn(),
      },
      action_right: {
        insert: vi.fn(),
      },
      event_participant: {
        insert: vi.fn(),
        update: vi.fn(),
      },
      event_participant_role: {
        insert: vi.fn(),
        delete: vi.fn(),
      },
      conversation: {
        update: vi.fn(),
      },
    },
  };
}

function createCtx() {
  return {
    userID: 'user-1',
    email: 'user-1@example.com',
  };
}

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
});

describe('eventServerMutators group assignment notifications', () => {
  it('notifies group members when an event is created with a group assignment', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce(null).mockResolvedValueOnce([]);
    mocks.groupNameMock.mockResolvedValueOnce('Target group');

    await eventServerMutators.create.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'event-1',
        title: 'Planning Event',
        group_id: 'group-1',
      },
    });

    expect(mocks.fireNotificationMock).toHaveBeenCalledWith('notifyGroupEventAssigned', {
      senderId: 'user-1',
      groupId: 'group-1',
      groupName: 'Target group',
      eventId: 'event-1',
      eventTitle: 'Planning Event',
    });
  });

  it('notifies group members when an event is assigned to a new group', async () => {
    const tx = createTx();
    tx.run.mockResolvedValueOnce({
      id: 'event-1',
      title: 'Old title',
      group_id: null,
      event_type: null,
      attendance_mode: null,
      location_type: null,
    });
    mocks.eventTitleMock.mockResolvedValueOnce('Planning Event');
    mocks.groupNameMock.mockResolvedValueOnce('Target group');

    await eventServerMutators.update.fn({
      tx: tx as never,
      ctx: createCtx(),
      args: {
        id: 'event-1',
        group_id: 'group-1',
      },
    });

    expect(mocks.fireNotificationMock).toHaveBeenCalledWith('notifyGroupEventAssigned', {
      senderId: 'user-1',
      groupId: 'group-1',
      groupName: 'Target group',
      eventId: 'event-1',
      eventTitle: 'Planning Event',
    });
  });
});
