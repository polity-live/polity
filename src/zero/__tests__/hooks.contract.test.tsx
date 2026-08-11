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
    paymentQueries: {
      byUser: vi.fn((args: unknown) => token('queries.payments.byUser', args)),
      subscriptionStatus: vi.fn((args: unknown) =>
        token('queries.payments.subscriptionStatus', args)
      ),
      subscriptionStatusByUser: vi.fn((args: unknown) =>
        token('queries.payments.subscriptionStatusByUser', args)
      ),
    },
    pqlQueries: {
      byScope: vi.fn((args: unknown) => token('queries.pql.byScope', args)),
    },
    votingPasswordQueries: {
      userHasVotingPassword: vi.fn((args: unknown) =>
        token('queries.votingPassword.userHasVotingPassword', args)
      ),
    },
    pqlMutators: {
      create: vi.fn((args: unknown) => token('mutators.pql.create', args)),
      update: vi.fn((args: unknown) => token('mutators.pql.update', args)),
      delete: vi.fn((args: unknown) => token('mutators.pql.delete', args)),
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
    payments: hookMocks.paymentQueries,
    pql: hookMocks.pqlQueries,
    votingPassword: hookMocks.votingPasswordQueries,
  },
}));

vi.mock('../mutators', () => ({
  mutators: {
    users: hookMocks.userMutators,
    pql: hookMocks.pqlMutators,
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
import { useUserBasicState } from '../users/useUserBasicState';
import { useUserState } from '../users/useUserState';
import { usePaymentState, useSubscriptionStatusByUser } from '../payments/usePaymentState';
import { usePqlFilterActions } from '../pql/usePqlFilterActions';
import { usePqlFilterState } from '../pql/usePqlFilterState';
import { useVotingPasswordState } from '../voting-password/useVotingPasswordState';

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
    if (query.key === 'queries.payments.byUser') return [[{ id: 'payment-1' }], complete];
    if (query.key === 'queries.payments.subscriptionStatus') {
      return [[{ id: 'subscription-1' }], complete];
    }
    if (query.key === 'queries.payments.subscriptionStatusByUser') {
      return [[{ id: 'subscription-2' }], complete];
    }
    if (query.key === 'queries.pql.byScope') return [[{ id: 'filter-1' }], complete];
    if (query.key === 'queries.votingPassword.userHasVotingPassword') {
      return [[{ id: 'password-1' }], complete];
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
    expect(hookMocks.userQueries.fullProfile).toHaveBeenCalledWith({
      id: 'user-2',
      now: expect.any(Number),
    });
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

  it('enables the focused user query only when an id is present', () => {
    const absent = renderHook(() => useUserBasicState()).result;
    expect(absent.current).toEqual({ user: undefined, isLoading: false });

    const present = renderHook(() => useUserBasicState('user-2')).result;
    expect(hookMocks.userQueries.byId).toHaveBeenCalledWith({ id: 'user-2' });
    expect(present.current).toEqual({ user: [], isLoading: false });

    hookMocks.useQuery.mockReturnValueOnce([[], { type: 'unknown' }]);
    expect(renderHook(() => useUserBasicState('user-3')).result.current.isLoading).toBe(true);
  });

  it('combines payment query states and supports focused subscription reads', () => {
    const paymentState = renderHook(() => usePaymentState()).result.current;
    expect(paymentState).toEqual({
      payments: [{ id: 'payment-1' }],
      subscriptionStatus: [{ id: 'subscription-1' }],
      isLoading: false,
    });

    hookMocks.useQuery
      .mockReturnValueOnce([[], { type: 'unknown' }])
      .mockReturnValueOnce([[], complete]);
    expect(renderHook(() => usePaymentState()).result.current.isLoading).toBe(true);
    hookMocks.useQuery
      .mockReturnValueOnce([[], complete])
      .mockReturnValueOnce([[], { type: 'unknown' }]);
    expect(renderHook(() => usePaymentState()).result.current.isLoading).toBe(true);

    expect(renderHook(() => useSubscriptionStatusByUser()).result.current).toEqual({
      subscriptionStatus: undefined,
      isLoading: false,
    });
    hookMocks.useQuery.mockReturnValueOnce([[], { type: 'unknown' }]);
    expect(renderHook(() => useSubscriptionStatusByUser('user-2')).result.current.isLoading).toBe(
      true
    );
    expect(hookMocks.paymentQueries.subscriptionStatusByUser).toHaveBeenCalledWith({
      userId: 'user-2',
    });
  });

  it('derives voting-password state for disabled, present and loading queries', () => {
    expect(renderHook(() => useVotingPasswordState()).result.current).toEqual({
      hasVotingPassword: false,
      isLoading: false,
    });
    expect(renderHook(() => useVotingPasswordState({ userId: 'user-1' })).result.current).toEqual({
      hasVotingPassword: true,
      isLoading: false,
    });
    hookMocks.useQuery.mockReturnValueOnce([undefined, { type: 'unknown' }]);
    expect(renderHook(() => useVotingPasswordState({ userId: 'user-2' })).result.current).toEqual({
      hasVotingPassword: false,
      isLoading: true,
    });
  });

  it('normalizes disabled and scoped PQL filter reads', () => {
    expect(renderHook(() => usePqlFilterState()).result.current).toEqual({
      filters: [],
      isLoading: false,
    });
    expect(renderHook(() => usePqlFilterState({ storage_key: 'timeline' })).result.current).toEqual(
      { filters: [{ id: 'filter-1' }], isLoading: false }
    );
    expect(hookMocks.pqlQueries.byScope).toHaveBeenCalledWith({
      storage_key: 'timeline',
      group_id: null,
    });
    hookMocks.useQuery.mockReturnValueOnce([undefined, { type: 'unknown' }]);
    expect(
      renderHook(() => usePqlFilterState({ storage_key: 'group', group_id: 'group-1' })).result
        .current
    ).toEqual({ filters: [], isLoading: true });
  });

  it('routes PQL create, update and delete through Zero with error observers', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    hookMocks.onServerError.mockImplementation((_result, callback) => callback('conflict'));
    const { result } = renderHook(() => usePqlFilterActions());

    act(() => {
      result.current.createFilter({
        id: 'filter-1',
        storage_key: 'timeline',
        label: 'Mine',
        query: 'author:me',
        is_active: true,
      });
      result.current.createFilter({
        id: 'filter-2',
        storage_key: 'group',
        group_id: 'group-1',
        label: 'Group',
        query: '',
        is_active: false,
      });
      result.current.updateFilter({ id: 'filter-1', label: 'Updated' });
      result.current.deleteFilter('filter-2');
    });

    expect(hookMocks.pqlMutators.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'filter-1',
        group_id: null,
      })
    );
    expect(hookMocks.pqlMutators.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'filter-2',
        group_id: 'group-1',
      })
    );
    expect(hookMocks.pqlMutators.update).toHaveBeenCalledWith({ id: 'filter-1', label: 'Updated' });
    expect(hookMocks.pqlMutators.delete).toHaveBeenCalledWith({ id: 'filter-2' });
    expect(hookMocks.zeroMutate).toHaveBeenCalledTimes(4);
    expect(hookMocks.onServerError).toHaveBeenCalledTimes(4);
    expect(error).toHaveBeenCalledTimes(4);
  });
});
