/* @vitest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntityRouteAccess } from '../useEntityRouteAccess';
import {
  clearCreateRecoveryDraft,
  saveCreateRecoveryDraft,
  type CreateRecoveryDraft,
} from '@/features/create/logic/createFinalization';
import { entityRouteAccessFn } from '@/server/entity-route-access';

vi.mock('@/server/entity-route-access', () => ({
  entityRouteAccessFn: vi.fn(),
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

const pendingGroupDraft: CreateRecoveryDraft = {
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
  status: 'pending',
};

describe('useEntityRouteAccess create recovery', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.mocked(entityRouteAccessFn).mockReset();
    vi.mocked(entityRouteAccessFn).mockResolvedValue({
      exists: false,
      visibilities: [],
      canAccessPrivate: false,
    });
  });

  it('keeps a pending created group routable even when the first server access check misses it', async () => {
    saveCreateRecoveryDraft(pendingGroupDraft);

    const { result } = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'group-1' })
    );

    await waitFor(() => {
      expect(result.current.data?.exists).toBe(true);
    });
    expect(result.current.data?.canAccessPrivate).toBe(true);
    expect(result.current.recoveryDraft?.status).toBe('pending');
  });

  it('surfaces a failed recovery draft instead of hiding it behind a generic miss', async () => {
    saveCreateRecoveryDraft({
      ...pendingGroupDraft,
      status: 'failed',
      errorMessage: 'Server rejected create',
    });

    const { result } = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'group-1' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data?.exists).toBe(false);
    expect(result.current.recoveryDraft).toMatchObject({
      status: 'failed',
      errorMessage: 'Server rejected create',
    });
  });

  it('preserves normal not-found behavior without a matching draft', async () => {
    clearCreateRecoveryDraft(pendingGroupDraft.id);

    const { result } = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'group-1' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data?.exists).toBe(false);
    expect(result.current.recoveryDraft).toBeNull();
  });
});
