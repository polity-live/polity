/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntityRouteAccess, type RouteOwnerEvidence } from '../useEntityRouteAccess';
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

  it('displays an authoritatively synced owned resource while server validation remains pending', async () => {
    auth.session = { access_token: 'token', user: { id: 'owner' } };
    let resolve!: (value: {
      exists: boolean;
      visibilities: string[];
      canAccessPrivate: boolean;
    }) => void;
    vi.mocked(entityRouteAccessFn).mockReturnValue(
      new Promise(done => {
        resolve = done;
      })
    );
    const { result } = renderHook(() =>
      useEntityRouteAccess(
        { entityType: 'group', entityId: 'group-1' },
        {
          entityType: 'group',
          entityId: 'group-1',
          ownerId: 'owner',
          visibility: 'private',
          complete: true,
        }
      )
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({
      exists: true,
      visibilities: ['private'],
      canAccessPrivate: true,
    });
    expect(entityRouteAccessFn).toHaveBeenCalledTimes(1);
    await act(async () =>
      resolve({ exists: true, visibilities: ['private'], canAccessPrivate: false })
    );
    expect(result.current.data?.canAccessPrivate).toBe(false);
  });

  it('keeps a server-approved view mounted when its first row arrives, but withdraws it on evidence loss', async () => {
    auth.session = { access_token: 'token', user: { id: 'member' } };
    vi.mocked(entityRouteAccessFn)
      .mockResolvedValueOnce({ exists: true, visibilities: ['private'], canAccessPrivate: true })
      .mockImplementation(
        () =>
          new Promise(() => {
            // Leave the refresh pending while local authorization is withdrawn.
          })
      );
    const owner: RouteOwnerEvidence = {
      entityType: 'group',
      entityId: 'group-1',
      ownerId: undefined,
      visibility: undefined,
      complete: false,
    };
    const seen: boolean[] = [];
    const { result, rerender } = renderHook(
      ({ evidence }) => {
        const access = useEntityRouteAccess({ entityType: 'group', entityId: 'group-1' }, evidence);
        seen.push(access.isLoading);
        return access;
      },
      { initialProps: { evidence: owner } }
    );
    await waitFor(() => expect(result.current.data?.canAccessPrivate).toBe(true));
    seen.length = 0;
    rerender({ evidence: { ...owner, ownerId: 'other', visibility: 'private', complete: true } });
    expect(seen.every(loading => !loading)).toBe(true);
    expect(entityRouteAccessFn).toHaveBeenCalledTimes(2);
    expect(result.current.data?.canAccessPrivate).toBe(true);
    rerender({ evidence: owner });
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(entityRouteAccessFn).toHaveBeenCalledTimes(3);
  });

  it.each([
    'incomplete',
    'ownership',
    'deletion',
    'entity',
    'type',
    'parent',
    'account',
    'sign-out',
  ] as const)(
    'requires current authoritative ownership and withdraws the fast path on %s changes',
    async change => {
      auth.session = { access_token: 'token', user: { id: 'owner' } };
      vi.mocked(entityRouteAccessFn).mockReturnValue(
        new Promise(() => {
          // Keep revalidation pending while verifying each live ownership transition.
        })
      );
      const initial = {
        input: { entityType: 'group' as const, entityId: 'group-1' },
        owner: {
          entityType: 'group' as RouteOwnerEvidence['entityType'],
          entityId: 'group-1',
          ownerId: 'owner' as string | null,
          visibility: 'private',
          complete: true,
        },
      };
      const { result, rerender } = renderHook(
        ({ input, owner }) => useEntityRouteAccess(input, owner),
        { initialProps: initial }
      );
      expect(result.current.data?.canAccessPrivate).toBe(true);
      const next = { input: { ...initial.input }, owner: { ...initial.owner } };
      if (change === 'incomplete') next.owner.complete = false;
      if (change === 'ownership') next.owner.ownerId = 'other';
      if (change === 'deletion') {
        next.owner.ownerId = null;
        next.owner.complete = false;
      }
      if (change === 'entity') next.owner.entityId = 'group-2';
      if (change === 'type') next.owner.entityType = 'event';
      if (change === 'parent')
        Object.assign(next.input, { parentType: 'group', parentId: 'parent' });
      if (change === 'account')
        auth.session = { access_token: 'other-token', user: { id: 'other' } };
      if (change === 'sign-out') auth.session = null;
      rerender(next);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeNull();
    }
  );

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

  it('keeps the same route mounted during token refresh and applies revoked access', async () => {
    const allowed = { exists: true, visibilities: ['private'], canAccessPrivate: true };
    vi.mocked(entityRouteAccessFn).mockResolvedValueOnce(allowed);
    auth.session = { access_token: 'old-token', user: { id: 'user-1' } };
    const { result, rerender } = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'group-1' })
    );
    await waitFor(() => expect(result.current.data).toEqual(allowed));

    let resolveRefresh!: (value: typeof allowed) => void;
    vi.mocked(entityRouteAccessFn).mockReturnValueOnce(
      new Promise(resolve => {
        resolveRefresh = resolve;
      })
    );
    auth.session = { access_token: 'new-token', user: { id: 'user-1' } };
    rerender();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(allowed);
    expect(entityRouteAccessFn).toHaveBeenLastCalledWith({
      data: { entityType: 'group', entityId: 'group-1' },
      headers: { Authorization: 'Bearer new-token' },
    });

    await act(async () => resolveRefresh({ ...allowed, canAccessPrivate: false }));
    expect(result.current.data?.canAccessPrivate).toBe(false);
  });

  it.each(['entityId', 'entityType', 'parentId', 'parentType', 'account', 'sign-out'] as const)(
    'discards cached access immediately when %s changes',
    async change => {
      const allowed = { exists: true, visibilities: ['private'], canAccessPrivate: true };
      vi.mocked(entityRouteAccessFn).mockResolvedValueOnce(allowed);
      auth.session = { access_token: 'old-token', user: { id: 'user-1' } };
      const input: Parameters<typeof useEntityRouteAccess>[0] = {
        entityType: 'group',
        entityId: 'group-1',
      };
      const seen: ReturnType<typeof useEntityRouteAccess>['data'][] = [];
      const { result, rerender } = renderHook(
        (props: Parameters<typeof useEntityRouteAccess>[0]) => {
          const value = useEntityRouteAccess(props);
          seen.push(value.data);
          return value;
        },
        { initialProps: input }
      );
      await waitFor(() => expect(result.current.data).toEqual(allowed));
      vi.mocked(entityRouteAccessFn).mockReturnValueOnce(
        new Promise(() => {
          // Leave the next request pending to inspect access before its response.
        })
      );
      seen.length = 0;
      if (change === 'account')
        auth.session = { access_token: 'other-token', user: { id: 'user-2' } };
      else if (change === 'sign-out') auth.session = null;
      const nextInput =
        change === 'entityId'
          ? { ...input, entityId: 'group-2' }
          : change === 'entityType'
            ? { ...input, entityType: 'event' as const }
            : change === 'parentId'
              ? { ...input, parentId: 'parent-2' }
              : change === 'parentType'
                ? { ...input, parentType: 'group' as const }
                : input;
      rerender(nextInput);
      expect(result.current.isLoading).toBe(true);
      expect(seen.every(value => value === null)).toBe(true);
    }
  );

  it('removes cached access when revalidation fails', async () => {
    vi.mocked(entityRouteAccessFn).mockResolvedValueOnce({
      exists: true,
      visibilities: ['private'],
      canAccessPrivate: true,
    });
    auth.session = { access_token: 'old-token', user: { id: 'user-1' } };
    const { result, rerender } = renderHook(() =>
      useEntityRouteAccess({ entityType: 'group', entityId: 'group-1' })
    );
    await waitFor(() => expect(result.current.data?.canAccessPrivate).toBe(true));
    vi.mocked(entityRouteAccessFn).mockRejectedValueOnce(new Error('Access unavailable'));
    auth.session = { access_token: 'new-token', user: { id: 'user-1' } };
    rerender();
    await waitFor(() => expect(result.current.error?.message).toBe('Access unavailable'));
    expect(result.current.data).toBeNull();
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
