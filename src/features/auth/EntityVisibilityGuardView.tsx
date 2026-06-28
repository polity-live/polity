import type { ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';

import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import type { UnauthorizedReason } from '@/features/auth/logic/routeVisibilityAccess';
import type { CreateRecoveryDraft } from '@/features/create/logic/createFinalization';
import { CreateRecoveryState } from '@/features/create/ui/CreateRecoveryState';
import { GlobalLoadingAnimation, NotFound } from '@/features/shared/ui/feedback';

type EntityVisibilityGuardState =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'not-found' }
  | { state: 'recovery'; draft: CreateRecoveryDraft }
  | { state: 'unauthorized'; reason: UnauthorizedReason }
  | { state: 'allowed' };

interface EntityVisibilityGuardViewProps {
  children: ReactNode;
  guard: EntityVisibilityGuardState;
}

export function EntityVisibilityGuardView({ children, guard }: EntityVisibilityGuardViewProps) {
  if (guard.state === 'loading') {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (guard.state === 'error') {
    return <AccessDenied />;
  }

  if (guard.state === 'not-found') {
    return <NotFound />;
  }

  if (guard.state === 'recovery') {
    return <CreateRecoveryState draft={guard.draft} />;
  }

  if (guard.state === 'unauthorized') {
    return <Navigate to="/unauthorized" search={{ reason: guard.reason }} replace />;
  }

  return <>{children}</>;
}
