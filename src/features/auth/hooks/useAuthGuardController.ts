import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/providers/auth-provider';

interface UseAuthGuardControllerOptions {
  requireAuth: boolean;
  redirectTo?: string;
}

export function useAuthGuardController({ requireAuth, redirectTo }: UseAuthGuardControllerOptions) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, loading: isLoading } = useAuth();
  const isAuthenticated = Boolean(user);
  const [isMounted, setIsMounted] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    if (!authInitialized || !isMounted) return;

    if (requireAuth && !isAuthenticated) {
      const destination = redirectTo || `/auth?redirect=${encodeURIComponent(pathname)}`;
      navigate({ to: destination });
    } else if (!requireAuth && isAuthenticated) {
      const destination = redirectTo || '/';
      navigate({ to: destination });
    }
  }, [isAuthenticated, authInitialized, requireAuth, navigate, pathname, redirectTo, isMounted]);

  return {
    isReady: authInitialized && isMounted,
    isAllowed: requireAuth ? isAuthenticated : !isAuthenticated,
  };
}
