import type { NavigationItem } from '@/features/navigation/types/navigation.types';

export interface EntityUnreadCounts {
  group: number;
  event: number;
  amendment: number;
  blog: number;
}

export function getEntityNotificationUnreadCount(
  currentPrimaryRoute: string | null,
  counts: EntityUnreadCounts
): number {
  switch (currentPrimaryRoute) {
    case 'group':
      return counts.group;
    case 'event':
      return counts.event;
    case 'amendment':
      return counts.amendment;
    case 'blog':
      return counts.blog;
    default:
      return 0;
  }
}

export function withEntityNotificationBadge(
  item: NavigationItem,
  unreadCount: number
): NavigationItem {
  if (item.id !== 'notifications') return item;

  return {
    ...item,
    badge: unreadCount > 0 ? unreadCount : undefined,
  };
}
