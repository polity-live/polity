import { describe, expect, it } from 'vitest';
import { checkPermission, isEventParticipant, isGroupMember } from '../check';
import type { Amendment, BloggerRelation, GuestAccess, Membership, Participation } from '../types';

const eventManagerRole = {
  id: 'event-role-1',
  name: 'Event manager',
  scope: 'event' as const,
  event: { id: 'event-1' },
  actionRights: [
    {
      id: 'event-right-1',
      resource: 'events' as const,
      action: 'manage' as const,
      event: { id: 'event-1' },
    },
  ],
};

const groupManagerRole = {
  id: 'group-role-1',
  name: 'Group manager',
  scope: 'group' as const,
  actionRights: [
    {
      id: 'group-right-1',
      resource: 'groups' as const,
      action: 'manage' as const,
      group: { id: 'group-1' },
    },
  ],
};

describe('checkPermission active status filtering', () => {
  it('allows invited scoped roles to view but never mutate their target entity', () => {
    const eventParticipation: Participation = {
      id: 'event-invite',
      event: { id: 'event-1' },
      status: 'invited',
      roles: [eventManagerRole],
    };
    const blogRelation: BloggerRelation = {
      id: 'blog-invite',
      blog: { id: 'blog-1' },
      status: 'invited',
      role: {
        id: 'blog-role',
        name: 'Blog manager',
        scope: 'blog',
        blog: { id: 'blog-1' },
        actionRights: [
          {
            id: 'blog-right',
            resource: 'blogs',
            action: 'manage',
            blog: { id: 'blog-1' },
          },
        ],
      },
    };
    const amendment: Amendment = {
      id: 'amendment-1',
      amendmentRoleCollaborators: [
        {
          id: 'amendment-invite',
          user: { id: 'user-1' },
          status: 'invited',
          role: {
            id: 'amendment-role',
            name: 'Amendment manager',
            scope: 'amendment',
            amendment: { id: 'amendment-1' },
            actionRights: [
              {
                id: 'amendment-right',
                resource: 'amendments',
                action: 'manage',
                amendment: { id: 'amendment-1' },
              },
            ],
          },
        },
      ],
    };

    expect(
      checkPermission(
        { userId: 'user-1', participations: [eventParticipation] },
        { eventId: 'event-1' },
        'view',
        'events'
      )
    ).toBe(true);
    expect(
      checkPermission(
        { userId: 'user-1', bloggerRelations: [blogRelation] },
        { blogId: 'blog-1' },
        'view',
        'blogs'
      )
    ).toBe(true);
    expect(checkPermission({ userId: 'user-1', amendment }, {}, 'view', 'amendments')).toBe(true);

    expect(
      checkPermission(
        { userId: 'user-1', participations: [eventParticipation] },
        { eventId: 'event-1' },
        'manage',
        'events'
      )
    ).toBe(false);
    expect(
      checkPermission(
        { userId: 'user-1', bloggerRelations: [blogRelation] },
        { blogId: 'blog-1' },
        'update',
        'blogs'
      )
    ).toBe(false);
    expect(checkPermission({ userId: 'user-1', amendment }, {}, 'update', 'amendments')).toBe(
      false
    );
  });

  it('does not grant event management to invited or requested participants', () => {
    const participations: Participation[] = [
      {
        id: 'participation-1',
        event: { id: 'event-1' },
        status: 'invited',
        roles: [eventManagerRole],
      },
      {
        id: 'participation-2',
        event: { id: 'event-1' },
        status: 'requested',
        roles: [eventManagerRole],
      },
    ];

    expect(
      checkPermission(
        { userId: 'user-1', participations },
        { eventId: 'event-1' },
        'manage',
        'events'
      )
    ).toBe(false);
    expect(isEventParticipant(participations, 'event-1')).toBe(false);
  });

  it('grants event management to active participants with manage rights', () => {
    const participations: Participation[] = [
      {
        id: 'participation-1',
        event: { id: 'event-1' },
        status: 'confirmed',
        roles: [eventManagerRole],
      },
    ];

    expect(
      checkPermission(
        { userId: 'user-1', participations },
        { eventId: 'event-1' },
        'manage',
        'events'
      )
    ).toBe(true);
    expect(isEventParticipant(participations, 'event-1')).toBe(true);
  });

  it('does not grant group management to pending members or non-active guests', () => {
    const memberships: Membership[] = [
      {
        id: 'membership-1',
        group: { id: 'group-1' },
        status: 'invited',
        roles: [groupManagerRole],
      },
    ];
    const guestAccesses: GuestAccess[] = [
      {
        id: 'guest-access-1',
        group: { id: 'group-1' },
        status: 'member',
        roles: [groupManagerRole],
      },
    ];

    expect(
      checkPermission(
        { userId: 'user-1', memberships, guestAccesses },
        { groupId: 'group-1' },
        'manage',
        'groups'
      )
    ).toBe(false);
    expect(isGroupMember(memberships, 'group-1')).toBe(false);
  });
});
