/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authUser: { id: 'viewer' } as { id: string } | null,
  targetUser: undefined as { id: string; subscriber_count?: number | null } | undefined,
  rows: undefined as
    | {
        id: string;
        subscriber_id?: string | null;
        subscriber_user?: { id: string } | null;
      }[]
    | undefined,
  waitForApply: vi.fn(async (value: unknown) => value),
  subscribe: vi.fn((input: unknown) => input),
  unsubscribe: vi.fn((input: unknown) => input),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { kind?: string } | undefined) => {
    if (query?.kind === 'user') return [state.targetUser];
    if (query?.kind === 'subscribers') return [state.rows];
    return [undefined];
  },
}));

vi.mock('@/zero/common/useCommonActions', () => ({
  useCommonActions: () => ({
    subscribe: state.subscribe,
    unsubscribe: state.unsubscribe,
  }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: state.authUser }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => state.waitForApply(value),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    users: { byId: ({ id }: { id: string }) => ({ kind: 'user', id }) },
    common: {
      userSubscribers: ({ user_id }: { user_id: string }) => ({
        kind: 'subscribers',
        user_id,
      }),
    },
  },
}));

import { useSubscribeUser } from '../useSubscribeUser';

describe('useSubscribeUser', () => {
  beforeEach(() => {
    state.authUser = { id: 'viewer' };
    state.targetUser = { id: 'target', subscriber_count: 7 };
    state.rows = [];
    state.waitForApply.mockReset().mockImplementation(async value => value);
    state.subscribe.mockReset().mockImplementation(input => input);
    state.unsubscribe.mockReset().mockImplementation(input => input);
    vi.stubGlobal('crypto', { randomUUID: () => 'new-subscription-id' });
  });

  it('derives queried and nested subscriber state and count fallbacks', () => {
    state.rows = [
      { id: 'other', subscriber_id: 'other-user' },
      { id: 'mine', subscriber_user: { id: 'viewer' } },
    ];
    const { result, rerender } = renderHook(() => useSubscribeUser('target'));
    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.subscriberCount).toBe(2);
    expect(result.current.canSubscribe).toBe(true);

    state.authUser = null;
    state.rows = undefined;
    state.targetUser = { id: 'target', subscriber_count: 7 };
    rerender();
    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.subscriberCount).toBe(7);
    expect(result.current.canSubscribe).toBeUndefined();

    state.targetUser = { id: 'target', subscriber_count: null };
    rerender();
    expect(result.current.subscriberCount).toBe(0);
  });

  it('prefers projected subscription state and reconciles optimistic subscribe success', async () => {
    const projected = {
      subscriptions: [] as { id: string; subscriber_id: string }[],
      subscriberCount: 3,
      isLoading: true,
    };
    const { result, rerender } = renderHook(() => useSubscribeUser('target', projected));
    expect(result.current.subscriberCount).toBe(3);

    await act(() => result.current.subscribe());
    expect(result.current).toMatchObject({
      isSubscribed: true,
      subscriberCount: 4,
      isLoading: false,
    });
    expect(state.subscribe).toHaveBeenCalledWith({
      id: 'new-subscription-id',
      user_id: 'target',
      group_id: null,
      amendment_id: null,
      event_id: null,
      blog_id: null,
    });

    projected.subscriptions = [{ id: 'new-subscription-id', subscriber_id: 'viewer' }];
    projected.subscriberCount = 4;
    rerender();
    expect(result.current.subscriberCount).toBe(4);
  });

  it('keeps optimistic state while persistence disagrees and rolls back subscribe errors', async () => {
    const projected = { subscriptions: [], subscriberCount: 1, isLoading: false };
    let rejectApply: ((error: Error) => void) | undefined;
    state.waitForApply.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectApply = reject;
        })
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result, rerender } = renderHook(() => useSubscribeUser('target', projected));

    let pending: Promise<void>;
    act(() => {
      pending = result.current.subscribe();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    projected.isLoading = true;
    rerender();
    expect(result.current).toMatchObject({ isSubscribed: true, subscriberCount: 2 });

    await act(async () => {
      rejectApply?.(new Error('subscribe failed'));
      await pending;
    });
    expect(result.current).toMatchObject({
      isSubscribed: false,
      subscriberCount: 1,
      isLoading: false,
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('rejects invalid and duplicate subscriptions', async () => {
    const { result, rerender } = renderHook(
      ({ targetId }: { targetId?: string }) => useSubscribeUser(targetId),
      { initialProps: { targetId: undefined as string | undefined } }
    );
    await act(() => result.current.subscribe());

    rerender({ targetId: 'target' });
    state.authUser = null;
    rerender({ targetId: 'target' });
    await act(() => result.current.subscribe());

    state.authUser = { id: 'target' };
    rerender({ targetId: 'target' });
    await act(() => result.current.subscribe());

    state.authUser = { id: 'viewer' };
    state.rows = [{ id: 'existing', subscriber_id: 'viewer' }];
    rerender({ targetId: 'target' });
    await act(() => result.current.subscribe());
    state.rows = [{ id: 'nested-existing', subscriber_user: { id: 'viewer' } }];
    rerender({ targetId: 'target' });
    await act(() => result.current.subscribe());

    expect(state.subscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes all matching rows and clamps the optimistic count at zero', async () => {
    const projected = {
      subscriptions: [
        { id: 'direct', subscriber_id: 'viewer' },
        { id: 'nested', subscriber_id: 'another', subscriber_user: { id: 'viewer' } },
        { id: 'other', subscriber_id: 'other' },
      ],
      subscriberCount: 1,
      isLoading: false,
    };
    const { result } = renderHook(() => useSubscribeUser('target', projected));

    await act(() => result.current.unsubscribe());

    expect(state.unsubscribe.mock.calls).toEqual([[{ id: 'direct' }], [{ id: 'nested' }]]);
    expect(result.current).toMatchObject({ isSubscribed: false, subscriberCount: 0 });
  });

  it('uses the created id before reactive rows catch up and rolls back unsubscribe errors', async () => {
    const projected = { subscriptions: [], subscriberCount: 0, isLoading: false };
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useSubscribeUser('target', projected));
    await act(() => result.current.subscribe());

    state.waitForApply.mockRejectedValueOnce(new Error('unsubscribe failed'));
    await act(() => result.current.unsubscribe());

    expect(state.unsubscribe).toHaveBeenCalledWith({ id: 'new-subscription-id' });
    expect(result.current).toMatchObject({ isSubscribed: true, subscriberCount: 1 });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('ignores invalid or absent unsubscribe targets', async () => {
    const { result, rerender } = renderHook(
      ({ targetId }: { targetId?: string }) => useSubscribeUser(targetId),
      { initialProps: { targetId: undefined as string | undefined } }
    );
    await act(() => result.current.unsubscribe());

    state.authUser = null;
    rerender({ targetId: 'target' });
    await act(() => result.current.unsubscribe());

    state.authUser = { id: 'viewer' };
    rerender({ targetId: 'target' });
    await act(() => result.current.unsubscribe());
    expect(state.unsubscribe).not.toHaveBeenCalled();
  });

  it('toggles both directions and ignores a second toggle while a mutation is loading', async () => {
    let resolveApply: ((value: unknown) => void) | undefined;
    state.waitForApply.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveApply = resolve;
        })
    );
    const projected: {
      subscriptions: { id: string; subscriber_id: string }[];
      subscriberCount: number;
      isLoading: boolean;
    } = { subscriptions: [], subscriberCount: 0, isLoading: false };
    const { result, rerender } = renderHook(() => useSubscribeUser('target', projected));

    let pending: Promise<void>;
    act(() => {
      pending = result.current.toggleSubscribe();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    await act(() => result.current.toggleSubscribe());
    expect(state.subscribe).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveApply?.(undefined);
      await pending;
    });

    projected.subscriptions = [{ id: 'persisted', subscriber_id: 'viewer' }];
    projected.subscriberCount = 1;
    rerender();
    await act(() => result.current.toggleSubscribe());
    expect(state.unsubscribe).toHaveBeenCalledWith({ id: 'persisted' });
  });
});
