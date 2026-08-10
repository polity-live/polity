/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { id: 'user' } as any,
  subscriberCount: 0 as any,
  subscribers: [] as any,
  isLoading: false as any,
}));
const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(() => 'subscribe-result'),
  unsubscribe: vi.fn(() => 'unsubscribe-result'),
  waitForClientApply: vi.fn(async (..._args: unknown[]): Promise<unknown> => undefined),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: state.user }),
}));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    subscriberCount: state.subscriberCount,
    subscribers: state.subscribers,
    isLoading: state.isLoading,
  }),
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ subscribe: mocks.subscribe, unsubscribe: mocks.unsubscribe }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => mocks.waitForClientApply(...args),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { useSubscribeAmendment } from '../useSubscribeAmendment';

describe('useSubscribeAmendment A04 branches', () => {
  beforeEach(() => {
    state.user = { id: 'user' };
    state.subscriberCount = 0;
    state.subscribers = [];
    state.isLoading = false;
    vi.clearAllMocks();
    mocks.subscribe.mockReturnValue('subscribe-result');
    mocks.unsubscribe.mockReturnValue('unsubscribe-result');
    mocks.waitForClientApply.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it('covers persisted, nested, unauthenticated, projected, and loading state resolution', async () => {
    state.subscriberCount = 2;
    state.subscribers = [{ id: 'direct', subscriber_id: 'user' }];
    const { result, rerender } = renderHook(
      ({ id, projected }: any) => useSubscribeAmendment(id, projected),
      { initialProps: { id: 'amendment', projected: undefined } }
    );
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
    expect(result.current.subscriberCount).toBe(2);

    state.subscribers = [{ id: 'nested', subscriber_id: null, subscriber_user: { id: 'user' } }];
    state.subscriberCount = 3;
    rerender({ id: 'amendment', projected: undefined });
    await waitFor(() => expect(result.current.subscriberCount).toBe(3));

    state.subscribers = null;
    rerender({
      id: 'amendment',
      projected: { subscriptions: null, subscriberCount: 7, isLoading: true },
    } as any);
    await waitFor(() => expect(result.current.isSubscribed).toBe(false));
    expect(result.current.subscriberCount).toBe(7);

    state.user = null;
    rerender({
      id: undefined,
      projected: { subscriptions: [], subscriberCount: 0, isLoading: false },
    } as any);
    await waitFor(() => expect(result.current.canSubscribe).toBe(false));
    await act(async () => result.current.subscribe());
    await act(async () => result.current.unsubscribe());
  });

  it('covers subscribe success, duplicate guard, optimistic reconciliation, and rollback', async () => {
    const { result, rerender } = renderHook(() => useSubscribeAmendment('amendment'));
    await act(async () => result.current.subscribe());
    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.subscriberCount).toBe(1);
    expect(mocks.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ amendment_id: 'amendment' })
    );

    state.subscriberCount = 0;
    state.subscribers = [];
    rerender();
    expect(result.current.isSubscribed).toBe(true);
    state.subscriberCount = 4;
    state.subscribers = [{ id: 'persisted', subscriber_id: 'user' }];
    rerender();
    await waitFor(() => expect(result.current.subscriberCount).toBe(4));
    await act(async () => result.current.subscribe());
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);

    state.subscribers = [
      { id: 'nested-persisted', subscriber_id: null, subscriber_user: { id: 'user' } },
    ];
    rerender();
    await act(async () => result.current.subscribe());
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);

    state.subscribers = [];
    state.subscriberCount = 0;
    rerender();
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('subscribe failed'));
    await act(async () => result.current.subscribe());
    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.subscriberCount).toBe(0);
    expect(mocks.error).toHaveBeenCalled();
  });

  it('covers unsubscribe rows, stored-id fallback, no-op, rollback, and optimistic match', async () => {
    state.subscriberCount = 2;
    state.subscribers = [
      { id: 'one', subscriber_id: 'user' },
      { id: 'two', subscriber_id: null, subscriber_user: { id: 'user' } },
    ];
    const direct = renderHook(() => useSubscribeAmendment('amendment'));
    await waitFor(() => expect(direct.result.current.isSubscribed).toBe(true));
    await act(async () => direct.result.current.unsubscribe());
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(2);
    expect(direct.result.current.subscriberCount).toBe(0);

    state.subscribers = [];
    state.subscriberCount = 0;
    const fallback = renderHook(() => useSubscribeAmendment('amendment'));
    await act(async () => fallback.result.current.subscribe());
    await act(async () => fallback.result.current.unsubscribe());
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(3);
    state.subscribers = [];
    fallback.rerender();
    await waitFor(() => expect(fallback.result.current.isSubscribed).toBe(false));
    await act(async () => fallback.result.current.unsubscribe());

    state.subscribers = [{ id: 'rollback', subscriber_id: 'user' }];
    state.subscriberCount = 1;
    const rollback = renderHook(() => useSubscribeAmendment('amendment'));
    await waitFor(() => expect(rollback.result.current.isSubscribed).toBe(true));
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('unsubscribe failed'));
    await act(async () => rollback.result.current.unsubscribe());
    expect(rollback.result.current.isSubscribed).toBe(true);
    expect(rollback.result.current.subscriberCount).toBe(1);
  });

  it('covers toggle subscribe, unsubscribe, and loading guard', async () => {
    const hook = renderHook(() => useSubscribeAmendment('amendment'));
    await act(async () => hook.result.current.toggleSubscribe());
    expect(hook.result.current.isSubscribed).toBe(true);
    await act(async () => hook.result.current.toggleSubscribe());
    expect(hook.result.current.isSubscribed).toBe(false);

    let resolveSubscribe: (() => void) | undefined;
    mocks.waitForClientApply.mockImplementationOnce(
      () => new Promise<void>(resolve => (resolveSubscribe = resolve))
    );
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = hook.result.current.subscribe();
    });
    expect(hook.result.current.isLoading).toBe(true);
    await act(async () => hook.result.current.toggleSubscribe());
    resolveSubscribe?.();
    await act(async () => pending);
  });
});
