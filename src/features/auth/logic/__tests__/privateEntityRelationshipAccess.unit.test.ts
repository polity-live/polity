import { describe, expect, it } from 'vitest';

import {
  hasPrivateAmendmentRouteAccess,
  hasPrivateBlogRouteAccess,
  hasPrivateEventRouteAccess,
  hasPrivateGroupRouteAccess,
} from '../privateEntityRelationshipAccess';

describe('privateEntityRelationshipAccess', () => {
  it('rejects every private relationship without an authenticated user', () => {
    expect(hasPrivateGroupRouteAccess('group-1', 'owner', null, [])).toBe(false);
    expect(hasPrivateAmendmentRouteAccess('amendment-1', 'creator', undefined, [])).toBe(false);
    expect(hasPrivateEventRouteAccess('event-1', 'creator', null, [])).toBe(false);
    expect(hasPrivateBlogRouteAccess('blog-1', undefined, [])).toBe(false);
  });

  it('allows owners and invited or active group roles with groups:view/manage', () => {
    const viewRole = {
      scope: 'group',
      group_id: 'group-1',
      action_rights: [{ group_id: 'group-1', resource: 'groups', action: 'view' }],
    };
    const manageRole = {
      scope: 'group',
      group_id: 'group-1',
      action_rights: [{ group_id: 'group-1', resource: 'groups', action: 'manage' }],
    };

    expect(hasPrivateGroupRouteAccess('group-1', 'user-1', 'user-1', [])).toBe(true);
    expect(
      hasPrivateGroupRouteAccess('group-1', 'user-1', 'user-2', [
        { status: 'invited', roles: [viewRole] },
      ])
    ).toBe(true);
    expect(
      hasPrivateGroupRouteAccess('group-1', 'user-1', 'user-2', [
        { status: 'active', roles: [manageRole] },
      ])
    ).toBe(true);
    expect(
      hasPrivateGroupRouteAccess('group-1', 'user-1', 'user-2', [{ status: 'active', roles: [] }])
    ).toBe(false);
    expect(
      hasPrivateGroupRouteAccess('group-1', 'user-1', 'user-2', [
        { status: 'requested', roles: [viewRole] },
        { status: 'inactive', roles: [viewRole] },
      ])
    ).toBe(false);
    expect(
      hasPrivateGroupRouteAccess(
        'group-1',
        'user-1',
        'user-2',
        [],
        [{ status: 'invited', roles: [viewRole] }]
      )
    ).toBe(true);
    expect(
      hasPrivateGroupRouteAccess(
        'group-1',
        'user-1',
        'user-2',
        [],
        [{ status: 'revoked', roles: [viewRole] }]
      )
    ).toBe(false);
    expect(
      hasPrivateGroupRouteAccess('group-1', 'user-1', 'user-2', [
        {
          status: 'active',
          roles: [
            { action_rights: [{ group_id: 'other-group', resource: 'groups', action: 'view' }] },
          ],
        },
      ])
    ).toBe(false);
  });

  it('allows amendment owners, active parents, and invited or active scoped view roles', () => {
    const role = (action: string, amendmentId = 'amendment-1') => ({
      scope: 'amendment',
      amendment_id: amendmentId,
      action_rights: [{ amendment_id: amendmentId, resource: 'amendments', action }],
    });

    expect(hasPrivateAmendmentRouteAccess('amendment-1', 'user-1', 'user-1', [])).toBe(true);
    expect(
      hasPrivateAmendmentRouteAccess('amendment-1', 'user-1', 'user-2', [
        { status: 'invited', role: role('view') },
      ])
    ).toBe(true);
    expect(
      hasPrivateAmendmentRouteAccess('amendment-1', 'user-1', 'user-2', [
        { status: 'collaborator', role: role('manage') },
      ])
    ).toBe(true);
    expect(
      hasPrivateAmendmentRouteAccess('amendment-1', 'user-1', 'user-2', [
        { status: 'active', role: role('update') },
        { status: 'requested', role: role('view') },
        { status: 'active', role: role('view', 'other-amendment') },
      ])
    ).toBe(false);
    expect(hasPrivateAmendmentRouteAccess('amendment-1', 'user-1', 'user-2', [], true)).toBe(true);
  });

  it('allows event creators, active parents, and invited or active scoped view roles', () => {
    const role = (action: string, eventId = 'event-1') => ({
      scope: 'event',
      event_id: eventId,
      action_rights: [{ event_id: eventId, resource: 'events', action }],
    });

    expect(hasPrivateEventRouteAccess('event-1', 'user-1', 'user-1', [])).toBe(true);
    expect(
      hasPrivateEventRouteAccess('event-1', 'user-1', 'user-2', [
        { status: 'invited', roles: [role('manage_participants')] },
      ])
    ).toBe(true);
    expect(
      hasPrivateEventRouteAccess('event-1', 'user-1', 'user-2', [
        { status: 'confirmed', roles: [role('update')] },
        { status: 'inactive', roles: [role('view')] },
        { status: 'confirmed', roles: [role('view', 'other-event')] },
      ])
    ).toBe(false);
    expect(hasPrivateEventRouteAccess('event-1', 'user-1', 'user-2', [], true)).toBe(true);
  });

  it('allows blog owners, active parents, and invited or active scoped view roles', () => {
    const role = (action: string, blogId = 'blog-1') => ({
      scope: 'blog',
      blog_id: blogId,
      action_rights: [{ blog_id: blogId, resource: 'blogs', action }],
    });

    expect(hasPrivateBlogRouteAccess('blog-1', 'user-1', [{ status: 'owner' }])).toBe(true);
    expect(
      hasPrivateBlogRouteAccess('blog-1', 'user-1', [{ status: 'invited', role: role('manage') }])
    ).toBe(true);
    expect(
      hasPrivateBlogRouteAccess('blog-1', 'user-1', [
        { status: 'member', role: role('update') },
        { status: 'requested', role: role('view') },
        { status: 'writer', role: role('view', 'other-blog') },
      ])
    ).toBe(false);
    expect(hasPrivateBlogRouteAccess('blog-1', 'user-1', [], true)).toBe(true);
  });
});
