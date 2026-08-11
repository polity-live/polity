import { beforeEach, describe, expect, it, vi } from 'vitest';

const serverMocks = vi.hoisted(() => {
  type Row = Record<string, any>;
  type Operation = 'select' | 'update' | 'delete';

  const state = {
    tables: {} as Record<string, Row[]>,
    errors: {} as Record<string, Partial<Record<Operation | 'insert' | 'maybeSingle', unknown>>>,
    nullData: new Set<string>(),
  };
  const executePushDelivery = vi.fn(async () => undefined);
  const enqueueDirectPushDelivery = vi.fn(async () => undefined);

  function rowsFor(table: string) {
    state.tables[table] ??= [];
    return state.tables[table];
  }

  function createQuery(table: string) {
    const filters: ((row: Row) => boolean)[] = [];
    let operation: Operation = 'select';
    let patch: Row = {};
    let rowLimit: number | null = null;
    let descendingColumn: string | null = null;

    const filteredRows = () => {
      let rows = rowsFor(table).filter(row => filters.every(filter => filter(row)));
      if (descendingColumn) {
        rows = [...rows].sort((left, right) =>
          String(right[descendingColumn!]).localeCompare(String(left[descendingColumn!]))
        );
      }
      return rowLimit == null ? rows : rows.slice(0, rowLimit);
    };

    const execute = () => {
      const error = state.errors[table]?.[operation] ?? null;
      const data = filteredRows();
      if (!error && operation === 'update') Object.assign(data[0] ?? {}, patch);
      if (!error && operation === 'delete') {
        const doomed = new Set(data);
        state.tables[table] = rowsFor(table).filter(row => !doomed.has(row));
      }
      return { data: state.nullData.has(table) ? null : data, error };
    };

    const query: Record<string, any> = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push(row => row[column] === value);
        return query;
      }),
      neq: vi.fn((column: string, value: unknown) => {
        filters.push(row => row[column] !== value);
        return query;
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        filters.push(row => values.includes(row[column]));
        return query;
      }),
      is: vi.fn((column: string, value: unknown) => {
        filters.push(row => (row[column] ?? null) === value);
        return query;
      }),
      gte: vi.fn((column: string, value: unknown) => {
        filters.push(row => String(row[column]) >= String(value));
        return query;
      }),
      or: vi.fn(() => query),
      order: vi.fn((column: string, options?: { ascending?: boolean }) => {
        if (options?.ascending === false) descendingColumn = column;
        return query;
      }),
      limit: vi.fn((value: number) => {
        rowLimit = value;
        return query;
      }),
      update: vi.fn((value: Row) => {
        operation = 'update';
        patch = value;
        return query;
      }),
      delete: vi.fn(() => {
        operation = 'delete';
        return query;
      }),
      insert: vi.fn(async (input: Row | Row[]) => {
        const error = state.errors[table]?.insert ?? null;
        if (!error) {
          const rows = Array.isArray(input) ? input : [input];
          rowsFor(table).push(
            ...rows.map(row => ({
              created_at: row.created_at ?? new Date().toISOString(),
              ...row,
            }))
          );
        }
        return { data: null, error };
      }),
      maybeSingle: vi.fn(async () => {
        const result = execute();
        return {
          data: result.data?.[0] ?? null,
          error: state.errors[table]?.maybeSingle ?? result.error,
        };
      }),
      single: vi.fn(async () => {
        const result = execute();
        return { data: result.data?.[0] ?? null, error: result.error };
      }),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(execute()).then(resolve, reject),
    };
    return query;
  }

  const client = { from: vi.fn((table: string) => createQuery(table)) };
  return {
    state,
    client,
    createClient: vi.fn(() => client),
    executePushDelivery,
    enqueueDirectPushDelivery,
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: serverMocks.createClient,
}));

vi.mock('@/server/push-delivery-service', () => ({
  executePushDelivery: serverMocks.executePushDelivery,
  enqueueDirectPushDelivery: serverMocks.enqueueDirectPushDelivery,
}));

import {
  createNotification,
  notifyAgendaItemCreated,
  notifyCollaborationInvite,
  notifyCollaborationRequest,
  notifyEventInvite,
  notifyEventCancelled,
  notifyGroupEventAssigned,
  notifyGroupInvite,
  notifyBlogNewSubscriber,
  notifyBlogVoted,
  notifyAmendmentVoted,
  notifyMembershipRequest,
  notifyParticipationRequest,
  notifyProcessTaskCreated,
  notifyRelationshipApproved,
  notifyRelationshipRequested,
  notifyVotingCompleted,
  setNotificationDispatch,
} from '../notification-helpers';

