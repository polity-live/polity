import type { ReactNode } from 'react';

import { GlobalLoadingAnimation } from '@/features/shared/ui/feedback';

interface EnsureUserViewProps {
  children: ReactNode;
  isLoading: boolean;
  hasUser: boolean;
  connectionStatus: 'syncing' | 'disconnected' | 'connecting';
}

export function EnsureUserView({
  children,
  isLoading,
  hasUser,
  connectionStatus,
}: EnsureUserViewProps) {
  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus={connectionStatus} />;
  }

  if (!hasUser) {
    return null;
  }

  return <>{children}</>;
}
