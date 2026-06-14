import type { ReactNode } from 'react';
import type { RouteVisibilityInput } from '@/features/auth/logic/routeVisibilityAccess';
import { useEntityVisibilityGuardController } from './hooks/useEntityVisibilityGuardController';
import { EntityVisibilityGuardView } from './EntityVisibilityGuardView';

interface EntityVisibilityGuardProps {
  children: ReactNode;
  entityExists: boolean;
  hasError?: boolean;
  isLoading: boolean;
  visibilities: RouteVisibilityInput[];
  canAccessPrivate?: boolean;
}

export function EntityVisibilityGuard({
  children,
  entityExists,
  hasError = false,
  isLoading,
  visibilities,
  canAccessPrivate = false,
}: EntityVisibilityGuardProps) {
  return (
    <EntityVisibilityGuardView
      guard={useEntityVisibilityGuardController({
        entityExists,
        hasError,
        isLoading,
        visibilities,
        canAccessPrivate,
      })}
    >
      {children}
    </EntityVisibilityGuardView>
  );
}
