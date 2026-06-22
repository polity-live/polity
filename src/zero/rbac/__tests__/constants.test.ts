import { describe, expect, it } from 'vitest';
import * as rbacConstants from '../constants';
import {
  AMENDMENT_ACTION_RIGHTS,
  BLOG_ACTION_RIGHTS,
  DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE,
  DEFAULT_AMENDMENT_ROLES,
  DEFAULT_EVENT_ROLES,
  DEFAULT_GROUP_ROLES,
  EVENT_ACTION_RIGHTS,
  GROUP_ACTION_RIGHTS,
} from '../constants';

interface RightLike {
  resource: string;
  action: string;
}

interface RoleLike {
  permissions: readonly RightLike[];
}

const removedGroupScopeRights = [
  'agendaItems:view',
  'amendments:view',
  'amendments:vote',
  'amendments:moderate',
  'comments:moderate',
  'events:view',
  'events:manage_participants',
  'events:manage_speakers',
  'events:manage_votes',
  'events:speak',
  'events:active_voting',
  'events:passive_voting',
  'groupMemberships:view',
  'groupRoles:view',
  'groupAccessRoles:view',
  'messages:view',
] as const;

const removedAmendmentScopeRights = [
  'amendments:create',
  'amendments:moderate',
  'documents:view',
  'comments:create',
  'comments:update',
  'comments:delete',
] as const;

function rightKey(right: RightLike) {
  return `${right.resource}:${right.action}`;
}

function rightKeys(rights: readonly RightLike[]) {
  return new Set(rights.map(rightKey));
}

function rolePermissionKeys(roles: readonly RoleLike[]) {
  return new Set(roles.flatMap(role => role.permissions.map(rightKey)));
}

function expectNoRights(keys: ReadonlySet<string>, removedKeys: readonly string[]) {
  for (const removedKey of removedKeys) {
    expect(keys.has(removedKey), removedKey).toBe(false);
  }
}

describe('scoped action-right catalogs', () => {
  it('exports explicit scoped permission catalogs without a generic alias', () => {
    const genericCatalogName = ['ACTION', 'RIGHTS'].join('_');

    expect(GROUP_ACTION_RIGHTS.length).toBeGreaterThan(0);
    expect(AMENDMENT_ACTION_RIGHTS.length).toBeGreaterThan(0);
    expect(EVENT_ACTION_RIGHTS.length).toBeGreaterThan(0);
    expect(BLOG_ACTION_RIGHTS.length).toBeGreaterThan(0);
    expect(Object.prototype.hasOwnProperty.call(rbacConstants, genericCatalogName)).toBe(false);
  });
});

describe('GROUP_ACTION_RIGHTS', () => {
  it('exposes the group-specific permission catalog without no-effect group rights', () => {
    const keys = rightKeys(GROUP_ACTION_RIGHTS);

    expect(keys.has('amendments:create')).toBe(true);
    expect(keys.has('events:manage')).toBe(true);
    expect(keys.has('groupNotifications:manageNotifications')).toBe(true);
    expectNoRights(keys, removedGroupScopeRights);
  });
});

describe('BLOG_ACTION_RIGHTS', () => {
  it('exposes the blog-specific permission catalog', () => {
    const keys = rightKeys(BLOG_ACTION_RIGHTS);

    expect(keys).toEqual(
      new Set([
        'blogs:update',
        'blogs:delete',
        'blogBloggers:manage',
        'notifications:viewNotifications',
        'notifications:manageNotifications',
      ])
    );
  });
});

describe('AMENDMENT_ACTION_RIGHTS', () => {
  it('exposes the amendment-specific permission catalog without no-effect amendment rights', () => {
    const keys = rightKeys(AMENDMENT_ACTION_RIGHTS);

    expect(keys.has('amendments:view')).toBe(true);
    expect(keys.has('amendments:vote')).toBe(true);
    expect(keys.has('documents:update')).toBe(true);
    expect(keys.has('notifications:manageNotifications')).toBe(true);
    expectNoRights(keys, removedAmendmentScopeRights);
  });
});

describe('EVENT_ACTION_RIGHTS', () => {
  it('exposes the event-specific permission catalog without generic event view rights', () => {
    expect(EVENT_ACTION_RIGHTS).toEqual([
      { resource: 'agendaItems', action: 'manage', label: 'Manage Agenda Items' },
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
      EVENT_ACTION_RIGHTS.some(
        right => right.resource === 'events' && String(right.action) === 'view'
      )
    ).toBe(false);
    expect(
      EVENT_ACTION_RIGHTS.some(
        right => right.resource === 'agendaItems' && String(right.action) === 'view'
      )
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

describe('DEFAULT_GROUP_ROLES', () => {
  it('does not create removed group-scoped action rights from role templates', () => {
    const keys = rolePermissionKeys(DEFAULT_GROUP_ROLES);

    expect(keys.has('amendments:create')).toBe(true);
    expect(keys.has('events:manage')).toBe(true);
    expect(keys.has('messages:manage')).toBe(true);
    expectNoRights(keys, removedGroupScopeRights);
  });
});

describe('DEFAULT_AMENDMENT_ROLES', () => {
  it('does not create removed amendment-scoped action rights from role templates', () => {
    const keys = rolePermissionKeys(DEFAULT_AMENDMENT_ROLES);

    expect(keys.has('amendments:view')).toBe(true);
    expect(keys.has('documents:update')).toBe(true);
    expect(keys.has('notifications:viewNotifications')).toBe(true);
    expectNoRights(keys, removedAmendmentScopeRights);
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

  it('does not create removed event-scoped agenda view rights from role templates', () => {
    const keys = rolePermissionKeys([...DEFAULT_EVENT_ROLES, DEFAULT_ASSEMBLY_EVENT_GUEST_ROLE]);

    expect(keys.has('agendaItems:manage')).toBe(true);
    expect(keys.has('events:speak')).toBe(true);
    expect(keys.has('agendaItems:view')).toBe(false);
  });
});
