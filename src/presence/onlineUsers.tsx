import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { usePresence } from './usePresence';

const ONLINE_USERS_ROOM_ID = 'users:online';

interface OnlineUsersContextValue {
  onlineUserIds: ReadonlySet<string>;
  isUserOnline: (userId?: string | null) => boolean;
}

const emptyOnlineUsers = new Set<string>();

const OnlineUsersContext = createContext<OnlineUsersContextValue>({
  onlineUserIds: emptyOnlineUsers,
  isUserOnline: () => false,
});

export function OnlineUsersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { peers } = usePresence(ONLINE_USERS_ROOM_ID, {
    enabled: Boolean(user?.id),
    initialData: user?.id ? { userId: user.id } : undefined,
  });

  const value = useMemo<OnlineUsersContextValue>(() => {
    const onlineUserIds = new Set<string>();

    for (const peer of peers) {
      if (peer.userId) {
        onlineUserIds.add(peer.userId);
      }
    }

    if (user?.id) {
      onlineUserIds.add(user.id);
    }

    return {
      onlineUserIds,
      isUserOnline: (userId?: string | null) => Boolean(userId && onlineUserIds.has(userId)),
    };
  }, [peers, user?.id]);

  return <OnlineUsersContext.Provider value={value}>{children}</OnlineUsersContext.Provider>;
}

export function useOnlineUsers() {
  return useContext(OnlineUsersContext);
}
