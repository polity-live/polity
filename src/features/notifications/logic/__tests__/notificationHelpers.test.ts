import { describe, expect, it } from 'vitest';
import type { Notification } from '../../types/notification.types';
import {
  collectAmendmentCollaboratorManagerRecipientIds,
  collectEventParticipantManagerRecipientIds,
  collectEventParticipantRecipientIds,
  collectGroupMemberRecipientIds,
  collectGroupMembershipManagerRecipientIds,
  collectProcessTaskEventManagerRecipientIds,
  collectRelationshipManagerRecipientIds,
} from '../../utils/notification-helpers';
import {
  filterAccessibleNotifications,
  getNotificationNavigationTarget,
} from '../notificationHelpers';

function createNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    recipient_id: 'user-recipient',
    sender_id: 'user-sender',
    title: 'Test notification',
    message: 'Test message',
    type: 'event_invite',
    action_url: null,
    is_read: false,
    related_entity_type: null,
    on_behalf_of_entity_type: null,
    on_behalf_of_entity_id: null,
    recipient_entity_type: null,
    recipient_entity_id: null,
    related_user_id: null,
    related_group_id: null,
    related_amendment_id: null,
    related_event_id: null,
    related_blog_id: null,
    on_behalf_of_group_id: null,
    on_behalf_of_event_id: null,
    on_behalf_of_amendment_id: null,
    on_behalf_of_blog_id: null,
    recipient_group_id: null,
    recipient_event_id: null,
    recipient_amendment_id: null,
    recipient_blog_id: null,
    category: null,
    created_at: Date.now(),
    ...overrides,
  } as Notification;
}

function notificationOverrides(overrides: unknown): Partial<Notification> {
  return overrides as Partial<Notification>;
}

describe('getNotificationNavigationTarget', () => {
  it('routes event invites to memberships page', () => {
    const target = getNotificationNavigationTarget(
      createNotification({
        type: 'event_invite',
        recipient_id: 'user-123',
        action_url: '/event/event-42/participants',
      })
    );

    expect(target).toEqual({
      kind: 'route',
      to: '/user/user-123/memberships',
    });
  });

  it('preserves messages deep links from action url', () => {
    const target = getNotificationNavigationTarget(
      createNotification({
        type: 'direct_message',
        action_url: '/messages?conversationId=conv-99&name=Test',
      })
    );

    expect(target).toEqual({
      kind: 'messages',
      search: {
        conversationId: 'conv-99',
        name: 'Test',
        new: undefined,
        openAriaKai: undefined,
        search: undefined,
        userId: undefined,
        userSearch: undefined,
      },
    });
  });

  it('uses generic route fallback for other action urls', () => {
    const target = getNotificationNavigationTarget(
      createNotification({
        type: 'membership_request',
        action_url: '/group/group-1/memberships',
      })
    );

    expect(target).toEqual({
      kind: 'route',
      to: '/group/group-1/memberships',
    });
  });

  it('preserves route action url search parameters', () => {
    const target = getNotificationNavigationTarget(
      createNotification({
        type: 'group_connection_request',
        action_url: '/group/group-1/network?tab=manage-network',
      })
    );

    expect(target).toEqual({
      kind: 'route',
      to: '/group/group-1/network?tab=manage-network',
    });
  });
});

