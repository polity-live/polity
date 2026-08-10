import type { CSSProperties, ReactNode, RefObject } from 'react';

import { Link } from '@tanstack/react-router';
import { Rss, Search } from 'lucide-react';

import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';

export interface MasonryGridViewProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore?: () => void;
  className?: string;
  gap: 'sm' | 'md' | 'lg';
  itemMotion: 'none' | 'reveal';
  loadMoreTriggerRef: RefObject<HTMLDivElement | null>;
  skeletonIndexes: number[];
  emptyLabels: { title: string; hint: string; discoverContent: string };
}

const GAP_CLASSES = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
} as const;

export function MasonryGridView<T>({
  items,
  renderItem,
  keyExtractor,
  isLoading,
  hasMore,
  onLoadMore,
  className,
  gap,
  itemMotion,
  loadMoreTriggerRef,
  skeletonIndexes,
  emptyLabels,
}: MasonryGridViewProps<T>) {
  const gapClass = GAP_CLASSES[gap];
  const skeletons = skeletonIndexes.map((index: any) => (
    <MasonryGridSkeleton key={`skeleton-${index}`} index={index} />
  ));

  if (isLoading && items.length === 0) {
    return (
      <div className={cn('columns-1 sm:columns-2 lg:columns-3 xl:columns-4', gapClass, className)}>
        {skeletons}
      </div>
    );
  }

  if (items.length === 0) {
    return <MasonryGridEmptyView labels={emptyLabels} />;
  }

  return (
    <div className="space-y-6">
      <div className={cn('columns-1 sm:columns-2 lg:columns-3 xl:columns-4', gapClass, className)}>
        {items.map((item: any, index: number) => (
          <div
            key={keyExtractor(item, index)}
            className={cn(
              'mb-4 break-inside-avoid',
              itemMotion === 'reveal' && 'civic-load-card-reveal'
            )}
            style={
              itemMotion === 'reveal'
                ? ({ '--civic-load-index': Math.min(index, 11) } as CSSProperties)
                : undefined
            }
          >
            {renderItem(item, index)}
          </div>
        ))}

        {isLoading && items.length > 0 && skeletons}
      </div>

      {hasMore && onLoadMore && <div ref={loadMoreTriggerRef} className="h-px" />}
    </div>
  );
}

function MasonryGridSkeleton({ index }: { index: number }) {
  const heights = ['h-48', 'h-64', 'h-56', 'h-72', 'h-52', 'h-60'];
  const heightClass = heights[index % heights.length];

  return (
    <div className="mb-4 break-inside-avoid">
      <div className={cn('animate-pulse overflow-hidden rounded-2xl', heightClass)}>
        <div className="bg-muted h-1/3" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MasonryGridEmptyView({
  labels,
}: {
  labels: { title: string; hint: string; discoverContent: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
      <div className="bg-muted rounded-xl p-4">
        <Rss className="text-muted-foreground h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{labels.title}</h3>
        <p className="text-muted-foreground max-w-md text-sm">{labels.hint}</p>
      </div>
      <Button data-action-scope="presentation" variant="outline" asChild>
        <Link
          data-action-id="timeline.empty.search.open"
          data-action-kind="navigation"
          to="/search"
          className="flex items-center gap-2"
        >
          <Search className="h-4 w-4" />
          {labels.discoverContent}
        </Link>
      </Button>
    </div>
  );
}
