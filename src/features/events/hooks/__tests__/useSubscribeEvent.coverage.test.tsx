/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSubscribeEvent } from '../useSubscribeEvent';

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  query: {
    subscribers: [] as
      | {
          id: string;
          subscriber_id?: string | null;
          subscriber_user?: { id: string } | null;
        }[]
      | null,
    subscriberCount: undefined as number | undefined,
    isLoading: false,
  },
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  waitForClientApply: vi.fn(async (value: unknown) => await value),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/common/useCommonActions', () => ({
  useCommonActions: () => ({ subscribe: mocks.subscribe, unsubscribe: mocks.unsubscribe }),
}));
vi.mock('@/zero/events/useEventState', () => ({
  useEventSubscribers: () => mocks.query,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user-1' };
  mocks.query.subscribers = [];
  mocks.query.subscriberCount = undefined;
  mocks.query.isLoading = false;
  mocks.subscribe.mockResolvedValue(undefined);
  mocks.unsubscribe.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useSubscribeEvent coverage', () => {
  it('resolves persisted direct, related-user, anonymous, and projected subscriptions', async () => {
    mocks.query.subscribers = [
      { id: 'other', subscriber_id: 'other' },
      { id: 'mine', subscriber_id: 'user-1' },
    ];
    mocks.query.subscriberCount = 7;
    const direct = renderHook(() => useSubscribeEvent('event-1'));
    await waitFor(() => expect(direct.result.current.isSubscribed).toBe(true));
    expect(direct.result.current.subscriberCount).toBe(7);
    direct.unmount();

    mocks.query.subscribers = [{ id: 'mine-related', subscriber_user: { id: 'user-1' } }];
    mocks.query.subscriberCount = undefined;
    const related = renderHook(() => useSubscribeEvent('event-1'));
    await waitFor(() => expect(related.result.current.isSubscribed).toBe(true));
    expect(related.result.current.subscriberCount).toBe(1);
    await act(() => related.result.current.subscribe());
    related.unmount();

    mocks.user = null;
    mocks.query.subscribers = null;
    const anonymous = renderHook(() => useSubscribeEvent('event-1'));
    expect(anonymous.result.current.canSubscribe).toBe(false);
    expect(anonymous.result.current.isSubscribed).toBe(false);
    anonymous.unmount();

    const projected = renderHook(() =>
      useSubscribeEvent('event-1', {
        isLoading: true,
        subscriberCount: 4,
        subscriptions: [{ id: 'projected', subscriber_id: 'user-1' }],
      })
    );
    expect(projected.result.current.subscriberCount).toBe(4);
  });

  it('guards subscribing without identity, target, and duplicate rows', async () => {
    mocks.user = null;
    const anonymous = renderHook(() => useSubscribeEvent('event-1'));
    await act(() => anonymous.result.current.subscribe());
    await act(() => anonymous.result.current.unsubscribe());
    anonymous.unmount();

    mocks.user = { id: 'user-1' };
    const targetless = renderHook(() => useSubscribeEvent());
    await act(() => targetless.result.current.subscribe());
    await act(() => targetless.result.current.unsubscribe());
    expect(targetless.result.current.canSubscribe).toBe(false);
    targetless.unmount();

    mocks.query.subscribers = [{ id: 'existing', subscriber_id: 'user-1' }];
    const duplicate = renderHook(() => useSubscribeEvent('event-1'));
    await act(() => duplicate.result.current.subscribe());
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes optimistically and reconciles once persisted data matches', async () => {
    const hook = renderHook(() => useSubscribeEvent('event-1'));
    await act(() => hook.result.current.subscribe());
    expect(hook.result.current.isSubscribed).toBe(true);
    expect(hook.result.current.subscriberCount).toBe(1);
    expect(mocks.success).toHaveBeenCalledOnce();

    mocks.query.subscribers = [];
    mocks.query.subscriberCount = 9;
    hook.rerender();
    expect(hook.result.current.subscriberCount).toBe(1);

    mocks.query.subscribers = [{ id: 'persisted', subscriber_id: 'user-1' }];
    hook.rerender();
    await waitFor(() => expect(hook.result.current.subscriberCount).toBe(9));
  });

  it('reverts a failed subscription', async () => {
    mocks.subscribe.mockRejectedValueOnce(new Error('subscribe failed'));
    const hook = renderHook(() => useSubscribeEvent('event-1'));

    await act(() => hook.result.current.subscribe());

    expect(hook.result.current.isSubscribed).toBe(false);
    expect(hook.result.current.subscriberCount).toBe(0);
    expect(mocks.error).toHaveBeenCalledOnce();
  });

  it('unsubscribes every matching row and reconciles the optimistic removal', async () => {
    mocks.query.subscribers = [
      { id: 'mine-1', subscriber_id: 'user-1' },
      { id: 'mine-2', subscriber_user: { id: 'user-1' } },
      { id: 'other', subscriber_id: 'other' },
    ];
    const hook = renderHook(() => useSubscribeEvent('event-1'));
    await waitFor(() => expect(hook.result.current.subscriberCount).toBe(3));

    await act(() => hook.result.current.unsubscribe());
    expect(hook.result.current.isSubscribed).toBe(false);
    expect(hook.result.current.subscriberCount).toBe(1);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(2);

    mocks.query.subscribers = [{ id: 'other', subscriber_id: 'other' }];
    hook.rerender();
    await waitFor(() => expect(hook.result.current.subscriberCount).toBe(1));
  });

  it('uses the freshly created id when the query lags and restores failed removals', async () => {
    const lagging = renderHook(() => useSubscribeEvent('event-1'));
    await act(() => lagging.result.current.subscribe());
    await act(() => lagging.result.current.unsubscribe());
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    lagging.unmount();

    mocks.query.subscribers = [{ id: 'mine', subscriber_id: 'user-1' }];
    mocks.unsubscribe.mockRejectedValueOnce(new Error('unsubscribe failed'));
    const failed = renderHook(() => useSubscribeEvent('event-1'));
    await waitFor(() => expect(failed.result.current.isSubscribed).toBe(true));
    await act(() => failed.result.current.unsubscribe());
    expect(failed.result.current.isSubscribed).toBe(true);
    expect(failed.result.current.subscriberCount).toBe(1);
    expect(mocks.error).toHaveBeenCalledOnce();
  });

  it('guards empty unsubscriptions and all toggle paths, including an in-flight action', async () => {
    const empty = renderHook(() => useSubscribeEvent('event-1'));
    await act(() => empty.result.current.unsubscribe());

    let finish!: () => void;
    mocks.subscribe.mockReturnValueOnce(new Promise<void>(resolve => (finish = resolve)));
    const hook = renderHook(() => useSubscribeEvent('event-1'));
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.toggleSubscribe();
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(true));
    await act(() => hook.result.current.toggleSubscribe());
    expect(mocks.subscribe).toHaveBeenCalledOnce();
    finish();
    await act(() => pending);

    mocks.query.subscribers = [{ id: 'mine', subscriber_id: 'user-1' }];
    hook.rerender();
    await waitFor(() => expect(hook.result.current.isSubscribed).toBe(true));
    await act(() => hook.result.current.toggleSubscribe());
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
