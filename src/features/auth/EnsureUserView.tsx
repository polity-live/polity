import type { ReactNode } from 'react';

import { AppBootLoadingState } from '@/features/shared/ui/feedback';

interface EnsureUserViewProps {
  children: ReactNode;
  isLoading: boolean;
  hasUser: boolean;
  zeroConnectionState: string;
  connectionStatus: 'syncing' | 'disconnected' | 'connecting';
  retry: () => void | Promise<void>;
  signOut: () => void | Promise<void>;
}

export function EnsureUserView({
  children,
  isLoading,
  hasUser,
  zeroConnectionState,
  connectionStatus,
  retry,
  signOut,
}: EnsureUserViewProps) {
  if (isLoading) {
    return <AppBootLoadingState details={connectionStatus} onRetry={retry} onSignOut={signOut} />;
  }

  if (!hasUser) {
    return null;
  }

  return (
    <>
      <span
        hidden
        data-testid="app-readiness"
        data-app-state="ready"
        data-auth-state="authenticated"
        data-data-state="hydrated"
        data-zero-connection={zeroConnectionState}
      />
      {children}
    </>
  );
}
