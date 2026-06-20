import { describe, expect, it } from 'vitest';
import { checkPermission, isEventParticipant, isGroupMember } from '../check';
import type { GuestAccess, Membership, Participation } from '../types';

const eventManagerRole = {
  id: 'event-role-1',
  name: 'Event manager',
  scope: 'event' as const,
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
