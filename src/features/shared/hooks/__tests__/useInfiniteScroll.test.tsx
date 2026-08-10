/* @vitest-environment jsdom */

import { render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInfiniteScroll } from '../useInfiniteScroll';

const observers: ObserverDouble[] = [];

class ObserverDouble {
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();

  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit
  ) {
    observers.push(this);
  }
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', ObserverDouble);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useInfiniteScroll', () => {
  it('observes the trigger, reacts only to intersections, and keeps the latest callback', () => {
    const firstLoad = vi.fn();
    const secondLoad = vi.fn();
    const view = render(<Probe hasMore isLoading={false} onLoadMore={firstLoad} />);
    const observer = observers[0];

    expect(observer.options).toEqual({ threshold: 0.1, rootMargin: '200px' });
    expect(observer.observe).toHaveBeenCalledOnce();

    observer.callback([{ isIntersecting: false } as IntersectionObserverEntry], observer as never);
    expect(firstLoad).not.toHaveBeenCalled();

    view.rerender(<Probe hasMore isLoading={false} onLoadMore={secondLoad} />);
    observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as never);
    expect(secondLoad).toHaveBeenCalledOnce();

    view.unmount();
    expect(observer.unobserve).toHaveBeenCalledOnce();
  });

  it('does not create an observer without more items or while loading', () => {
    const onLoadMore = vi.fn();
    const noMore = render(<Probe hasMore={false} isLoading={false} onLoadMore={onLoadMore} />);
    expect(observers).toHaveLength(0);
    noMore.unmount();

    const loading = render(<Probe hasMore isLoading onLoadMore={onLoadMore} />);
    expect(observers).toHaveLength(0);
    loading.unmount();
  });

  it('supports custom observer options and a temporarily missing trigger', () => {
    const { unmount } = renderHook(() =>
      useInfiniteScroll({
        hasMore: true,
        isLoading: false,
        onLoadMore: vi.fn(),
        rootMargin: '40px',
        threshold: 0.75,
      })
    );

    expect(observers[0].options).toEqual({ threshold: 0.75, rootMargin: '40px' });
    expect(observers[0].observe).not.toHaveBeenCalled();
    unmount();
    expect(observers[0].unobserve).not.toHaveBeenCalled();
  });
});

function Probe({
  hasMore,
  isLoading,
  onLoadMore,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  const triggerRef = useInfiniteScroll({ hasMore, isLoading, onLoadMore });
  return <div ref={triggerRef} />;
}
