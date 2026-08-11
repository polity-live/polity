/* @vitest-environment jsdom */

import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const observerMocks = vi.hoisted(() => ({
  callback: undefined as ((entries: any[]) => void) | undefined,
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
  options: undefined as unknown,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useMasonryGridController } from '../useMasonryGridController';
import { useMasonryGridEmptyController } from '../useMasonryGridEmptyController';
import { useReactions } from '../useReactions';
import { useReasonTooltipController } from '../useReasonTooltipController';

beforeEach(() => {
  observerMocks.callback = undefined;
  observerMocks.observe.mockReset();
  observerMocks.unobserve.mockReset();
  observerMocks.disconnect.mockReset();
  class IntersectionObserverMock {
    constructor(callback: (entries: any[]) => void, options: unknown) {
      observerMocks.callback = callback;
      observerMocks.options = options;
    }

    observe = observerMocks.observe;
    unobserve = observerMocks.unobserve;
    disconnect = observerMocks.disconnect;
  }
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
});

afterEach(cleanup);

describe('useReasonTooltipController', () => {
  it('builds plain, prefixed, and colon context reasons and toggles open state', () => {
    let hook = renderHook(() => useReasonTooltipController({ category: 'trending' }));
    expect(hook.result.current.reasonText).toBeTruthy();
    expect(hook.result.current.whySeeingLabel).toBe('features.timeline.explore.whySeeing');
    act(() => hook.result.current.onTriggerClick());
    expect(hook.result.current.open).toBe(true);
    act(() => hook.result.current.onOpenChange(false));
    expect(hook.result.current.open).toBe(false);
    hook.unmount();

    hook = renderHook(() =>
      useReasonTooltipController({ category: 'popular_topic', context: 'Council' })
    );
    expect(hook.result.current.reasonText).toContain('Council');
    hook.unmount();

    hook = renderHook(() =>
      useReasonTooltipController({ category: 'similar_groups', context: 'Budget' })
    );
    expect(hook.result.current.reasonText).toContain(': Budget');
  });
});

describe('useReactions', () => {
  it('keeps anonymous toggles and removals inert', async () => {
    const { result } = renderHook(() =>
      useReactions({ entityId: 'item-1', entityType: 'statement' })
    );
    await act(async () => result.current.toggleReaction('support'));
    await act(async () => result.current.removeReaction());
    expect(result.current).toMatchObject({
      userReaction: null,
      counts: { support: 0, oppose: 0, interested: 0, total: 0 },
      isLoading: false,
      hasReacted: false,
    });
  });

  it('adds, switches, toggles off, and explicitly removes reactions', async () => {
    const { result } = renderHook(() =>
      useReactions({ entityId: 'item-1', entityType: 'statement', userId: 'user-1' })
    );
    await act(async () => result.current.toggleReaction('support'));
    expect(result.current).toMatchObject({
      userReaction: 'support',
      counts: { support: 1, total: 1 },
      hasReacted: true,
    });

    await act(async () => result.current.toggleReaction('oppose'));
    expect(result.current).toMatchObject({
      userReaction: 'oppose',
      counts: { support: 0, oppose: 1, total: 1 },
    });

    await act(async () => result.current.toggleReaction('oppose'));
    expect(result.current).toMatchObject({
      userReaction: null,
      counts: { oppose: 0, total: 0 },
    });

    await act(async () => result.current.toggleReaction('interested'));
    await act(async () => result.current.removeReaction());
    expect(result.current).toMatchObject({
      userReaction: null,
      counts: { interested: 0, total: 0 },
      isLoading: false,
    });
  });
});

describe('masonry controllers', () => {
  it('provides translated empty labels', () => {
    const { result } = renderHook(() => useMasonryGridEmptyController());
    expect(result.current.labels).toEqual({
      title: 'features.timeline.empty.title',
      hint: 'features.timeline.emptyTimelineHint',
      discoverContent: 'features.timeline.discoverContent',
    });
  });

  it('does not observe while loading, exhausted, or missing a callback', () => {
    let hook = renderHook(() =>
      useMasonryGridController({
        hasMore: false,
        onLoadMore: vi.fn(),
        isLoading: false,
        loadingSkeletonCount: 0,
      })
    );
    expect(observerMocks.observe).not.toHaveBeenCalled();
    hook.unmount();
    hook = renderHook(() =>
      useMasonryGridController({ hasMore: true, isLoading: false, loadingSkeletonCount: 0 })
    );
    hook.unmount();
    renderHook(() =>
      useMasonryGridController({
        hasMore: true,
        onLoadMore: vi.fn(),
        isLoading: true,
        loadingSkeletonCount: 0,
      })
    );
    expect(observerMocks.observe).not.toHaveBeenCalled();
  });

  it('observes the trigger, dispatches only intersecting entries, and unobserves on cleanup', () => {
    const onLoadMore = vi.fn();
    function Fixture() {
      const controller = useMasonryGridController({
        hasMore: true,
        onLoadMore,
        isLoading: false,
        loadingSkeletonCount: 3,
      });
      return <div ref={controller.loadMoreTriggerRef}>{controller.skeletonIndexes.join(',')}</div>;
    }
    const view = render(<Fixture />);
    expect(view.container.textContent).toBe('0,1,2');
    expect(observerMocks.observe).toHaveBeenCalledOnce();
    expect(observerMocks.options).toEqual({ threshold: 0.1, rootMargin: '200px' });
    act(() => observerMocks.callback?.([{ isIntersecting: false }]));
    expect(onLoadMore).not.toHaveBeenCalled();
    act(() => observerMocks.callback?.([{ isIntersecting: true }]));
    expect(onLoadMore).toHaveBeenCalledOnce();
    const trigger = observerMocks.observe.mock.calls[0]?.[0];
    view.unmount();
    expect(observerMocks.unobserve).toHaveBeenCalledWith(trigger);
  });

  it('supports an active observer before a trigger ref is attached', () => {
    const hook = renderHook(() =>
      useMasonryGridController({
        hasMore: true,
        onLoadMore: vi.fn(),
        isLoading: false,
        loadingSkeletonCount: 1,
      })
    );
    expect(observerMocks.observe).not.toHaveBeenCalled();
    hook.unmount();
    expect(observerMocks.unobserve).not.toHaveBeenCalled();
  });
});