describe('filterAccessibleNotifications', () => {
  it('keeps direct personal notifications for the current user', () => {
    const result = filterAccessibleNotifications(
      [
        createNotification(
          notificationOverrides({
            recipient: { id: 'user-1' },
          })
        ),
        createNotification(
          notificationOverrides({
            id: 'notif-2',
            recipient: { id: 'user-2' },
          })
        ),
      ],
      'user-1'
    );

    expect(result.map(notification => notification.id)).toEqual(['notif-1']);
  });

  it('keeps group entity notifications when the user has notification rights', () => {
    const result = filterAccessibleNotifications(
      [
        createNotification(
          notificationOverrides({
            recipient_group: {
              memberships: [
                {
                  membership_roles: [
                    {
                      role: {
                        action_rights: [
                          {
                            resource: 'groupNotifications',
                            action: 'viewNotifications',
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          })
        ),
      ],
      'user-1'
    );

    expect(result).toHaveLength(1);
  });

  it('filters entity notifications when the user lacks notification rights', () => {
    const result = filterAccessibleNotifications(
      [
        createNotification(
          notificationOverrides({
            recipient_event: {
              participants: [
                {
                  participant_roles: [
                    {
                      role: {
                        action_rights: [
                          {
                            resource: 'events',
                            action: 'view',
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          })
        ),
      ],
      'user-1'
    );

    expect(result).toEqual([]);
  });
});

describe('collectRelationshipManagerRecipientIds', () => {
  it('collects owners, active membership managers, and active guest managers', () => {
    const recipients = collectRelationshipManagerRecipientIds(
      {
        owner_id: 'owner-user',
        memberships: [
          {
            user_id: 'member-manager',
            status: 'active',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupRelationships', action: 'manage' }],
                },
              },
            ],
          },
          {
            user_id: 'member-viewer',
            status: 'active',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupRelationships', action: 'view' }],
                },
              },
            ],
          },
          {
            user_id: 'requested-manager',
            status: 'requested',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupRelationships', action: 'manage' }],
                },
              },
            ],
          },
        ],
        guest_accesses: [
          {
            user_id: 'guest-manager',
            status: 'active',
            guest_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupRelationships', action: 'manage' }],
                },
              },
            ],
          },
          {
            user_id: 'revoked-guest-manager',
            status: 'revoked',
            guest_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupRelationships', action: 'manage' }],
                },
              },
            ],
          },
        ],
      },
      'actor-user'
    );

    expect(recipients.sort()).toEqual(['guest-manager', 'member-manager', 'owner-user']);
  });

  it('deduplicates recipients and excludes the actor', () => {
    const recipients = collectRelationshipManagerRecipientIds(
      {
        owner_id: 'actor-user',
        memberships: [
          {
            user_id: 'manager-user',
            status: 'admin',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupRelationships', action: 'manage' }],
                },
              },
            ],
          },
        ],
        guest_accesses: [
          {
            user_id: 'manager-user',
            status: 'active',
            guest_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupRelationships', action: 'manage' }],
                },
              },
            ],
          },
        ],
      },
      'actor-user'
    );

    expect(recipients).toEqual(['manager-user']);
  });
});

describe('collectEventParticipantRecipientIds', () => {
  it('collects distinct active event participants', () => {
    const recipients = collectEventParticipantRecipientIds([
      { user_id: 'active-user', status: 'active' },
      { user_id: 'confirmed-user', status: 'confirmed' },
      { user_id: 'member-user', status: 'member' },
      { user_id: 'admin-user', status: 'admin' },
      { user_id: 'requested-user', status: 'requested' },
      { user_id: 'invited-user', status: 'invited' },
      { user_id: 'active-user', status: 'active' },
      { user_id: null, status: 'active' },
    ]);

    expect(recipients.sort()).toEqual([
      'active-user',
      'admin-user',
      'confirmed-user',
      'member-user',
    ]);
  });
});

describe('collectGroupMemberRecipientIds', () => {
  it('collects owners and distinct active group members without guest access users', () => {
    const recipients = collectGroupMemberRecipientIds({
      owner_id: 'owner-user',
      memberships: [
        { user_id: 'active-user', status: 'active' },
        { user_id: 'member-user', status: 'member' },
        { user_id: 'admin-user', status: 'admin' },
        { user_id: 'requested-user', status: 'requested' },
        { user_id: 'invited-user', status: 'invited' },
        { user_id: 'active-user', status: 'active' },
        { user_id: null, status: 'active' },
      ],
      guest_accesses: [{ user_id: 'guest-user', status: 'active' }],
    });

    expect(recipients.sort()).toEqual(['active-user', 'admin-user', 'member-user', 'owner-user']);
  });
});

