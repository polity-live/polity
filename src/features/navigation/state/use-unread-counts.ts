import { useMemo } from 'react';
import { useQuery } from '@rocicorp/zero/react';
import { useAuth } from '@/providers/auth-provider.tsx';
import { getUnreadCount } from '@/features/messages/logic/messageUtils';
import { useMessageState } from '@/zero/messages/useMessageState.ts';
import { queries } from '@/zero/queries';

/**
 * Hook to get unread notifications count for the current user
 * Uses the same server-side filtered query as NotificationsPage
 */
export function useUnreadNotificationsCount() {
  const { user } = useAuth();
  const [rows, result] = useQuery(
    user?.id ? queries.notifications.countRows({ tab: 'unread', query: '' }) : null
  );
  return { count: rows?.length ?? 0, isLoading: !!user?.id && result.type === 'unknown' };
}

/**
 * Hook to get unread messages count for the current user
 * Counts unread messages plus unread incoming conversation requests
 */
export function useUnreadMessagesCount() {
  const { user } = useAuth();

  const { conversationsForUnread: conversations, isLoading } = useMessageState({
    includeForUnread: !!user?.id,
  });

  const count = useMemo(() => {
    if (!user?.id || !conversations) {
      return 0;
    }

    return conversations.reduce(
      (totalUnread, conversation) => totalUnread + getUnreadCount(conversation, user.id),
      0
    );
  }, [conversations, user?.id]);

  return { count, isLoading };
}