function seedTables() {
  serverMocks.state.tables = {
    group: [{ id: 'group-1', owner_id: 'owner-user' }],
    group_membership: [
      { id: 'membership-manager', group_id: 'group-1', user_id: 'manager-user', status: 'active' },
      { id: 'membership-member', group_id: 'group-1', user_id: 'member-user', status: 'member' },
      { id: 'membership-sender', group_id: 'group-1', user_id: 'sender-user', status: 'admin' },
    ],
    group_membership_role: [
      { group_membership_id: 'membership-manager', role_id: 'role-all-manage' },
      { group_membership_id: 'membership-member', role_id: 'role-view' },
      { group_membership_id: 'membership-sender', role_id: 'role-all-manage' },
      { group_membership_id: 'membership-missing', role_id: 'role-all-manage' },
    ],
    group_guest_access: [
      { id: 'guest-manager', group_id: 'group-1', user_id: 'guest-user', status: 'active' },
      { id: 'guest-sender', group_id: 'group-1', user_id: 'sender-user', status: 'active' },
      { id: 'guest-null', group_id: 'group-1', user_id: null, status: 'active' },
    ],
    group_guest_role: [
      { group_guest_access_id: 'guest-manager', role_id: 'role-all-manage' },
      { group_guest_access_id: 'guest-sender', role_id: 'role-all-manage' },
      { group_guest_access_id: 'guest-null', role_id: 'role-all-manage' },
      { group_guest_access_id: 'guest-missing', role_id: 'role-all-manage' },
    ],
    event: [{ id: 'event-1', creator_id: 'event-owner' }],
    event_participant: [
      {
        id: 'participant-manager',
        event_id: 'event-1',
        user_id: 'event-manager',
        status: 'active',
      },
      {
        id: 'participant-member',
        event_id: 'event-1',
        user_id: 'event-member',
        status: 'confirmed',
      },
      { id: 'participant-sender', event_id: 'event-1', user_id: 'sender-user', status: 'admin' },
    ],
    event_participant_role: [
      { event_participant_id: 'participant-manager', role_id: 'role-event-manage' },
      { event_participant_id: 'participant-member', role_id: 'role-view' },
      { event_participant_id: 'participant-sender', role_id: 'role-event-manage' },
      { event_participant_id: 'participant-missing', role_id: 'role-event-manage' },
    ],
    amendment: [{ id: 'amendment-1', created_by_id: 'amendment-owner' }],
    amendment_collaborator: [
      {
        amendment_id: 'amendment-1',
        user_id: 'amendment-manager',
        status: 'collaborator',
        role_id: 'role-amendment-manage',
      },
      {
        amendment_id: 'amendment-1',
        user_id: 'sender-user',
        status: 'active',
        role_id: 'role-amendment-manage',
      },
    ],
    action_right: [
      {
        role_id: 'role-all-manage',
        group_id: 'group-1',
        resource: 'groupRelationships',
        action: 'manage',
      },
      {
        role_id: 'role-all-manage',
        group_id: 'group-1',
        resource: 'groups',
        action: 'manage_members',
      },
      {
        role_id: 'role-all-manage',
        group_id: 'group-1',
        resource: 'events',
        action: 'manage_votes',
      },
      {
        role_id: 'role-event-manage',
        event_id: 'event-1',
        resource: 'events',
        action: 'manage_participants',
      },
      {
        role_id: 'role-amendment-manage',
        amendment_id: 'amendment-1',
        resource: 'amendments',
        action: 'manage',
      },
      { role_id: null, resource: 'events', action: 'view' },
    ],
    notification_setting: [
      {
        id: 'setting-invitee',
        user_id: 'invitee-user',
        group_notifications: {},
        event_notifications: {},
        amendment_notifications: {},
        blog_notifications: {},
        todo_notifications: {},
        social_notifications: {},
        delivery_settings: { inAppNotifications: true, pushNotifications: true },
        timeline_settings: {},
      },
      {
        id: 'setting-owner',
        user_id: 'owner-user',
        groupNotifications: {},
        eventNotifications: {},
        amendmentNotifications: {},
        blogNotifications: {},
        todoNotifications: {},
        socialNotifications: {},
        deliverySettings: { inAppNotifications: true },
        timelineSettings: {},
      },
      {
        user_id: 'push-only-user',
        delivery_settings: { inAppNotifications: false, pushNotifications: true },
      },
      {
        user_id: 'muted-user',
        group_notifications: { newEvents: false },
        delivery_settings: { inAppNotifications: true, pushNotifications: false },
      },
    ],
    user: [
      {
        id: 'sender-user',
        first_name: 'Sender',
        last_name: 'User',
        email: 'sender@example.com',
      },
      { id: 'email-user', first_name: '', last_name: '', email: 'email@example.com' },
      { id: 'nameless-user', first_name: '', last_name: '', email: '' },
    ],
    notification: [],
    notification_user_state: [{ notification_id: 'unused' }],
    notification_read: [{ notification_id: 'unused' }],
  };
  serverMocks.state.errors = {};
  serverMocks.state.nullData.clear();
}

