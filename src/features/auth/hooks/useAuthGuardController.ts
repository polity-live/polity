import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/providers/auth-provider';
import { storePendingSignInRedirect } from '@/features/auth/logic/authRedirects';

interface UseAuthGuardControllerOptions {
  requireAuth: boolean;
  redirectTo?: string;
}

interface AuthGuardLocation {
  pathname: string;
  searchStr?: string;
  hash?: string;
}

export function getAuthGuardRedirectTarget({
  pathname,
  searchStr = '',
  hash = '',
}: AuthGuardLocation) {
  const normalizedHash = hash ? `#${hash.replace(/^#/, '')}` : '';
  return `${pathname}${searchStr}${normalizedHash}`;
}

export function useAuthGuardController({ requireAuth, redirectTo }: UseAuthGuardControllerOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const currentTarget = getAuthGuardRedirectTarget(location);
  const { user, loading: isLoading } = useAuth();
  const isAuthenticated = Boolean(user);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    if (authInitialized) return;

    if (isLoading) {
      return;
    }

    if (user) {
      setAuthInitialized(true);
      return;
    }

    const timer = setTimeout(() => {
      setAuthInitialized(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [isLoading, user, authInitialized]);

  useEffect(() => {
    if (!authInitialized) return;

    if (requireAuth && !isAuthenticated) {
      storePendingSignInRedirect(currentTarget);
      const destination = redirectTo || `/auth?redirect=${encodeURIComponent(currentTarget)}`;
      navigate({ to: destination });
    } else if (!requireAuth && isAuthenticated) {
      const destination = redirectTo || '/';
      navigate({ to: destination });
    }
  }, [
    isAuthenticated,
    authInitialized,
    requireAuth,
    navigate,
    pathname,
    redirectTo,
    currentTarget,
  ]);

  return {
    isReady: authInitialized,
    isAllowed: requireAuth ? isAuthenticated : !isAuthenticated,
  };
}
