import type { ReactNode } from 'react';

import { AppBootLoadingState } from '@/features/shared/ui/feedback';

interface AuthGuardViewProps {
  children: ReactNode;
  fallback?: ReactNode;
  isReady: boolean;
  isAllowed: boolean;
}

export function AuthGuardView({ children, fallback, isReady, isAllowed }: AuthGuardViewProps) {
  if (!isReady) {
    return <AppBootLoadingState />;
  }

  if (!isAllowed) {
    return fallback || null;
  }

  return <>{children}</>;
}
