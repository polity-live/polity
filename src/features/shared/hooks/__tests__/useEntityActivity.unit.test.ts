import { describe, expect, it } from 'vitest';

import { canViewEntityActivity } from '../useEntityActivity';

describe('entity activity visibility', () => {
  it('allows creators and active collaborators but not invited amendment readers', () => {
    expect(canViewEntityActivity('amendment', { created_by_id: 'u1' }, 'u1')).toBe(true);
    expect(
      canViewEntityActivity(
        'amendment',
        { collaborators: [{ user_id: 'u2', status: 'active' }] },
        'u2'
      )
    ).toBe(true);
    expect(
      canViewEntityActivity(
        'amendment',
        { collaborators: [{ user_id: 'u2', status: 'invited' }] },
        'u2'
      )
    ).toBe(false);
  });

  it('allows active group members and event participants only', () => {
    expect(
      canViewEntityActivity('group', { memberships: [{ user_id: 'u1', status: 'member' }] }, 'u1')
    ).toBe(true);
    expect(
      canViewEntityActivity(
        'event',
        { participants: [{ user_id: 'u1', status: 'confirmed' }] },
        'u1'
      )
    ).toBe(true);
    expect(
      canViewEntityActivity('event', { participants: [{ user_id: 'u1', status: 'invited' }] }, 'u1')
    ).toBe(false);
    expect(canViewEntityActivity('group', { visibility: 'public' }, undefined)).toBe(false);
  });

  it('allows an active group guest only with a contextual management right', () => {
    const guest = (resource: string, action = 'manage') => ({
      guest_accesses: [
        {
          user_id: 'u1',
          status: 'active',
          guest_roles: [{ role: { action_rights: [{ resource, action }] } }],
        },
      ],
    });
    expect(canViewEntityActivity('group', guest('groupRelationships'), 'u1')).toBe(true);
    expect(canViewEntityActivity('group', guest('payments'), 'u1')).toBe(false);
    expect(canViewEntityActivity('group', guest('groups', 'view'), 'u1')).toBe(false);
  });
});
