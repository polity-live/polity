import type { ReactNode } from 'react';

import { AppBootLoadingState } from '@/features/shared/ui/feedback';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface EnsureUserViewProps {
  children: ReactNode;
  isLoading: boolean;
  hasUser: boolean;
  zeroConnectionState: string;
  connectionStatus: 'syncing' | 'disconnected' | 'connecting';
  connectionNotice?: 'offline' | 'reconnecting' | null;
  retry: () => void | Promise<void>;
  signOut: () => void | Promise<void>;
}

export function EnsureUserView({
  children,
  isLoading,
  hasUser,
  zeroConnectionState,
  connectionStatus,
  connectionNotice,
  retry,
  signOut,
}: EnsureUserViewProps) {
  const { t } = useTranslation();
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
      {connectionNotice === 'offline' || zeroConnectionState === 'disconnected' ? (
        <div
          role="alert"
          data-testid="connection-status"
          data-connection-state="disconnected"
          className="border-warning/40 bg-warning/10 text-foreground sticky top-0 z-50 border-b px-4 py-2 text-center text-sm font-medium"
        >
          {t('common.loading.connectionRecovery.offline')}
        </div>
      ) : connectionNotice === 'reconnecting' ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="connection-status"
          data-connection-state="reconnecting"
          className="border-primary/30 bg-primary/10 text-foreground sticky top-0 z-50 border-b px-4 py-2 text-center text-sm font-medium"
        >
          {t('common.loading.connectionRecovery.reconnecting')}
        </div>
      ) : null}
      {children}
    </>
  );
}
