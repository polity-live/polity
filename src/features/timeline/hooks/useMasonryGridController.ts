import { useEffect, useMemo, useRef } from 'react';

export function useMasonryGridController(args: {
  hasMore: boolean;
  onLoadMore?: () => void;
  isLoading: boolean;
  loadingSkeletonCount: number;
}) {
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!args.hasMore || !args.onLoadMore || args.isLoading) return;

    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          args.onLoadMore?.();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const currentTrigger = loadMoreTriggerRef.current;
    if (currentTrigger) {
      observer.observe(currentTrigger);
    }

    return () => {
      if (currentTrigger) {
        observer.unobserve(currentTrigger);
      }
    };
  }, [args.hasMore, args.onLoadMore, args.isLoading]);

  const skeletonIndexes = useMemo(
    () => Array.from({ length: args.loadingSkeletonCount }, (_, index) => index),
    [args.loadingSkeletonCount]
  );

  return {
    loadMoreTriggerRef,
    skeletonIndexes,
  };
}
