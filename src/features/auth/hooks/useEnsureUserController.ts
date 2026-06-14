import { useConnectionState } from '@rocicorp/zero/react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';

const ZERO_SYNC_TIMEOUT_MS = 8000;

export function useEnsureUserController() {
  const { user, loading } = useAuth();
  const { isLoading: userStateLoading } = useUserState();
  const connectionState = useConnectionState();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!userStateLoading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), ZERO_SYNC_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [userStateLoading]);

  const isLoading = loading || (user?.id ? userStateLoading && !timedOut : false);

  return {
    isLoading,
    hasUser: Boolean(user),
    connectionStatus:
      connectionState.name === 'connected'
        ? ('syncing' as const)
        : connectionState.name === 'disconnected'
          ? ('disconnected' as const)
          : ('connecting' as const),
  };
}
