import type { ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuth } from '@/providers/auth-provider';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import {
  resolveRouteVisibilityAccess,
  type RouteVisibilityInput,
} from '@/features/auth/logic/routeVisibilityAccess';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { NotFound } from '@/features/shared/ui/ui/not-found';

interface EntityVisibilityGuardProps {
  children: ReactNode;
  entityExists: boolean;
  hasError?: boolean;
  isLoading: boolean;
  visibilities: RouteVisibilityInput[];
}

export function EntityVisibilityGuard({
  children,
  entityExists,
  hasError = false,
  isLoading,
  visibilities,
}: EntityVisibilityGuardProps) {
  const { user } = useAuth();

  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (hasError) {
    return <AccessDenied />;
  }

  if (!entityExists) {
    return <NotFound />;
  }

  const decision = resolveRouteVisibilityAccess(visibilities, !!user);

  if (!decision.allowed) {
    return <Navigate to="/unauthorized" search={{ reason: decision.reason }} replace />;
  }

  return <>{children}</>;
}
