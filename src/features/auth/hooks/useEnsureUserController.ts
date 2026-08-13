import { useConnectionState } from '@rocicorp/zero/react';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';

const RECONNECT_ANNOUNCEMENT_MS = 750;

export function browserIsOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function useEnsureUserController() {
  const { user, loading, refreshAuthState, signOut } = useAuth();
  const { isLoading: userStateLoading } = useUserState();
  const connectionState = useConnectionState();
  const [hasObservedDisconnect, setHasObservedDisconnect] = useState(false);
  const [isBrowserOnline, setIsBrowserOnline] = useState(browserIsOnline);
  const [isBrowserReconnectPending, setIsBrowserReconnectPending] = useState(false);

  useEffect(() => {
    const onOffline = () => {
      setIsBrowserOnline(false);
      setIsBrowserReconnectPending(false);
      setHasObservedDisconnect(true);
    };
    const onOnline = () => {
      setIsBrowserOnline(true);
      setIsBrowserReconnectPending(true);
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    if (!isBrowserReconnectPending || connectionState.name !== 'connected') return;
    const timer = window.setTimeout(
      () => setIsBrowserReconnectPending(false),
      RECONNECT_ANNOUNCEMENT_MS
    );
    return () => window.clearTimeout(timer);
  }, [connectionState.name, isBrowserReconnectPending]);

  const effectiveConnectionState = !isBrowserOnline
    ? ('disconnected' as const)
    : isBrowserReconnectPending
      ? ('connecting' as const)
      : connectionState.name;

  useEffect(() => {
    if (effectiveConnectionState === 'disconnected') {
      setHasObservedDisconnect(true);
    } else if (effectiveConnectionState === 'connected') {
      setHasObservedDisconnect(false);
    }
  }, [effectiveConnectionState]);

  const retry = useCallback(async () => {
    await refreshAuthState();
  }, [refreshAuthState]);

  const isLoading = loading || Boolean(user?.id && userStateLoading);

  return {
    isLoading,
    hasUser: Boolean(user),
    zeroConnectionState: effectiveConnectionState,
    connectionNotice:
      effectiveConnectionState === 'disconnected'
        ? ('offline' as const)
        : effectiveConnectionState === 'connecting' && hasObservedDisconnect
          ? ('reconnecting' as const)
          : null,
    retry,
    signOut,
    connectionStatus:
      effectiveConnectionState === 'connected'
        ? ('syncing' as const)
        : effectiveConnectionState === 'disconnected'
          ? ('disconnected' as const)
          : ('connecting' as const),
  };
}
