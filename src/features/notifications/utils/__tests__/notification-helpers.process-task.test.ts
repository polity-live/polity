import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  type Row = Record<string, unknown>;

  const state = {
    tables: {} as Record<string, Row[]>,
  };

  function rowsFor(table: string) {
    state.tables[table] ??= [];
    return state.tables[table];
  }

  function createQuery(table: string) {
    const filters: ((row: Row) => boolean)[] = [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push(row => row[column] === value);
        return query;
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        filters.push(row => values.includes(row[column]));
        return query;
      }),
      maybeSingle: vi.fn(async () => ({
        data: rowsFor(table).filter(row => filters.every(filter => filter(row)))[0] ?? null,
        error: null,
      })),
      insert: vi.fn(async (input: Row) => {
        rowsFor(table).push(input);
        return { error: null };
      }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown, reject?: () => unknown) =>
        Promise.resolve({
          data: rowsFor(table).filter(row => filters.every(filter => filter(row))),
          error: null,
        }).then(resolve, reject),
    };

    return query;
  }

  return {
    state,
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => createQuery(table)),
    })),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMock.createClient,
}));

import {
  notifyElectionEnded,
  notifyElectionStarted,
  notifyGroupAmendmentSupportConfirmed,
  notifyGroupEventAssigned,
  notifyProcessTaskCreated,
  notifyVotingCompleted,
  notifyVotingPhaseStarted,
} from '../notification-helpers';

describe('notifyProcessTaskCreated', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    supabaseMock.state.tables = {
      group: [{ id: 'group-1', owner_id: 'owner-user' }],
      group_membership: [
        { id: 'membership-1', group_id: 'group-1', user_id: 'member-user', status: 'active' },
        { id: 'membership-2', group_id: 'group-1', user_id: 'muted-user', status: 'active' },
        { id: 'membership-3', group_id: 'group-1', user_id: 'viewer-user', status: 'active' },
        { id: 'membership-4', group_id: 'group-1', user_id: 'actor-user', status: 'active' },
      ],
      group_membership_role: [
        { group_membership_id: 'membership-1', role_id: 'role-manage' },
        { group_membership_id: 'membership-2', role_id: 'role-manage' },
        { group_membership_id: 'membership-3', role_id: 'role-view' },
        { group_membership_id: 'membership-4', role_id: 'role-manage' },
      ],
      group_guest_access: [
        { id: 'guest-1', group_id: 'group-1', user_id: 'guest-user', status: 'active' },
      ],
      group_guest_role: [{ group_guest_access_id: 'guest-1', role_id: 'role-votes' }],
      action_right: [
        { role_id: 'role-manage', group_id: 'group-1', resource: 'events', action: 'manage' },
        { role_id: 'role-votes', group_id: 'group-1', resource: 'events', action: 'manage_votes' },
        { role_id: 'role-view', group_id: 'group-1', resource: 'events', action: 'view' },
      ],
      notification_setting: [
        {
          user_id: 'muted-user',
          deliverySettings: { inAppNotifications: true },
          groupNotifications: { tasksAssigned: false },
        },
        {
          user_id: 'guest-user',
          deliverySettings: { inAppNotifications: false },
          groupNotifications: { tasksAssigned: true },
        },
      ],
      notification: [],
    };
  });

  it('creates one group entry and personal copies for eligible recipients that allow task notifications', async () => {
    await notifyProcessTaskCreated({
      senderId: 'actor-user',
      groupId: 'group-1',
      groupName: 'Target Group',
      taskTitle: 'Manual assignment',
    });

    const notifications = supabaseMock.state.tables.notification;
    expect(notifications).toHaveLength(3);
    expect(notifications[0]).toMatchObject({
      recipient_id: null,
      recipient_entity_type: 'group',
      recipient_group_id: 'group-1',
      related_group_id: 'group-1',
      action_url: '/group/group-1/memberships?tab=openAssignments',
      type: 'group_process_task_created',
    });
    expect(
      notifications
        .slice(1)
        .map(notification => notification.recipient_id)
        .sort()
    ).toEqual(['member-user', 'owner-user']);
    expect(notifications.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipient_id: 'owner-user',
          on_behalf_of_entity_type: 'group',
          on_behalf_of_group_id: 'group-1',
          recipient_group_id: null,
        }),
        expect.objectContaining({
          recipient_id: 'member-user',
          on_behalf_of_entity_type: 'group',
          on_behalf_of_group_id: 'group-1',
          recipient_group_id: null,
        }),
      ])
    );
  });
});

