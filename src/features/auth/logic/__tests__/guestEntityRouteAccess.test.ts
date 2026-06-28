import { describe, expect, it } from 'vitest';

import { isGuestAccessibleEntityPath } from '../guestEntityRouteAccess';

describe('guestEntityRouteAccess', () => {
  it('allows signed-out access to public entity route families', () => {
    expect(isGuestAccessibleEntityPath('/group/group-1')).toBe(true);
    expect(isGuestAccessibleEntityPath('/user/user-1')).toBe(true);
    expect(isGuestAccessibleEntityPath('/event/event-1')).toBe(true);
    expect(isGuestAccessibleEntityPath('/amendment/amendment-1')).toBe(true);
    expect(isGuestAccessibleEntityPath('/blog/blog-1')).toBe(true);
    expect(isGuestAccessibleEntityPath('/user/user-1/blog/blog-1')).toBe(true);
  });

  it('does not treat non-entity pages as guest-accessible authed routes', () => {
    expect(isGuestAccessibleEntityPath('/auth/sign-in')).toBe(false);
    expect(isGuestAccessibleEntityPath('/docs')).toBe(false);
    expect(isGuestAccessibleEntityPath('/blog')).toBe(false);
  });

  it('keeps restricted entity subroutes behind authentication', () => {
    expect(isGuestAccessibleEntityPath('/group/group-1/settings')).toBe(false);
    expect(isGuestAccessibleEntityPath('/group/group-1/blog/blog-1/edit')).toBe(false);
    expect(isGuestAccessibleEntityPath('/blog/blog-1/editor')).toBe(false);
    expect(isGuestAccessibleEntityPath('/event/event-1/notifications')).toBe(false);
    expect(isGuestAccessibleEntityPath('/user/user-1/notification-settings')).toBe(false);
    expect(isGuestAccessibleEntityPath('/group/group-1/operation')).toBe(false);
    expect(isGuestAccessibleEntityPath('/user/user-1/meet')).toBe(false);
  });
});
