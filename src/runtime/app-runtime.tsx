import { lazy, Suspense, type ReactNode } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';

const ConnectedAppRuntime = lazy(() => import('./connected-app-runtime'));

export function shouldUsePublicRuntime(pathname: string, hasSession: boolean) {
  return pathname === '/' && !hasSession;
}

export function AppRuntime({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const { session } = useAuth();

  if (shouldUsePublicRuntime(pathname, Boolean(session))) {
    return children;
  }

  return (
    <Suspense fallback={<div className="bg-background min-h-screen" aria-busy="true" />}>
      <ConnectedAppRuntime>{children}</ConnectedAppRuntime>
    </Suspense>
  );
}