describe('group member notification fanout', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    supabaseMock.state.tables = {
      group: [{ id: 'group-1', owner_id: 'owner-user' }],
      group_membership: [
        { id: 'membership-1', group_id: 'group-1', user_id: 'actor-user', status: 'active' },
        { id: 'membership-2', group_id: 'group-1', user_id: 'member-user', status: 'member' },
        { id: 'membership-3', group_id: 'group-1', user_id: 'admin-user', status: 'admin' },
        { id: 'membership-4', group_id: 'group-1', user_id: 'requested-user', status: 'requested' },
      ],
      group_guest_access: [
        { id: 'guest-1', group_id: 'group-1', user_id: 'guest-user', status: 'active' },
      ],
      notification_setting: [
        {
          user_id: 'member-user',
          deliverySettings: { inAppNotifications: true },
          groupNotifications: { newEvents: false, newAmendments: false },
        },
      ],
      notification: [],
    };
  });

  it('creates a group row and personal member copies when an event is assigned', async () => {
    await notifyGroupEventAssigned({
      senderId: 'actor-user',
      groupId: 'group-1',
      groupName: 'Target Group',
      eventId: 'event-1',
      eventTitle: 'Planning Event',
    });

    const notifications = supabaseMock.state.tables.notification;
    expect(notifications).toHaveLength(4);
    expect(notifications[0]).toMatchObject({
      recipient_id: null,
      recipient_entity_type: 'group',
      recipient_group_id: 'group-1',
      related_group_id: 'group-1',
      related_event_id: 'event-1',
      action_url: '/event/event-1',
      type: 'group_event_assigned',
    });
    expect(
      notifications
        .slice(1)
        .map(notification => notification.recipient_id)
        .sort()
    ).toEqual(['actor-user', 'admin-user', 'owner-user']);
    expect(notifications.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipient_id: 'actor-user',
          on_behalf_of_entity_type: 'group',
          on_behalf_of_group_id: 'group-1',
          recipient_group_id: null,
          type: 'group_event_assigned',
        }),
        expect.objectContaining({
          recipient_id: 'owner-user',
          on_behalf_of_entity_type: 'group',
          on_behalf_of_group_id: 'group-1',
          recipient_group_id: null,
          type: 'group_event_assigned',
        }),
      ])
    );
  });

  it('creates a group row and personal member copies when amendment support is confirmed', async () => {
    await notifyGroupAmendmentSupportConfirmed({
      senderId: 'actor-user',
      groupId: 'group-1',
      groupName: 'Target Group',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Safer Streets',
      eventId: 'event-1',
      eventTitle: 'Planning Event',
    });

    const notifications = supabaseMock.state.tables.notification;
    expect(notifications).toHaveLength(4);
    expect(notifications[0]).toMatchObject({
      recipient_id: null,
      recipient_entity_type: 'group',
      recipient_group_id: 'group-1',
      related_group_id: 'group-1',
      related_amendment_id: 'amendment-1',
      related_event_id: 'event-1',
      action_url: '/event/event-1/agenda',
      type: 'group_amendment_support_confirmed',
    });
    expect(
      notifications
        .slice(1)
        .map(notification => notification.recipient_id)
        .sort()
    ).toEqual(['actor-user', 'admin-user', 'owner-user']);
  });
});

describe('event participant notification fanout', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    supabaseMock.state.tables = {
      event_participant: [
        { event_id: 'event-1', user_id: 'actor-user', status: 'active' },
        { event_id: 'event-1', user_id: 'confirmed-user', status: 'confirmed' },
        { event_id: 'event-1', user_id: 'requested-user', status: 'requested' },
      ],
      notification: [],
    };
  });

  it.each([
    {
      helper: 'notifyElectionStarted',
      type: 'event_election_started',
      run: () =>
        notifyElectionStarted({
          senderId: 'actor-user',
          eventId: 'event-1',
          eventTitle: 'Event One',
          electionTitle: 'Election One',
        }),
    },
    {
      helper: 'notifyElectionEnded',
      type: 'event_election_ended',
      run: () =>
        notifyElectionEnded({
          senderId: 'actor-user',
          eventId: 'event-1',
          eventTitle: 'Event One',
          electionTitle: 'Election One',
        }),
    },
    {
      helper: 'notifyVotingPhaseStarted',
      type: 'voting_phase_started',
      run: () =>
        notifyVotingPhaseStarted({
          senderId: 'actor-user',
          eventId: 'event-1',
          eventTitle: 'Event One',
          agendaItemTitle: 'Agenda Item One',
          votingType: 'final',
        }),
    },
    {
      helper: 'notifyVotingCompleted',
      type: 'voting_completed',
      run: () =>
        notifyVotingCompleted({
          senderId: 'actor-user',
          eventId: 'event-1',
          eventTitle: 'Event One',
          agendaItemTitle: 'Agenda Item One',
          result: 'passed',
          acceptVotes: 2,
          rejectVotes: 1,
        }),
    },
  ])('creates event row and personal participant copies for $helper', async ({ run, type }) => {
    await run();

    const notifications = supabaseMock.state.tables.notification;
    expect(notifications).toHaveLength(3);
    expect(notifications[0]).toMatchObject({
      recipient_id: null,
      recipient_entity_type: 'event',
      recipient_event_id: 'event-1',
      related_event_id: 'event-1',
      type,
    });
    expect(
      notifications
        .slice(1)
        .map(notification => notification.recipient_id)
        .sort()
    ).toEqual(['actor-user', 'confirmed-user']);
    expect(notifications.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipient_id: 'actor-user',
          on_behalf_of_entity_type: 'event',
          on_behalf_of_event_id: 'event-1',
          recipient_event_id: null,
          type,
        }),
        expect.objectContaining({
          recipient_id: 'confirmed-user',
          on_behalf_of_entity_type: 'event',
          on_behalf_of_event_id: 'event-1',
          recipient_event_id: null,
          type,
        }),
      ])
    );
  });
});
