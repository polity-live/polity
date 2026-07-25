import { createFileRoute, Navigate, Outlet, useRouterState } from '@tanstack/react-router';
import { EnsureUser } from '@/features/auth/EnsureUser';
import { useZeroReady } from '@/providers/zero-ready-context';
import { useAuth } from '@/providers/auth-provider';
import { AppBootLoadingState } from '@/features/shared/ui/feedback';
import { isGuestAccessibleEntityPath } from '@/features/auth/logic/guestEntityRouteAccess';

export const Route = createFileRoute('/_authed')({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { loading, user, refreshAuthState, signOut } = useAuth();
  const zeroReady = useZeroReady();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const guestCanAccessPath = isGuestAccessibleEntityPath(pathname);

  if (loading) {
    return (
      <AppBootLoadingState details={pathname} onRetry={refreshAuthState} onSignOut={signOut} />
    );
  }

  if (!user && !guestCanAccessPath) {
    return <Navigate to="/unauthorized" search={{ reason: 'login-required' }} replace />;
  }

  if (!user) {
    return <Outlet />;
  }

  if (!zeroReady) {
    return (
      <AppBootLoadingState
        details={pathname}
        onRetry={() => window.location.reload()}
        onSignOut={signOut}
      />
    );
  }

  return (
    <EnsureUser>
      <Outlet />
    </EnsureUser>
  );
}
