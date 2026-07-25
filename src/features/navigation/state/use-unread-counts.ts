import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useAuth } from '@/providers/auth-provider.tsx';
import { queries } from '@/zero/queries';
import {
  isNotificationActive,
  isNotificationRead,
  type ReadableNotification,
} from '@/zero/notifications/notificationReadState';

export function countUnreadNotifications(rows: readonly ReadableNotification[] | undefined) {
  return (rows ?? []).filter(
    notification => isNotificationActive(notification) && !isNotificationRead(notification)
  ).length;
}

interface UnreadMessageSummary {
  user_id?: string | null;
  unread_count?: number | null;
  last_read_at?: number | null;
  conversation?: {
    type?: string | null;
    status?: string | null;
    requested_by_id?: string | null;
    created_at?: number | null;
  } | null;
}

export function countUnreadMessageSummaries(
  rows: readonly UnreadMessageSummary[] | undefined,
  userID?: string
) {
  if (!userID) return 0;

  return (rows ?? []).reduce((total, participant) => {
    const conversation = participant.conversation;
    const createdAt = conversation?.created_at ?? 0;
    const hasUnreadRequest =
      conversation?.type !== 'group' &&
      conversation?.type !== 'event' &&
      conversation?.status === 'pending' &&
      conversation?.requested_by_id !== userID &&
      createdAt > 0 &&
      (participant.last_read_at ?? 0) < createdAt;

    return total + (participant.unread_count ?? 0) + (hasUnreadRequest ? 1 : 0);
  }, 0);
}

/**
 * Hook to get unread notifications count for the current user
 * Uses the same server-side filtered query as NotificationsPage
 */
export function useUnreadNotificationsCount() {
  const { user } = useAuth();
  const [rows, result] = useQuery(
    user?.id
      ? queries.notifications.countProjection({
          query: '',
          entityId: null,
          entityType: null,
        })
      : null
  );
  const count = useMemo(() => countUnreadNotifications(rows), [rows]);
  return { count, isLoading: !!user?.id && result.type === 'unknown' };
}

/**
 * Hook to get unread messages count for the current user
 * Counts unread messages plus unread incoming conversation requests
 */
export function useUnreadMessagesCount() {
  const { user } = useAuth();
  const [rows, result] = useQuery(user?.id ? queries.messages.unreadSummary({}) : null);
  const count = useMemo(() => countUnreadMessageSummaries(rows, user?.id), [rows, user?.id]);
  return { count, isLoading: !!user?.id && result.type === 'unknown' };
}
