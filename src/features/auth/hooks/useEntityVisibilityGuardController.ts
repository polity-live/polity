import { useAuth } from '@/providers/auth-provider';
import {
  resolveRouteVisibilityAccess,
  type RouteVisibilityInput,
} from '@/features/auth/logic/routeVisibilityAccess';

interface UseEntityVisibilityGuardControllerOptions {
  entityExists: boolean;
  hasError: boolean;
  isLoading: boolean;
  visibilities: RouteVisibilityInput[];
  canAccessPrivate: boolean;
}

export function useEntityVisibilityGuardController({
  entityExists,
  hasError,
  isLoading,
  visibilities,
  canAccessPrivate,
}: UseEntityVisibilityGuardControllerOptions) {
  const { user } = useAuth();

  if (isLoading) {
    return { state: 'loading' as const };
  }

  if (hasError) {
    return { state: 'error' as const };
  }

  if (!entityExists) {
    return { state: 'not-found' as const };
  }

  const decision = resolveRouteVisibilityAccess(visibilities, !!user, canAccessPrivate);

  if (!decision.allowed) {
    return { state: 'unauthorized' as const, reason: decision.reason ?? 'login-required' };
  }

  return { state: 'allowed' as const };
}
