import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';

export const loadConnectedAppRuntime = () => import('./connected-app-runtime');
const ConnectedAppRuntime = lazy(loadConnectedAppRuntime);

export function shouldUsePublicRuntime(pathname: string, hasSession: boolean) {
  return pathname === '/' && !hasSession;
}

export function AppRuntime({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const { session, loading } = useAuth();
  const publicRuntime = shouldUsePublicRuntime(pathname, Boolean(session));

  useEffect(() => {
    // Let the auth provider commit and start validation before evaluating the
    // connected runtime. Download its code while that request is in flight.
    if (!publicRuntime) void loadConnectedAppRuntime().catch(() => undefined);
  }, [publicRuntime]);

  if (publicRuntime) {
    return children;
  }

  if (loading) return <div className="bg-background min-h-screen" aria-busy="true" />;

  return (
    <Suspense fallback={<div className="bg-background min-h-screen" aria-busy="true" />}>
      <ConnectedAppRuntime>{children}</ConnectedAppRuntime>
    </Suspense>
  );
}