describe('server notification audiences', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    setNotificationDispatch(null);
    seedTables();
    vi.clearAllMocks();
  });

  it('fans out group, event, amendment, member, participant, and relationship audiences', async () => {
    await notifyGroupInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      groupId: 'group-1',
      groupName: 'Group One',
    });
    await notifyMembershipRequest({
      senderId: 'sender-user',
      senderName: 'Sender User',
      groupId: 'group-1',
      groupName: 'Group One',
    });
    await notifyEventInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
    });
    await notifyParticipationRequest({
      senderId: 'sender-user',
      senderName: 'Sender User',
      eventId: 'event-1',
      eventTitle: 'Event One',
    });
    await notifyCollaborationInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment One',
    });
    await notifyCollaborationRequest({
      senderId: 'sender-user',
      senderName: 'Sender User',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment One',
    });
    await notifyGroupEventAssigned({
      senderId: 'sender-user',
      groupId: 'group-1',
      groupName: 'Group One',
      eventId: 'event-1',
      eventTitle: 'Event One',
    });
    await notifyAgendaItemCreated({
      senderId: 'sender-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
      agendaItemTitle: 'Agenda Item',
    });

    await notifyRelationshipRequested({
      senderId: 'sender-user',
      sourceGroupId: 'source-group',
      sourceGroupName: 'Source Group',
      targetGroupId: 'group-1',
      targetGroupName: 'Target Group',
      relationshipType: 'cooperation',
    });
    await notifyRelationshipRequested({
      senderId: 'sender-user',
      sourceGroupId: 'group-1',
      sourceGroupName: 'Source Group',
      targetGroupId: 'target-group',
      targetGroupName: 'Target Group',
      relationshipType: 'network',
      recipientGroupId: 'group-1',
    });
    await notifyRelationshipApproved({
      senderId: 'sender-user',
      sourceGroupId: 'group-1',
      sourceGroupName: 'Source Group',
      targetGroupId: 'target-group',
      targetGroupName: 'Target Group',
    });
    await notifyRelationshipApproved({
      senderId: 'sender-user',
      sourceGroupId: 'group-1',
      sourceGroupName: 'Source Group',
      targetGroupId: 'target-group',
      targetGroupName: 'Target Group updated',
    });

    const recipients = serverMocks.state.tables.notification.map(row => row.recipient_id);
    expect(recipients).toContain('owner-user');
    expect(recipients).toContain('manager-user');
    expect(recipients).toContain('guest-user');
    expect(recipients).toContain('event-owner');
    expect(recipients).toContain('event-manager');
    expect(recipients).toContain('amendment-owner');
    expect(recipients).toContain('amendment-manager');
    expect(recipients).toContain('member-user');
    expect(recipients).toContain('event-member');
    expect(serverMocks.executePushDelivery).toHaveBeenCalled();
  });

  it('handles direct push, muted types, self personalization, generic entity keys, and dispatch errors', async () => {
    await createNotification({
      senderId: 'sender-user',
      recipientUserId: 'push-only-user',
      type: 'direct_message',
      title: 'Direct',
      message: 'Direct message',
    });
    expect(serverMocks.enqueueDirectPushDelivery).toHaveBeenCalledWith(
      'push-only-user',
      expect.any(String),
      expect.objectContaining({ title: 'Direct' })
    );

    const beforeMuted = serverMocks.state.tables.notification.length;
    await createNotification({
      senderId: 'sender-user',
      recipientUserId: 'muted-user',
      type: 'group_new_event',
      title: 'Muted',
      message: 'Muted',
    });
    expect(serverMocks.state.tables.notification).toHaveLength(beforeMuted);

    await createNotification({
      senderId: 'email-user',
      recipientUserId: 'email-user',
      type: 'membership_request',
      title: 'Self',
      message: 'email@example.com has requested access',
    });
    await createNotification({
      senderId: 'nameless-user',
      recipientUserId: 'nameless-user',
      type: 'membership_request',
      title: 'Nameless',
      message: 'No actor name',
    });
    serverMocks.state.tables.notification_setting.push({ user_id: 'empty-settings-user' });
    await createNotification({
      senderId: 'sender-user',
      recipientUserId: 'empty-settings-user',
      type: 'direct_message',
      title: 'Empty settings',
      message: 'Empty settings',
    });
    await createNotification({
      senderId: 'sender-user',
      recipientEntityType: 'user',
      recipientEntityId: 'entity-user',
      onBehalfOfEntityType: 'user',
      onBehalfOfEntityId: 'behalf-user',
      type: 'profile_mention',
      title: 'Generic entity',
      message: 'Generic entity',
    });

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setNotificationDispatch(async () => {
      throw new Error('dispatch failed');
    });
    await createNotification({
      senderId: 'sender-user',
      type: 'direct_message',
      title: 'Client failure',
      message: 'Client failure',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[Notification] Failed to create notification:',
      expect.any(Error)
    );
  });

  it('logs query, insert, personalization, and immediate push failures without rejecting callers', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const queryError = new Error('query failed');
    for (const table of [
      'group',
      'group_membership',
      'group_membership_role',
      'group_guest_access',
      'group_guest_role',
      'event',
      'event_participant',
      'event_participant_role',
      'amendment',
      'amendment_collaborator',
      'action_right',
    ]) {
      serverMocks.state.errors[table] = { select: queryError };
    }
    serverMocks.state.errors.notification_setting = {
      maybeSingle: new Error('settings failed'),
    };
    serverMocks.state.errors.user = { maybeSingle: new Error('user failed') };
    serverMocks.state.errors.notification = { insert: new Error('insert failed') };

    await notifyGroupInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      groupId: 'group-1',
      groupName: 'Group One',
    });
    await notifyMembershipRequest({
      senderId: 'sender-user',
      senderName: 'Sender User',
      groupId: 'group-1',
      groupName: 'Group One',
    });
    await notifyEventInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
    });
    await notifyCollaborationInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment One',
    });
    await notifyProcessTaskCreated({
      senderId: 'sender-user',
      groupId: 'group-1',
      groupName: 'Group One',
      taskTitle: 'Task One',
    });
    await notifyGroupEventAssigned({
      senderId: 'sender-user',
      groupId: 'group-1',
      groupName: 'Group One',
      eventId: 'event-1',
      eventTitle: 'Event One',
    });
    await notifyAgendaItemCreated({
      senderId: 'sender-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
      agendaItemTitle: 'Agenda One',
    });
    await notifyRelationshipRequested({
      senderId: 'sender-user',
      sourceGroupId: 'source-group',
      sourceGroupName: 'Source Group',
      targetGroupId: 'group-1',
      targetGroupName: 'Group One',
      relationshipType: 'network',
    });
    expect(consoleError).toHaveBeenCalled();

    serverMocks.state.errors.notification = {};
    serverMocks.executePushDelivery.mockRejectedValueOnce(new Error('push failed'));
    await createNotification({
      senderId: 'sender-user',
      recipientUserId: 'plain-user',
      type: 'direct_message',
      title: 'Push failure',
      message: 'Push failure',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[Notification] Immediate push delivery failed:',
      expect.any(Error)
    );
  });

  it('handles empty and null loader results plus empty role-id sets', async () => {
    serverMocks.state.tables.group = [];
    serverMocks.state.tables.group_membership = [];
    serverMocks.state.tables.group_guest_access = [];
    serverMocks.state.tables.event = [];
    serverMocks.state.tables.event_participant = [];
    serverMocks.state.tables.amendment = [];
    serverMocks.state.tables.amendment_collaborator = [];
    serverMocks.state.nullData = new Set([
      'group',
      'group_membership',
      'group_guest_access',
      'event',
      'event_participant',
      'amendment',
      'amendment_collaborator',
    ]);

    await notifyGroupInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      groupId: 'group-1',
      groupName: 'Group One',
    });
    await notifyEventInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
    });
    await notifyCollaborationInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment One',
    });
    await notifyProcessTaskCreated({
      senderId: 'sender-user',
      groupId: 'group-1',
      groupName: 'Group One',
      taskTitle: 'Task One',
    });
    await notifyGroupEventAssigned({
      senderId: 'sender-user',
      groupId: 'group-1',
      groupName: 'Group One',
      eventId: 'event-1',
      eventTitle: 'Event One',
    });
    await notifyAgendaItemCreated({
      senderId: 'sender-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
      agendaItemTitle: 'Agenda One',
    });
    await notifyRelationshipRequested({
      senderId: 'sender-user',
      sourceGroupId: 'source-group',
      sourceGroupName: 'Source Group',
      targetGroupId: 'group-1',
      targetGroupName: 'Group One',
      relationshipType: 'network',
    });

    seedTables();
    serverMocks.state.tables.group_membership_role = [
      { group_membership_id: 'membership-manager', role_id: null },
    ];
    serverMocks.state.tables.group_guest_role = [
      { group_guest_access_id: 'guest-manager', role_id: null },
    ];
    serverMocks.state.tables.event_participant_role = [
      { event_participant_id: 'participant-manager', role_id: null },
    ];
    serverMocks.state.tables.amendment_collaborator = [
      {
        amendment_id: 'amendment-1',
        user_id: 'amendment-manager',
        status: 'active',
        role_id: null,
      },
    ];
    await notifyGroupInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      groupId: 'group-1',
      groupName: 'Group One',
    });
    await notifyRelationshipRequested({
      senderId: 'sender-user',
      sourceGroupId: 'source-group',
      sourceGroupName: 'Source Group',
      targetGroupId: 'group-1',
      targetGroupName: 'Group One',
      relationshipType: 'network',
    });
    await notifyEventInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
    });
    await notifyCollaborationInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment One',
    });
    await notifyProcessTaskCreated({
      senderId: 'sender-user',
      groupId: 'group-1',
      groupName: 'Group One',
      taskTitle: 'Task One',
    });

    seedTables();
    serverMocks.state.nullData = new Set([
      'group_membership_role',
      'group_guest_role',
      'event_participant_role',
    ]);
    await notifyGroupInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      groupId: 'group-1',
      groupName: 'Group One',
    });
    await notifyRelationshipRequested({
      senderId: 'sender-user',
      sourceGroupId: 'source-group',
      sourceGroupName: 'Source Group',
      targetGroupId: 'group-1',
      targetGroupName: 'Group One',
      relationshipType: 'network',
    });
    await notifyEventInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
    });
    await notifyProcessTaskCreated({
      senderId: 'sender-user',
      groupId: 'group-1',
      groupName: 'Group One',
      taskTitle: 'Task One',
    });

    seedTables();
    serverMocks.state.nullData.add('action_right');
    await notifyGroupInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      groupId: 'group-1',
      groupName: 'Group One',
    });
    await notifyRelationshipRequested({
      senderId: 'sender-user',
      sourceGroupId: 'source-group',
      sourceGroupName: 'Source Group',
      targetGroupId: 'group-1',
      targetGroupName: 'Group One',
      relationshipType: 'network',
    });
    await notifyEventInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
    });
    await notifyCollaborationInvite({
      senderId: 'sender-user',
      recipientUserId: 'invitee-user',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment One',
    });
    await notifyProcessTaskCreated({
      senderId: 'sender-user',
      groupId: 'group-1',
      groupName: 'Group One',
      taskTitle: 'Task One',
    });
  });

  it('covers relationship lookup and reset failures and disabled recipient preferences', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    serverMocks.state.tables.notification_setting.push({
      user_id: 'manager-user',
      group_notifications: { newRelationships: false },
      delivery_settings: { inAppNotifications: true },
    });
    await notifyRelationshipApproved({
      senderId: 'sender-user',
      sourceGroupId: 'group-1',
      sourceGroupName: 'Source Group',
      targetGroupId: 'target-group',
      targetGroupName: 'Target Group',
    });

    serverMocks.state.errors.notification = { maybeSingle: new Error('lookup failed') };
    await notifyRelationshipApproved({
      senderId: 'sender-user',
      sourceGroupId: 'group-1',
      sourceGroupName: 'Source Group',
      targetGroupId: 'target-group',
      targetGroupName: 'Lookup Error',
    });
    serverMocks.state.errors.notification = { update: new Error('update failed') };
    await notifyRelationshipApproved({
      senderId: 'sender-user',
      sourceGroupId: 'group-1',
      sourceGroupName: 'Source Group',
      targetGroupId: 'target-group',
      targetGroupName: 'Update Error',
    });
    serverMocks.state.errors.notification = {};
    serverMocks.state.errors.notification_user_state = { delete: new Error('state failed') };
    serverMocks.state.errors.notification_read = { delete: new Error('read failed') };
    await notifyRelationshipApproved({
      senderId: 'sender-user',
      sourceGroupId: 'group-1',
      sourceGroupName: 'Source Group',
      targetGroupId: 'target-group',
      targetGroupName: 'Reset Error',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[Notification] Failed to find recent relationship notification:',
      expect.any(Error)
    );
    expect(consoleError).toHaveBeenCalledWith(
      '[Notification] Failed to update relationship notification:',
      expect.any(Error)
    );
    expect(consoleError).toHaveBeenCalledWith(
      '[Notification] Failed to reset relationship notification state:',
      expect.any(Error)
    );
    expect(consoleError).toHaveBeenCalledWith(
      '[Notification] Failed to reset legacy notification read state:',
      expect.any(Error)
    );
  });

  it('filters sender and empty guest identities from process-task manager fanout', async () => {
    serverMocks.state.tables.group = [{ id: 'group-1', owner_id: 'sender-user' }];
    serverMocks.state.tables.group_membership = [];
    serverMocks.state.tables.group_membership_role = [];
    serverMocks.state.tables.group_guest_access = [
      { id: 'guest-valid', group_id: 'group-1', user_id: 'guest-user', status: 'active' },
      { id: 'guest-sender', group_id: 'group-1', user_id: 'sender-user', status: 'active' },
      { id: 'guest-empty', group_id: 'group-1', user_id: null, status: 'active' },
    ];
    serverMocks.state.tables.group_guest_role = [
      { group_guest_access_id: 'guest-valid', role_id: 'role-all-manage' },
      { group_guest_access_id: 'guest-sender', role_id: 'role-all-manage' },
      { group_guest_access_id: 'guest-empty', role_id: 'role-all-manage' },
    ];
    serverMocks.state.tables.notification = [];
    await notifyProcessTaskCreated({
      senderId: 'sender-user',
      groupId: 'group-1',
      groupName: 'Group One',
      taskTitle: 'Task One',
    });
    const personalRecipients = serverMocks.state.tables.notification
      .map(row => row.recipient_id)
      .filter(Boolean);
    expect(personalRecipients).toEqual(['guest-user']);
  });

  it('covers remaining builder alternatives through injected dispatch', async () => {
    const dispatched: unknown[] = [];
    setNotificationDispatch(async input => {
      dispatched.push(input);
    });
    await notifyVotingCompleted({
      senderId: 'sender-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
      agendaItemTitle: 'Agenda One',
      result: 'passed',
      acceptVotes: 2,
      rejectVotes: 1,
    });
    await notifyVotingCompleted({
      senderId: 'sender-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
      agendaItemTitle: 'Agenda One',
      result: 'rejected',
      acceptVotes: 1,
      rejectVotes: 2,
    });
    await notifyEventCancelled({
      senderId: 'sender-user',
      eventId: 'event-1',
      eventTitle: 'Event One',
      cancellationReason: 'Weather',
    });
    await notifyAmendmentVoted({
      senderId: 'sender-user',
      senderName: 'Sender User',
      recipientUserId: 'recipient-user',
      amendmentId: 'amendment-1',
      amendmentTitle: 'Amendment One',
      voteType: 'upvote',
    });
    await notifyBlogVoted({
      senderId: 'sender-user',
      senderName: 'Sender User',
      recipientUserId: 'recipient-user',
      blogId: 'blog-1',
      blogTitle: 'Blog One',
      voteType: 'upvote',
      ownerId: 'owner-user',
    });
    await notifyBlogNewSubscriber({
      senderId: 'sender-user',
      senderName: 'Sender User',
      blogId: 'blog-1',
      blogTitle: 'Blog One',
      ownerId: 'owner-user',
    });
    expect(dispatched.length).toBeGreaterThan(5);
  });
});
