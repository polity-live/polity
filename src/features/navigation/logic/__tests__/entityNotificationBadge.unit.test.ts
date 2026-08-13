import { describe, expect, it } from 'vitest';

import type { NavigationItem } from '@/features/navigation/types/navigation.types';
import {
  getEntityNotificationUnreadCount,
  withEntityNotificationBadge,
} from '../entityNotificationBadge';

const counts = {
  group: 3,
  event: 5,
  amendment: 7,
  blog: 11,
};

describe('entityNotificationBadge', () => {
  it.each([
    ['group', 3],
    ['event', 5],
    ['amendment', 7],
    ['blog', 11],
    ['user', 0],
    [null, 0],
  ])('selects the unread count for the %s route', (route, expected) => {
    expect(getEntityNotificationUnreadCount(route, counts)).toBe(expected);
  });

  it('adds the exact positive count only to the notifications item', () => {
    const notificationItem: NavigationItem = {
      id: 'notifications',
      icon: 'Bell',
      label: 'Notifications',
    };
    const overviewItem: NavigationItem = {
      id: 'overview',
      icon: 'Home',
      label: 'Overview',
    };

    expect(withEntityNotificationBadge(notificationItem, 137).badge).toBe(137);
    expect(withEntityNotificationBadge(overviewItem, 137)).toBe(overviewItem);
  });

  it('removes a stale notifications badge when the unread count reaches zero', () => {
    const item: NavigationItem = {
      id: 'notifications',
      icon: 'Bell',
      label: 'Notifications',
      badge: 2,
    };

    expect(withEntityNotificationBadge(item, 0).badge).toBeUndefined();
  });
});