describe('collectGroupMembershipManagerRecipientIds', () => {
  it('collects owners and active members or guests with member-management rights', () => {
    const recipients = collectGroupMembershipManagerRecipientIds(
      {
        owner_id: 'owner-user',
        memberships: [
          {
            user_id: 'member-manager',
            status: 'active',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupMemberships', action: 'manage' }],
                },
              },
            ],
          },
          {
            user_id: 'member-manage-members',
            status: 'admin',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groups', action: 'manage_members' }],
                },
              },
            ],
          },
          {
            user_id: 'viewer',
            status: 'active',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groups', action: 'view' }],
                },
              },
            ],
          },
          {
            user_id: 'requested-manager',
            status: 'requested',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupMemberships', action: 'manage' }],
                },
              },
            ],
          },
        ],
        guest_accesses: [
          {
            user_id: 'guest-manager',
            status: 'active',
            guest_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupMemberships', action: 'manage_members' }],
                },
              },
            ],
          },
          {
            user_id: 'revoked-guest',
            status: 'revoked',
            guest_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groups', action: 'manage' }],
                },
              },
            ],
          },
        ],
      },
      'actor-user'
    );

    expect(recipients.sort()).toEqual([
      'guest-manager',
      'member-manage-members',
      'member-manager',
      'owner-user',
    ]);
  });

  it('deduplicates recipients and excludes the actor', () => {
    const recipients = collectGroupMembershipManagerRecipientIds(
      {
        owner_id: 'actor-user',
        memberships: [
          {
            user_id: 'manager-user',
            status: 'active',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groups', action: 'manage_members' }],
                },
              },
            ],
          },
        ],
        guest_accesses: [
          {
            user_id: 'manager-user',
            status: 'active',
            guest_roles: [
              {
                role: {
                  action_rights: [{ resource: 'groupMemberships', action: 'manage' }],
                },
              },
            ],
          },
        ],
      },
      'actor-user'
    );

    expect(recipients).toEqual(['manager-user']);
  });
});

describe('collectEventParticipantManagerRecipientIds', () => {
  it('collects creators and active participants with participant-management rights', () => {
    const recipients = collectEventParticipantManagerRecipientIds(
      {
        creator_id: 'creator-user',
        participants: [
          {
            user_id: 'event-manager',
            status: 'active',
            participant_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'manage_participants' }],
                },
              },
            ],
          },
          {
            user_id: 'event-admin',
            status: 'confirmed',
            participant_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'manage' }],
                },
              },
            ],
          },
          {
            user_id: 'event-viewer',
            status: 'active',
            participant_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'view' }],
                },
              },
            ],
          },
          {
            user_id: 'requested-manager',
            status: 'requested',
            participant_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'manage' }],
                },
              },
            ],
          },
        ],
      },
      'actor-user'
    );

    expect(recipients.sort()).toEqual(['creator-user', 'event-admin', 'event-manager']);
  });

  it('deduplicates recipients and excludes the actor', () => {
    const recipients = collectEventParticipantManagerRecipientIds(
      {
        creator_id: 'actor-user',
        participants: [
          {
            user_id: 'manager-user',
            status: 'active',
            participant_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'manage_participants' }],
                },
              },
            ],
          },
          {
            user_id: 'manager-user',
            status: 'confirmed',
            participant_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'manage' }],
                },
              },
            ],
          },
        ],
      },
      'actor-user'
    );

    expect(recipients).toEqual(['manager-user']);
  });
});

