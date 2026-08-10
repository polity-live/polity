import { useConnectionState } from '@rocicorp/zero/react';
import { useCallback } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';

export function useEnsureUserController() {
  const { user, loading, refreshAuthState, signOut } = useAuth();
  const { isLoading: userStateLoading } = useUserState();
  const connectionState = useConnectionState();

  const retry = useCallback(async () => {
    await refreshAuthState();
  }, [refreshAuthState]);

  const isLoading = loading || Boolean(user?.id && userStateLoading);

  return {
    isLoading,
    hasUser: Boolean(user),
    zeroConnectionState: connectionState.name,
    retry,
    signOut,
    connectionStatus:
      connectionState.name === 'connected'
        ? ('syncing' as const)
        : connectionState.name === 'disconnected'
          ? ('disconnected' as const)
          : ('connecting' as const),
  };
}
