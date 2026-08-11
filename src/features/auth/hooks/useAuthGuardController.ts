import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/providers/auth-provider';
import { storePendingSignInRedirect } from '@/features/auth/logic/authRedirects';

interface UseAuthGuardControllerOptions {
  requireAuth: boolean;
  redirectTo?: string;
}

export function useAuthGuardController({ requireAuth, redirectTo }: UseAuthGuardControllerOptions) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
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
      const currentTarget =
        typeof window === 'undefined'
          ? pathname
          : `${window.location.pathname}${window.location.search}${window.location.hash}`;
      storePendingSignInRedirect(currentTarget);
      const destination = redirectTo || `/auth?redirect=${encodeURIComponent(pathname)}`;
      navigate({ to: destination });
    } else if (!requireAuth && isAuthenticated) {
      const destination = redirectTo || '/';
      navigate({ to: destination });
    }
  }, [isAuthenticated, authInitialized, requireAuth, navigate, pathname, redirectTo]);

  return {
    isReady: authInitialized,
    isAllowed: requireAuth ? isAuthenticated : !isAuthenticated,
  };
}
