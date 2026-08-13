/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'user' } as { id: string } | null,
  subscribers: [] as any[] | null,
  subscriberCount: null as number | null,
  queriedLoading: false,
  subscribe: vi.fn(() => ({ kind: 'subscribe' })),
  unsubscribe: vi.fn(({ id }: { id: string }) => ({ kind: 'unsubscribe', id })),
  waitForClientApply: vi.fn(async (result: unknown) => result),
  trackServerFinalization: vi.fn((_result: unknown, options: { onSuccess?: () => void }) =>
    options.onSuccess?.()
  ),
  tutorial: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  queriedGroupId: undefined as string | undefined,
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupSubscribers: (groupId: string | undefined) => {
    mocks.queriedGroupId = groupId;
    return {
      subscribers: mocks.subscribers,
      subscriberCount: mocks.subscriberCount,
      isLoading: mocks.queriedLoading,
    };
  },
}));
vi.mock('@/zero/common/useCommonActions', () => ({
  useCommonActions: () => ({ subscribe: mocks.subscribe, unsubscribe: mocks.unsubscribe }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
  trackServerFinalization: mocks.trackServerFinalization,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/app-tutorial/events', () => ({ reportAppTutorialAction: mocks.tutorial }));

import { useSubscribeGroup } from '../useSubscribeGroup';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'user' };
  mocks.subscribers = [];
  mocks.subscriberCount = null;
  mocks.queriedLoading = false;
  mocks.waitForClientApply.mockImplementation(async result => result);
  mocks.queriedGroupId = undefined;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
    'subscription-id' as `${string}-${string}-${string}-${string}-${string}`
  );
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('useSubscribeGroup', () => {
  it('derives facade subscription state from direct and related user rows', () => {
    mocks.subscribers = [{ id: 'direct', subscriber_id: 'user' }];
    mocks.subscriberCount = 5;
    const direct = renderHook(() => useSubscribeGroup('group'));
    expect(direct.result.current).toMatchObject({
      isSubscribed: true,
      subscriberCount: 5,
      isLoading: false,
      canSubscribe: true,
    });
    expect(mocks.queriedGroupId).toBe('group');

    mocks.subscribers = [{ id: 'related', subscriber_id: null, subscriber_user: { id: 'user' } }];
    mocks.subscriberCount = null;
    const related = renderHook(() => useSubscribeGroup('group'));
    expect(related.result.current.isSubscribed).toBe(true);
    expect(related.result.current.subscriberCount).toBe(1);

    mocks.user = null;
    mocks.subscribers = null;
    const anonymous = renderHook(() => useSubscribeGroup('group'));
    expect(anonymous.result.current).toMatchObject({
      isSubscribed: false,
      subscriberCount: 0,
      canSubscribe: false,
    });
  });

  it('uses projected subscriptions, counts, and loading without querying a target', () => {
    const projected = renderHook(() =>
      useSubscribeGroup('group', {
        subscriptions: [{ id: 'projected', subscriber_id: 'user' }],
        subscriberCount: 9,
        isLoading: true,
      })
    );
    expect(mocks.queriedGroupId).toBeUndefined();
    expect(projected.result.current).toMatchObject({
      isSubscribed: true,
      subscriberCount: 9,
    });

    const defaults = renderHook(() => useSubscribeGroup('group', {} as any));
    expect(defaults.result.current.subscriberCount).toBe(0);
  });

  it('guards subscribe and skips duplicate rows in both supported projections', async () => {
    mocks.user = null;
    const anonymous = renderHook(() => useSubscribeGroup('group'));
    await act(() => anonymous.result.current.subscribe());

    mocks.user = { id: 'user' };
    const noTarget = renderHook(() => useSubscribeGroup());
    await act(() => noTarget.result.current.subscribe());

    mocks.subscribers = [{ id: 'direct', subscriber_id: 'user' }];
    const direct = renderHook(() => useSubscribeGroup('group'));
    await act(() => direct.result.current.subscribe());

    mocks.subscribers = [{ id: 'related', subscriber_id: null, subscriber_user: { id: 'user' } }];
    const related = renderHook(() => useSubscribeGroup('group'));
    await act(() => related.result.current.subscribe());
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes optimistically, finalizes the tutorial event, and reconciles persisted state', async () => {
    mocks.subscribers = [];
    mocks.subscriberCount = 2;
    const hook = renderHook(() => useSubscribeGroup('group'));
    await act(() => hook.result.current.subscribe());
    expect(mocks.subscribe).toHaveBeenCalledWith({
      id: 'subscription-id',
      user_id: null,
      group_id: 'group',
      amendment_id: null,
      event_id: null,
      blog_id: null,
    });
    expect(mocks.tutorial).toHaveBeenCalledWith({ type: 'mutation', event: 'subscriber.created' });
    expect(hook.result.current).toMatchObject({
      isSubscribed: true,
      subscriberCount: 3,
      isLoading: false,
    });
    expect(mocks.success).toHaveBeenCalled();

    mocks.subscribers = [{ id: 'subscription-id', subscriber_id: 'user' }];
    mocks.subscriberCount = 7;
    hook.rerender();
    expect(hook.result.current).toMatchObject({ isSubscribed: true, subscriberCount: 7 });
  });

  it('rolls back a failed subscription', async () => {
    mocks.subscriberCount = 1;
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('subscribe failed'));
    const { result } = renderHook(() => useSubscribeGroup('group'));
    await act(() => result.current.subscribe());
    expect(result.current).toMatchObject({
      isSubscribed: false,
      subscriberCount: 1,
      isLoading: false,
    });
    expect(mocks.error).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('unsubscribes all matching rows and rolls back failures', async () => {
    mocks.subscribers = [
      { id: 'direct', subscriber_id: 'user' },
      { id: 'related', subscriber_id: null, subscriber_user: { id: 'user' } },
      { id: 'other', subscriber_id: 'other' },
    ];
    mocks.subscriberCount = 1;
    const success = renderHook(() => useSubscribeGroup('group'));
    await act(() => success.result.current.unsubscribe());
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(2);
    expect(success.result.current).toMatchObject({
      isSubscribed: false,
      subscriberCount: 0,
      isLoading: false,
    });

    vi.clearAllMocks();
    mocks.subscribers = [{ id: 'direct', subscriber_id: 'user' }];
    mocks.subscriberCount = 1;
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('unsubscribe failed'));
    const failed = renderHook(() => useSubscribeGroup('group'));
    await act(() => failed.result.current.unsubscribe());
    expect(failed.result.current).toMatchObject({
      isSubscribed: true,
      subscriberCount: 1,
      isLoading: false,
    });
    expect(mocks.error).toHaveBeenCalled();
  });

  it('uses the created-id fallback, handles unsubscribe guards, and toggles both directions', async () => {
    mocks.subscribers = [];
    const fallback = renderHook(() => useSubscribeGroup('group'));
    await act(() => fallback.result.current.subscribe());
    await act(() => fallback.result.current.unsubscribe());
    expect(mocks.unsubscribe).toHaveBeenCalledWith({ id: 'subscription-id' });

    mocks.user = null;
    const anonymous = renderHook(() => useSubscribeGroup('group'));
    await act(() => anonymous.result.current.unsubscribe());
    mocks.user = { id: 'user' };
    const noTarget = renderHook(() => useSubscribeGroup());
    await act(() => noTarget.result.current.unsubscribe());

    mocks.subscribers = [];
    const missing = renderHook(() => useSubscribeGroup('group'));
    await act(() => missing.result.current.unsubscribe());

    const toggleSubscribe = renderHook(() => useSubscribeGroup('group'));
    await act(() => toggleSubscribe.result.current.toggleSubscribe());
    expect(mocks.subscribe).toHaveBeenCalled();

    mocks.subscribers = [{ id: 'persisted', subscriber_id: 'user' }];
    const toggleUnsubscribe = renderHook(() => useSubscribeGroup('group'));
    await act(() => toggleUnsubscribe.result.current.toggleSubscribe());
    expect(mocks.unsubscribe).toHaveBeenCalledWith({ id: 'persisted' });
  });

  it('ignores toggle requests while a mutation is still loading', async () => {
    let resolveWait!: (value: unknown) => void;
    mocks.waitForClientApply.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveWait = resolve;
        })
    );
    const hook = renderHook(() => useSubscribeGroup('group'));
    let pending!: Promise<void>;
    await act(async () => {
      pending = hook.result.current.subscribe();
      await Promise.resolve();
    });
    expect(hook.result.current.isLoading).toBe(true);
    await act(() => hook.result.current.toggleSubscribe());
    expect(mocks.subscribe).toHaveBeenCalledOnce();
    resolveWait(undefined);
    await act(() => pending);
  });
});
