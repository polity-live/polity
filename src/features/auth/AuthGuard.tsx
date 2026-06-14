'use client';

import type React from 'react';
import type { ReactNode } from 'react';

import { useAuthGuardController } from './hooks/useAuthGuardController';
import { AuthGuardView } from './AuthGuardView';

interface AuthGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  fallback?: ReactNode;
}

/**
 * AuthGuard component for protecting routes based on authentication status
 */
export function AuthGuard({ children, requireAuth = true, redirectTo, fallback }: AuthGuardProps) {
  return (
    <AuthGuardView fallback={fallback} {...useAuthGuardController({ requireAuth, redirectTo })}>
      {children}
    </AuthGuardView>
  );
}

/**
 * HOC for protecting pages that require authentication
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: { redirectTo?: string; fallback?: ReactNode }
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <AuthGuard requireAuth={true} {...options}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}

/**
 * HOC for protecting pages that should only be accessible when NOT authenticated (like login page)
 */
export function withoutAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: { redirectTo?: string; fallback?: ReactNode }
) {
  return function UnauthenticatedComponent(props: P) {
    return (
      <AuthGuard requireAuth={false} {...options}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}
