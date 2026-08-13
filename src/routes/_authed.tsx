import { createFileRoute, Navigate, Outlet, useRouterState } from '@tanstack/react-router';
import { EnsureUser } from '@/features/auth/EnsureUser';
import { useZeroReady } from '@/providers/zero-ready-context';
import { useAuth } from '@/providers/auth-provider';
import { AppBootLoadingState } from '@/features/shared/ui/feedback';
import { isGuestAccessibleEntityPath } from '@/features/auth/logic/guestEntityRouteAccess';
import {
  getSafeSignInRedirect,
  storePendingSignInRedirect,
} from '@/features/auth/logic/authRedirects';

interface EditorCurrentUser {
  avatar?: string | null;
  first_name?: string | null;
  handle?: string | null;
  id: string;
  last_name?: string | null;
}

export function mapEditorUserRecord(
  currentUser: EditorCurrentUser | null | undefined,
  email: string | null | undefined
) {
  if (!currentUser) return undefined;

  return {
    id: currentUser.id,
    name:
      [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') ||
      currentUser.handle ||
      '',
    email: email ?? undefined,
    avatar: currentUser.avatar ?? undefined,
  };
}

export const Route = createFileRoute('/_authed')({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { loading, user, refreshAuthState, signOut } = useAuth();
  const zeroReady = useZeroReady();
  const location = useRouterState({ select: s => s.location });
  const pathname = location.pathname;
  const guestCanAccessPath = isGuestAccessibleEntityPath(pathname);

  if (loading) {
    return (
      <AppBootLoadingState details={pathname} onRetry={refreshAuthState} onSignOut={signOut} />
    );
  }

  if (!user && !guestCanAccessPath) {
    if (pathname.startsWith('/auth') || pathname === '/unauthorized') return null;

    const hash = location.hash ? `#${location.hash.replace(/^#/, '')}` : '';
    const target = getSafeSignInRedirect(`${location.pathname}${location.searchStr}${hash}`);
    storePendingSignInRedirect(target);
    return <Navigate to="/auth/sign-in" search={{ redirect: target }} replace />;
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
