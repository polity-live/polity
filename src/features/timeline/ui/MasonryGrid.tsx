'use client';

import type { ReactNode } from 'react';

import { useMasonryGridController } from '@/features/timeline/hooks/useMasonryGridController';
import { useMasonryGridEmptyController } from '@/features/timeline/hooks/useMasonryGridEmptyController';

import { MasonryGridEmptyView, MasonryGridView } from './MasonryGridView';

export interface MasonryGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingSkeletonCount?: number;
  className?: string;
  gap?: 'sm' | 'md' | 'lg';
  itemMotion?: 'none' | 'reveal';
}

export function MasonryGrid<T>({
  items,
  renderItem,
  keyExtractor,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  loadingSkeletonCount = 6,
  className,
  gap = 'md',
  itemMotion = 'none',
}: MasonryGridProps<T>) {
  const controller = useMasonryGridController({
    hasMore,
    onLoadMore,
    isLoading,
    loadingSkeletonCount,
  });
  const emptyController = useMasonryGridEmptyController();

  return (
    <MasonryGridView
      items={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      isLoading={isLoading}
      hasMore={hasMore}
      onLoadMore={onLoadMore}
      className={className}
      gap={gap}
      itemMotion={itemMotion}
      emptyLabels={emptyController.labels}
      {...controller}
    />
  );
}

export function MasonryGridEmpty() {
  const controller = useMasonryGridEmptyController();

  return <MasonryGridEmptyView {...controller} />;
}
