import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';

let loadedConnectedRuntime: typeof import('./connected-app-runtime')['default'] | undefined;
export const loadConnectedAppRuntime = async () => {
  const module = await import('./connected-app-runtime');
  loadedConnectedRuntime = module.default;
  return module;
};
const ConnectedAppRuntime = lazy(loadConnectedAppRuntime);

function ReadyConnectedRuntime({ children }: { children: ReactNode }) {
  // Choose once per mount: a later prefetch must not replace a lazy component
  // with another type and remount the authenticated Zero client.
  const [Runtime] = useState(() => loadedConnectedRuntime ?? ConnectedAppRuntime);
  return (
    <Suspense fallback={<div className="bg-background min-h-screen" aria-busy="true" />}>
      <Runtime>{children}</Runtime>
    </Suspense>
  );
}

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

  // React.lazy first suspends even if a separate import already loaded the code.
  // Reuse that component directly so auth completion does not create another
  // fallback transition before the Zero provider can mount.
  return <ReadyConnectedRuntime>{children}</ReadyConnectedRuntime>;
}
