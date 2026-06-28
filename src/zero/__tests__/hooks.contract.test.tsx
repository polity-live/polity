// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookMocks = vi.hoisted(() => {
  const token = (key: string, args: unknown) => ({ key, args });

  return {
    token,
    useQuery: vi.fn(),
    useZero: vi.fn(),
    zeroMutate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    onServerError: vi.fn(),
    waitForClientApply: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
    t: vi.fn((key: string) => key),
    userMutators: {
      updateProfile: vi.fn((args: unknown) => token('mutators.users.updateProfile', args)),
      follow: vi.fn((args: unknown) => token('mutators.users.follow', args)),
      unfollow: vi.fn((args: unknown) => token('mutators.users.unfollow', args)),
    },
    userQueries: {
      current: vi.fn((args: unknown) => token('queries.users.current', args)),
      byId: vi.fn((args: unknown) => token('queries.users.byId', args)),
      followers: vi.fn((args: unknown) => token('queries.users.followers', args)),
      following: vi.fn((args: unknown) => token('queries.users.following', args)),
      publicUsers: vi.fn((args: unknown) => token('queries.users.publicUsers', args)),
      allUsers: vi.fn((args: unknown) => token('queries.users.allUsers', args)),
      fullProfile: vi.fn((args: unknown) => token('queries.users.fullProfile', args)),
      withGroupMemberships: vi.fn((args: unknown) =>
        token('queries.users.withGroupMemberships', args)
      ),
      searchableUsers: vi.fn((args: unknown) => token('queries.users.searchableUsers', args)),
    },
  };
});

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (...args: unknown[]) => hookMocks.useQuery(...args),
  useZero: () => hookMocks.useZero(),
}));

vi.mock('../queries', () => ({
  queries: {
    users: hookMocks.userQueries,
  },
}));

vi.mock('../mutators', () => ({
  mutators: {
    users: hookMocks.userMutators,
  },
}));

vi.mock('../mutate-with-server-check', () => ({
  onServerError: (...args: unknown[]) => hookMocks.onServerError(...args),
  waitForClientApply: (...args: unknown[]) => hookMocks.waitForClientApply(...args),
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    success: (...args: unknown[]) => hookMocks.toastSuccess(...args),
    error: (...args: unknown[]) => hookMocks.toastError(...args),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: hookMocks.t }),
}));

import { useUserActions } from '../users/useUserActions';
import { useUserState } from '../users/useUserState';

const complete = { type: 'complete' };

beforeEach(() => {
  vi.clearAllMocks();
  hookMocks.zeroMutate.mockReturnValue({
    server: Promise.resolve({ type: 'success' }),
  });
  hookMocks.useZero.mockReturnValue({
    mutate: hookMocks.zeroMutate,
  });
  hookMocks.useQuery.mockImplementation((query: { key?: string } | undefined) => {
    if (!query) return [undefined, complete];

    if (query.key === 'queries.users.current') {
      return [[{ id: 'user-1' }], complete];
    }
    if (query.key === 'queries.users.followers') {
      return [[{ id: 'follow-1' }, { id: 'follow-2' }], complete];
    }
    if (query.key === 'queries.users.following') {
      return [[{ id: 'following-1' }], complete];
    }
    if (query.key === 'queries.users.fullProfile') {
      return [
        [
          {
            id: 'user-2',
            group_memberships: [
              {
                id: 'membership-1',
                role: { id: 'fallback-role', name: 'Fallback', sort_order: 0 },
                membership_roles: [
                  { role: { id: 'role-low', name: 'Low', sort_order: 1 } },
                  { role: { id: 'role-high', name: 'High', sort_order: 10 } },
                ],
              },
            ],
          },
        ],
        complete,
      ];
    }

    return [[], complete];
  });
});

describe('Zero React hook contracts', () => {
  it('normalizes user profile memberships and only enables requested user queries', () => {
    const { result } = renderHook(() =>
      useUserState({
        userId: 'user-2',
        includeFullProfile: true,
        includePublicUsers: true,
      })
    );

    expect(hookMocks.userQueries.current).toHaveBeenCalledWith({});
    expect(hookMocks.userQueries.byId).toHaveBeenCalledWith({ id: 'user-2' });
    expect(hookMocks.userQueries.fullProfile).toHaveBeenCalledWith({ id: 'user-2' });
    expect(hookMocks.userQueries.publicUsers).toHaveBeenCalledWith({});
    expect(hookMocks.userQueries.allUsers).not.toHaveBeenCalled();
    expect(hookMocks.userQueries.searchableUsers).not.toHaveBeenCalled();
    expect(result.current.followerCount).toBe(2);
    expect(result.current.followingCount).toBe(1);
    const normalizedMembership = (result.current.fullProfile as any[])[0].group_memberships[0];
    expect(normalizedMembership.role).toEqual({
      id: 'role-high',
      name: 'High',
      sort_order: 10,
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('marks user state as loading when an enabled query is unknown', () => {
    hookMocks.useQuery.mockImplementation((query: { key?: string } | undefined) => {
      if (!query) return [undefined, complete];
      return [[], { type: query.key === 'queries.users.publicUsers' ? 'unknown' : 'complete' }];
    });

    const { result } = renderHook(() => useUserState({ includePublicUsers: true }));

    expect(result.current.isLoading).toBe(true);
  });

  it('routes user actions through Zero mutate and background server-error handling', () => {
    const mutationResult = { server: Promise.resolve({ type: 'success' }) };
    hookMocks.zeroMutate.mockReturnValueOnce(mutationResult);

    const { result } = renderHook(() => useUserActions());

    act(() => {
      result.current.updateProfile({ first_name: 'Ada' });
    });

    expect(hookMocks.userMutators.updateProfile).toHaveBeenCalledWith({ first_name: 'Ada' });
    expect(hookMocks.zeroMutate).toHaveBeenCalledWith({
      key: 'mutators.users.updateProfile',
      args: { first_name: 'Ada' },
    });
    expect(hookMocks.toastSuccess).toHaveBeenCalledWith('features.user.toasts.profileUpdated');
    expect(hookMocks.onServerError).toHaveBeenCalledWith(mutationResult, expect.any(Function));
  });

  it('awaits client apply for client-applied user actions', async () => {
    const mutationResult = { server: Promise.resolve({ type: 'success' }) };
    hookMocks.zeroMutate.mockReturnValueOnce(mutationResult);

    const { result } = renderHook(() => useUserActions());

    await act(async () => {
      await result.current.updateProfileClientApplied({ last_name: 'Lovelace' });
    });

    expect(hookMocks.userMutators.updateProfile).toHaveBeenCalledWith({ last_name: 'Lovelace' });
    expect(hookMocks.waitForClientApply).toHaveBeenCalledWith(mutationResult);
  });
});
