import { createFileRoute, Navigate, Outlet, useRouterState } from '@tanstack/react-router';
import { EnsureUser } from '@/features/auth/EnsureUser';
import { useZeroReady } from '@/providers/zero-provider';
import { useAuth } from '@/providers/auth-provider';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';

const GUEST_ACCESSIBLE_ENTITY_PREFIXES = ['/user/', '/group/', '/amendment/', '/event/'];
const GUEST_RESTRICTED_ENTITY_SEGMENTS = [
  '/settings',
  '/edit',
  '/editor',
  '/notifications',
  '/notification-settings',
  '/operation',
  '/meet',
];

function isGuestAccessibleEntityPath(pathname: string) {
  if (!GUEST_ACCESSIBLE_ENTITY_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return false;
  }

  return !GUEST_RESTRICTED_ENTITY_SEGMENTS.some(segment => pathname.includes(segment));
}

export const Route = createFileRoute('/_authed')({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { loading, user } = useAuth();
  const zeroReady = useZeroReady();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const guestCanAccessPath = isGuestAccessibleEntityPath(pathname);

  if (loading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (!user && !guestCanAccessPath) {
    return <Navigate to="/unauthorized" search={{ reason: 'login-required' }} replace />;
  }

  if (!user) {
    return <Outlet />;
  }

  if (!zeroReady) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  return (
    <EnsureUser>
      <Outlet />
    </EnsureUser>
  );
}