describe('collectAmendmentCollaboratorManagerRecipientIds', () => {
  it('collects authors and active collaborators with amendment manage rights', () => {
    const recipients = collectAmendmentCollaboratorManagerRecipientIds(
      {
        created_by_id: 'author-user',
        collaborators: [
          {
            user_id: 'collaborator-manager',
            status: 'member',
            role: {
              action_rights: [{ resource: 'amendments', action: 'manage' }],
            },
          },
          {
            user_id: 'collaborator-viewer',
            status: 'member',
            role: {
              action_rights: [{ resource: 'amendments', action: 'view' }],
            },
          },
          {
            user_id: 'requested-manager',
            status: 'requested',
            role: {
              action_rights: [{ resource: 'amendments', action: 'manage' }],
            },
          },
        ],
      },
      'actor-user'
    );

    expect(recipients.sort()).toEqual(['author-user', 'collaborator-manager']);
  });

  it('deduplicates recipients and excludes the actor', () => {
    const recipients = collectAmendmentCollaboratorManagerRecipientIds(
      {
        created_by_id: 'actor-user',
        collaborators: [
          {
            user_id: 'manager-user',
            status: 'member',
            role: {
              action_rights: [{ resource: 'amendments', action: 'manage' }],
            },
          },
          {
            user_id: 'manager-user',
            status: 'active',
            role: {
              action_rights: [{ resource: 'amendments', action: 'manage' }],
            },
          },
        ],
      },
      'actor-user'
    );

    expect(recipients).toEqual(['manager-user']);
  });
});

describe('collectProcessTaskEventManagerRecipientIds', () => {
  it('collects owners and active members or guests with group-scoped event management rights', () => {
    const recipients = collectProcessTaskEventManagerRecipientIds(
      {
        owner_id: 'owner-user',
        memberships: [
          {
            user_id: 'member-manager',
            status: 'active',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'manage', group_id: 'group-1' }],
                },
              },
            ],
          },
          {
            user_id: 'member-vote-manager',
            status: 'member',
            membership_roles: [
              {
                role: {
                  action_rights: [
                    { resource: 'events', action: 'manage_votes', group_id: 'group-1' },
                  ],
                },
              },
            ],
          },
          {
            user_id: 'member-viewer',
            status: 'active',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'view', group_id: 'group-1' }],
                },
              },
            ],
          },
          {
            user_id: 'wrong-group-manager',
            status: 'active',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'manage', group_id: 'group-2' }],
                },
              },
            ],
          },
          {
            user_id: 'requested-manager',
            status: 'requested',
            membership_roles: [
              {
                role: {
                  action_rights: [
                    { resource: 'events', action: 'manage_votes', group_id: 'group-1' },
                  ],
                },
              },
            ],
          },
        ],
        guest_accesses: [
          {
            user_id: 'guest-manager',
            status: 'active',
            guest_roles: [
              {
                role: {
                  action_rights: [
                    { resource: 'events', action: 'manage_votes', group_id: 'group-1' },
                  ],
                },
              },
            ],
          },
          {
            user_id: 'revoked-guest-manager',
            status: 'revoked',
            guest_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'manage', group_id: 'group-1' }],
                },
              },
            ],
          },
        ],
      },
      'group-1',
      'actor-user'
    );

    expect(recipients.sort()).toEqual([
      'guest-manager',
      'member-manager',
      'member-vote-manager',
      'owner-user',
    ]);
  });

  it('deduplicates recipients and excludes the actor from personal copies', () => {
    const recipients = collectProcessTaskEventManagerRecipientIds(
      {
        owner_id: 'actor-user',
        memberships: [
          {
            user_id: 'manager-user',
            status: 'admin',
            membership_roles: [
              {
                role: {
                  action_rights: [{ resource: 'events', action: 'manage', group_id: 'group-1' }],
                },
              },
            ],
          },
        ],
        guest_accesses: [
          {
            user_id: 'manager-user',
            status: 'active',
            guest_roles: [
              {
                role: {
                  action_rights: [
                    { resource: 'events', action: 'manage_votes', group_id: 'group-1' },
                  ],
                },
              },
            ],
          },
        ],
      },
      'group-1',
      'actor-user'
    );

    expect(recipients).toEqual(['manager-user']);
  });
});
