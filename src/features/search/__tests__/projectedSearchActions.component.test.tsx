/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectedSubscriptionState } from '../types/projected-card-state';

const mocks = vi.hoisted(() => ({
  user: { id: 'viewer' } as { id: string } | null,
  subscribe: vi.fn(() => ({})),
  unsubscribe: vi.fn(() => ({})),
  queriedTargets: [] as unknown[],
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/zero/observed-query', () => ({
  useQuery: (query: unknown) => {
    mocks.queriedTargets.push(query);
    return [undefined, { type: 'unknown' }];
  },
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupSubscribers: (id: unknown) => {
    mocks.queriedTargets.push(id);
    return { subscribers: [], subscriberCount: 0, isLoading: false };
  },
}));
vi.mock('@/zero/events/useEventState', () => ({
  useEventSubscribers: (id: unknown) => {
    mocks.queriedTargets.push(id);
    return { subscribers: [], subscriberCount: 0, isLoading: false };
  },
}));
vi.mock('@/zero/amendments/useAmendmentActionState', () => ({
  useAmendmentSubscriptionState: ({ amendmentId }: { amendmentId: unknown }) => {
    mocks.queriedTargets.push(amendmentId);
    return { subscribers: [], subscriberCount: 0, isLoading: false };
  },
}));
vi.mock('@/zero/blogs/useBlogState', () => ({
  useBlogState: ({ blogId }: { blogId: unknown }) => {
    mocks.queriedTargets.push(blogId);
    return { subscribers: [], subscriberCount: 0 };
  },
}));
vi.mock('@/zero/common/useCommonActions', () => ({
  useCommonActions: () => ({ subscribe: mocks.subscribe, unsubscribe: mocks.unsubscribe }),
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ subscribe: mocks.subscribe, unsubscribe: mocks.unsubscribe }),
}));
vi.mock('@/zero/blogs/useBlogActions', () => ({
  useBlogActions: () => ({
    subscribeToBlog: mocks.subscribe,
    unsubscribeFromBlog: mocks.unsubscribe,
  }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: async (result: unknown) => result,
  trackServerFinalization: vi.fn(),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/features/app-tutorial/events', () => ({ reportAppTutorialAction: vi.fn() }));

import { useSubscribeGroup } from '@/features/groups/hooks/useSubscribeGroup';
import { useSubscribeEvent } from '@/features/events/hooks/useSubscribeEvent';
import { useSubscribeAmendment } from '@/features/amendments/hooks/useSubscribeAmendment';
import { useSubscribeBlog } from '@/features/blogs/hooks/useSubscribeBlog';
import { useSubscribeUser } from '@/features/payments/hooks/useSubscribeUser';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'viewer' };
  mocks.queriedTargets = [];
});
afterEach(cleanup);

const hooks = [
  ['group', useSubscribeGroup],
  ['event', useSubscribeEvent],
  ['amendment', useSubscribeAmendment],
  ['blog', useSubscribeBlog],
  ['user', useSubscribeUser],
] as const;

describe.each(hooks)('projected %s subscription actions', (_type, useSubscription) => {
  it('blocks every subscription mutation while viewer state loads and enables the resolved action', async () => {
    const loading: ProjectedSubscriptionState = {
      isLoading: true,
      subscriberCount: 12,
      subscriptions: [{ id: 'existing', subscriber_id: 'viewer' }],
    };
    const { result, rerender } = renderHook(
      ({ projected }) => useSubscription('target', projected),
      { initialProps: { projected: loading } }
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.subscriberCount).toBe(12);
    expect(mocks.queriedTargets.every(target => target === undefined)).toBe(true);
    await act(async () => {
      await result.current.subscribe();
      await result.current.unsubscribe();
      await result.current.toggleSubscribe();
    });
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();

    rerender({ projected: { ...loading, isLoading: false } });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSubscribed).toBe(true);
    await act(() => result.current.toggleSubscribe());
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.subscriberCount).toBe(11);
    rerender({ projected: { ...loading, isLoading: false } });
    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.subscriberCount).toBe(11);
  });

  it('uses the current viewer subscription in the render that releases the action', () => {
    const snapshots: { isLoading: boolean; isSubscribed: boolean }[] = [];
    const { rerender } = renderHook(
      ({ projected }) => {
        const subscription = useSubscription('target', projected);
        snapshots.push({
          isLoading: subscription.isLoading,
          isSubscribed: subscription.isSubscribed,
        });
        return subscription;
      },
      {
        initialProps: {
          projected: {
            isLoading: true,
            subscriberCount: 7,
            subscriptions: [],
          } as ProjectedSubscriptionState,
        },
      }
    );
    snapshots.length = 0;
    rerender({
      projected: {
        isLoading: false,
        subscriberCount: 7,
        subscriptions: [{ id: 'mine', subscriber_id: 'viewer' }],
      },
    });
    expect(snapshots[0]).toEqual({ isLoading: false, isSubscribed: true });
    mocks.user = { id: 'other-viewer' };
    snapshots.length = 0;
    rerender({ projected: { isLoading: true, subscriberCount: 7, subscriptions: [] } });
    expect(snapshots[0]).toEqual({ isLoading: true, isSubscribed: false });
  });
});
