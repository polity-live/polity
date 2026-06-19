import { describe, expect, it } from 'vitest';

import { buildUserMenuEvents, buildUserMenuGroups } from '../userMenuItems';

const NOW = new Date('2026-06-19T12:00:00Z').getTime();
const FUTURE = NOW + 60 * 60 * 1000;
const PAST = NOW - 60 * 60 * 1000;

describe('user menu item builders', () => {
  it('shows confirmed groups with assigned custom roles without checking role names', () => {
    const groups = buildUserMenuGroups([
      {
        status: 'active',
        group: { id: 'group-with-custom-role', name: 'Working Circle' },
        membership_roles: [{ role: { id: 'custom-role' } }],
      },
      {
        status: 'member',
        group: { id: 'group-with-legacy-role', name: 'Legacy Group' },
        role: { id: 'legacy-role' },
      },
      {
        status: 'active',
        group: { id: 'group-without-role', name: 'No Role' },
        membership_roles: [],
      },
      {
        status: 'requested',
        group: { id: 'pending-group', name: 'Pending' },
        membership_roles: [{ role: { id: 'pending-role' } }],
      },
    ]);

    expect(groups.map(group => group.id)).toEqual([
      'group-with-legacy-role',
      'group-with-custom-role',
    ]);
  });

  it('shows future or ongoing confirmed event participations with assigned roles', () => {
    const events = buildUserMenuEvents(
      [
        {
          id: 'participation-future',
          status: 'confirmed',
          participant_roles: [{ role: { id: 'speaker' } }],
          event: {
            id: 'event-future',
            title: 'Future Assembly',
            start_date: FUTURE,
            status: 'published',
          },
        },
        {
          id: 'participation-ongoing',
          status: 'active',
          participant_roles: [{ role: { id: 'chair' } }],
          event: {
            id: 'event-ongoing',
            title: 'Ongoing Assembly',
            start_date: PAST,
            end_date: FUTURE,
            status: 'published',
          },
        },
        {
          id: 'participation-no-role',
          status: 'active',
          participant_roles: [],
          event: {
            id: 'event-no-role',
            title: 'No Role',
            start_date: FUTURE,
          },
        },
        {
          id: 'participation-requested',
          status: 'requested',
          participant_roles: [{ role: { id: 'requested-role' } }],
          event: {
            id: 'event-requested',
            title: 'Requested',
            start_date: FUTURE,
          },
        },
        {
          id: 'participation-cancelled',
          status: 'active',
          participant_roles: [{ role: { id: 'cancelled-role' } }],
          event: {
            id: 'event-cancelled',
            title: 'Cancelled',
            start_date: FUTURE,
            status: 'cancelled',
          },
        },
        {
          id: 'participation-past',
          status: 'active',
          participant_roles: [{ role: { id: 'past-role' } }],
          event: {
            id: 'event-past',
            title: 'Past',
            start_date: PAST,
          },
        },
      ],
      NOW
    );

    expect(events.map(event => event.id)).toEqual(['event-future', 'event-ongoing']);
  });

  it('uses recurring participation instance dates when deciding future events', () => {
    const events = buildUserMenuEvents(
      [
        {
          id: 'participation-recurring',
          status: 'active',
          instance_date: FUTURE,
          participant_roles: [{ role: { id: 'moderator' } }],
          event: {
            id: 'event-recurring',
            title: 'Recurring Meeting',
            start_date: PAST - 2 * 60 * 60 * 1000,
            end_date: PAST - 60 * 60 * 1000,
          },
        },
      ],
      NOW
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'event-recurring',
      start_date: FUTURE,
      end_date: FUTURE + 60 * 60 * 1000,
    });
  });
});
