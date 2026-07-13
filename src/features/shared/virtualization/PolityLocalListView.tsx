import { useRef, type ReactNode } from 'react';

import { usePolityLocalVirtualizer } from './usePolityLocalVirtualizer';

export interface PolityLocalListViewProps<T> {
  items: readonly T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize: number;
  gap?: number;
  overscan?: number;
  className?: string;
}

/** Windowed list fallback for already-derived collections. */
export function PolityLocalListView<T>({
  items,
  getItemKey,
  renderItem,
  estimateSize,
  gap = 8,
  overscan = 6,
  className = 'h-[36rem] min-h-64 overflow-auto',
}: PolityLocalListViewProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = usePolityLocalVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    getItemKey: index => (items[index] ? getItemKey(items[index]) : index),
    estimateSize: () => estimateSize + gap,
    overscan,
    initialRect: { width: 640, height: 576 },
  });
  const measuredItems = virtualizer.getVirtualItems();
  const virtualItems =
    measuredItems.length > 0
      ? measuredItems
      : items.slice(0, 12).map((item, index) => ({
          key: getItemKey(item),
          index,
          start: index * (estimateSize + gap),
        }));
  const totalSize = Math.max(virtualizer.getTotalSize(), items.length * (estimateSize + gap));

  return (
    <div ref={parentRef} className={className}>
      <div className="relative w-full" style={{ height: totalSize }}>
        {virtualItems.map(virtualItem => {
          const item = items[virtualItem.index];
          if (!item) return null;
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ paddingBottom: gap, transform: `translateY(${virtualItem.start}px)` }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
