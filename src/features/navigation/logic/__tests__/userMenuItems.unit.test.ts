import { describe, expect, it } from 'vitest';

import {
  buildUserMenuAmendments,
  buildUserMenuEvents,
  buildUserMenuGroups,
} from '../userMenuItems';

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

  it('shows personal open amendments sorted by title and hides final target decisions', () => {
    const amendments = buildUserMenuAmendments([
      {
        id: 'amendment-zeta',
        title: 'Zeta Motion',
        code: 'Z-1',
        group_id: 'group-source',
        group: { id: 'group-source', name: 'Source Group' },
        event: { id: 'event-zeta', title: 'Zeta Assembly' },
        current_process_run: {
          status: 'scheduled',
          selected_target_group_id: 'group-target',
          selected_target_group: { id: 'group-target', name: 'Target Group' },
        },
        group_decisions: [{ group_id: 'group-target', status: 'supported' }],
      },
      {
        id: 'amendment-alpha',
        title: 'Alpha Motion',
        code: 'A-1',
        group_id: 'group-target',
        group: { id: 'group-target', name: 'Target Group' },
        current_process_run: null,
        group_decisions: [],
      },
      {
        id: 'amendment-alpha',
        title: 'Alpha Motion Duplicate',
        code: 'A-1',
        group_id: 'group-target',
        group: { id: 'group-target', name: 'Target Group' },
        current_process_run: null,
        group_decisions: [],
      },
      {
        id: 'amendment-accepted',
        title: 'Accepted Motion',
        group_id: 'group-target',
        group: { id: 'group-target', name: 'Target Group' },
        current_process_run: {
          status: 'scheduled',
          selected_target_group_id: 'group-target',
          selected_target_group: { id: 'group-target', name: 'Target Group' },
        },
        group_decisions: [{ group_id: 'group-target', status: 'accepted' }],
      },
      {
        id: 'amendment-rejected',
        title: 'Rejected Motion',
        group_id: 'group-target',
        group: { id: 'group-target', name: 'Target Group' },
        current_process_run: {
          status: 'scheduled',
          selected_target_group_id: 'group-target',
          selected_target_group: { id: 'group-target', name: 'Target Group' },
        },
        group_decisions: [{ group_id: 'group-target', status: 'rejected' }],
      },
      {
        id: 'amendment-completed',
        title: 'Completed Motion',
        group_id: 'group-target',
        group: { id: 'group-target', name: 'Target Group' },
        current_process_run: {
          status: 'completed',
          selected_target_group_id: 'group-target',
          selected_target_group: { id: 'group-target', name: 'Target Group' },
        },
        group_decisions: [],
      },
    ]);

    expect(amendments.map(amendment => amendment.id)).toEqual([
      'amendment-alpha',
      'amendment-zeta',
    ]);
    expect(amendments[1]).toMatchObject({
      code: 'Z-1',
      groupName: 'Source Group',
      targetGroupName: 'Target Group',
      eventTitle: 'Zeta Assembly',
    });
  });

  it('sorts unnamed groups and events and handles zero-duration recurring instances', () => {
    const groups = buildUserMenuGroups([
      { status: 'active', group: { id: 'b' }, roles: [{ id: 'role-b' }] },
      { status: 'active', group: { id: 'a', name: null }, roles: [{ id: 'role-a' }] },
    ]);
    expect(groups.map(group => group.id)).toEqual(['b', 'a']);

    const events = buildUserMenuEvents(
      [
        {
          status: 'active',
          roles: [{ id: 'role-base' }],
          event: { id: 'base', title: undefined, start_date: FUTURE, city: 'Berlin' },
        },
        {
          id: 'later',
          status: 'active',
          role: { id: 'role-later' },
          event: {
            id: 'later',
            title: undefined,
            start_date: FUTURE + 1,
            location_name: 'Hall',
          },
        },
        {
          id: 'zero-duration',
          status: 'active',
          instance_date: FUTURE + 2,
          role: { id: 'role-zero' },
          event: {
            id: 'zero-duration',
            title: 'Zero duration',
            start_date: PAST,
            end_date: PAST,
          },
        },
      ],
      NOW
    );

    expect(events[0]).toMatchObject({ key: 'base:base', locationName: 'Berlin' });
    expect(events[1]).toMatchObject({ key: 'later:later', locationName: 'Hall' });
    expect(events[2]).toMatchObject({
      key: `zero-duration:${FUTURE + 2}`,
      start_date: FUTURE + 2,
      end_date: FUTURE + 2,
    });
  });

  it('covers amendment target fallbacks, decision mismatches, and stable tie sorting', () => {
    const amendments = buildUserMenuAmendments([
      { title: 'Missing id' },
      {
        id: 'selected-group-object',
        title: 'Selected object',
        current_process_run: {
          status: 'active',
          selected_target_group_id: null,
          selected_target_group: { id: 'object-target', name: 'Object target' },
        },
      },
      {
        id: 'group-object',
        title: 'Group object',
        group_id: null,
        group: { id: 'group-target', name: 'Group target' },
        group_decisions: [
          { group_id: 'different', status: 'accepted' },
          { group_id: 'group-target', status: null },
        ],
      },
      { id: 'no-target', title: 'No target', group_id: null, group: null },
      { id: 'tie-b', title: null, code: null },
      { id: 'tie-a', title: null, code: null },
      { id: 'code-b', title: 'Same', code: 'B' },
      { id: 'code-a', title: 'Same', code: 'A' },
    ]);

    expect(amendments.map(amendment => amendment.id)).toEqual([
      'tie-a',
      'tie-b',
      'group-object',
      'no-target',
      'code-a',
      'code-b',
      'selected-group-object',
    ]);
  });
});
