/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CreateRecoveryDraft } from '@/features/create/logic/createFinalization';
import { useEntityVisibilityGuardController } from '../useEntityVisibilityGuardController';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const failedDraft: CreateRecoveryDraft = {
  id: 'group:group-1',
  entityType: 'group',
  entityId: 'group-1',
  createPath: '/create/group',
  formState: {},
  mutationPayload: {},
  target: {
    kind: 'route',
    entityType: 'group',
    to: '/group/$id',
    params: { id: 'group-1' },
  },
  submittedAt: Date.now(),
  status: 'failed',
  errorMessage: 'Server rejected create',
};

describe('useEntityVisibilityGuardController create recovery', () => {
  it('returns recovery for a missing entity with a failed create draft', () => {
    const { result } = renderHook(() =>
      useEntityVisibilityGuardController({
        entityExists: false,
        hasError: false,
        isLoading: false,
        visibilities: [],
        canAccessPrivate: false,
        recoveryDraft: failedDraft,
      })
    );

    expect(result.current).toMatchObject({ state: 'recovery', draft: failedDraft });
  });

  it('preserves not-found behavior for a missing entity without a draft', () => {
    const { result } = renderHook(() =>
      useEntityVisibilityGuardController({
        entityExists: false,
        hasError: false,
        isLoading: false,
        visibilities: [],
        canAccessPrivate: false,
      })
    );

    expect(result.current).toEqual({ state: 'not-found' });
  });
});
