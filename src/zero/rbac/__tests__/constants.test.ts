import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE,
  DEFAULT_EVENT_ROLES,
  EVENT_ACTION_RIGHTS,
} from '../constants';

describe('EVENT_ACTION_RIGHTS', () => {
  it('exposes the event-specific permission catalog without generic event view rights', () => {
    expect(EVENT_ACTION_RIGHTS).toEqual([
      { resource: 'agendaItems', action: 'manage', label: 'Manage Agenda Items' },
      { resource: 'agendaItems', action: 'view', label: 'View Agenda Items' },
      { resource: 'elections', action: 'manage', label: 'Manage Elections' },
      { resource: 'events', action: 'manage', label: 'Manage Events' },
      {
        resource: 'events',
        action: 'manage_participants',
        label: 'Manage Event Participants',
      },
      { resource: 'events', action: 'manage_speakers', label: 'Manage Speakers' },
      { resource: 'events', action: 'manage_votes', label: 'Manage Votes' },
      { resource: 'events', action: 'speak', label: 'Speak in Events' },
      { resource: 'events', action: 'active_voting', label: 'Active Voting Rights' },
      {
        resource: 'events',
        action: 'passive_voting',
        label: 'Passive Voting Rights (Can Be Candidate)',
      },
    ]);

    expect(
      EVENT_ACTION_RIGHTS.some(right => right.resource === 'events' && right.action === 'view')
    ).toBe(false);
    expect(
      EVENT_ACTION_RIGHTS.some(
        right => right.resource === 'events' && String(right.action) === 'update'
      )
    ).toBe(false);
    expect(
      EVENT_ACTION_RIGHTS.some(
        right => right.resource === 'events' && String(right.action) === 'delete'
      )
    ).toBe(false);
  });
});

describe('DEFAULT_EVENT_ROLES', () => {
  it('allows standard event participants to speak by default', () => {
    for (const roleName of ['Organizer', 'Voter', 'Participant']) {
      const role = DEFAULT_EVENT_ROLES.find(defaultRole => defaultRole.name === roleName);

      expect(role?.permissions).toContainEqual({ resource: 'events', action: 'speak' });
    }
  });

  it('keeps event guests out of the speaker list by default', () => {
    expect(DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE.permissions).not.toContainEqual({
      resource: 'events',
      action: 'speak',
    });
  });
});
