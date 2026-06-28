import type { ReactNode } from 'react';

import { AppBootLoadingState } from '@/features/shared/ui/feedback';

interface EnsureUserViewProps {
  children: ReactNode;
  isLoading: boolean;
  hasUser: boolean;
  connectionStatus: 'syncing' | 'disconnected' | 'connecting';
  retry: () => void | Promise<void>;
  signOut: () => void | Promise<void>;
}

export function EnsureUserView({
  children,
  isLoading,
  hasUser,
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

  return <>{children}</>;
}
