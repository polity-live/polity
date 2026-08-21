/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntityRouteAccess } from '../useEntityRouteAccess';
import {
  clearCreateRecoveryDraft,
  saveCreateRecoveryDraft,
  type CreateRecoveryDraft,
} from '@/features/create/logic/createFinalization';
import { entityRouteAccessFn } from '@/server/entity-route-access';

const auth = vi.hoisted(() => ({
  loading: false,
  session: null as null | { access_token: string; user: { id: string } },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => auth,
}));

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
    auth.loading = false;
    auth.session = null;
    vi.mocked(entityRouteAccessFn).mockReset();
    vi.mocked(entityRouteAccessFn).mockResolvedValue({
      exists: false,
      visibilities: [],
      canAccessPrivate: false,
    });
  });

  it('sends the current Supabase access token as a Bearer header', async () => {
    auth.session = { access_token: 'access-token-1', user: { id: 'user-1' } };

    renderHook(() => useEntityRouteAccess({ entityType: 'group', entityId: 'group-1' }));

    await waitFor(() => {
      expect(entityRouteAccessFn).toHaveBeenCalledWith({
        data: { entityType: 'group', entityId: 'group-1' },
        headers: { Authorization: 'Bearer access-token-1' },
      });
    });
  });

  it('waits for auth initialization before checking route access', async () => {
    auth.loading = true;
    const { result, rerender } = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'group-1' })
    );

    expect(result.current.isLoading).toBe(true);
    expect(entityRouteAccessFn).not.toHaveBeenCalled();

    auth.loading = false;
    auth.session = { access_token: 'ready-token', user: { id: 'user-1' } };
    rerender();

    await waitFor(() => {
      expect(entityRouteAccessFn).toHaveBeenCalledWith(
        expect.objectContaining({ headers: { Authorization: 'Bearer ready-token' } })
      );
    });
  });

  it('rechecks on token changes and ignores a stale response', async () => {
    let resolveFirst:
      | ((value: { exists: boolean; visibilities: string[]; canAccessPrivate: boolean }) => void)
      | null = null;
    const firstResponse = new Promise<{
      exists: boolean;
      visibilities: string[];
      canAccessPrivate: boolean;
    }>(resolve => {
      resolveFirst = resolve;
    });
    vi.mocked(entityRouteAccessFn).mockImplementation(options => {
      const authorization = new Headers(options?.headers).get('authorization');
      if (authorization === 'Bearer old-token') return firstResponse;
      return Promise.resolve({
        exists: true,
        visibilities: ['private'],
        canAccessPrivate: true,
      });
    });
    auth.session = { access_token: 'old-token', user: { id: 'user-1' } };

    const { result, rerender } = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'group-1' })
    );
    await waitFor(() => expect(entityRouteAccessFn).toHaveBeenCalledTimes(1));

    auth.session = { access_token: 'new-token', user: { id: 'user-1' } };
    rerender();

    await waitFor(() => expect(result.current.data?.canAccessPrivate).toBe(true));

    await act(async () => {
      resolveFirst?.({
        exists: true,
        visibilities: ['private'],
        canAccessPrivate: false,
      });
      await firstResponse;
    });

    expect(result.current.data?.canAccessPrivate).toBe(true);
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
