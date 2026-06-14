'use client';

import type { ReactNode } from 'react';

import { useEnsureUserController } from './hooks/useEnsureUserController';
import { useRequiredUser } from './hooks/useRequiredUser';
import { useUser } from './hooks/useUser';
import { EnsureUserView } from './EnsureUserView';

interface EnsureUserProps {
  children: ReactNode;
}

/**
 * EnsureUser component ensures that every authenticated user has a user record.
 * Queries Zero for the user record and shows a loading state until ready.
 * Times out after ZERO_SYNC_TIMEOUT_MS to avoid infinite loading when Zero can't sync.
 */
export function EnsureUser({ children }: EnsureUserProps) {
  return <EnsureUserView {...useEnsureUserController()}>{children}</EnsureUserView>;
}

export { useRequiredUser, useUser };
