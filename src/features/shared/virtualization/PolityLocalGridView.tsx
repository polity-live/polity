import { useCollectionPresentation } from '@/features/shared/ui/collections/CollectionScope';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { usePolityLocalVirtualizer } from './usePolityLocalVirtualizer';

export interface PolityLocalGridViewProps<T> {
  items: readonly T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  getLanes: (width: number) => number;
  estimateRowSize: number;
  gap?: number;
  overscan?: number;
  className?: string;
}

/** Windowed grid for already-derived collections that cannot use one Zero query. */
export function PolityLocalGridView<T>({
  items,
  getItemKey,
  renderItem,
  getLanes,
  estimateRowSize,
  gap = 16,
  overscan = 4,
  className = 'h-[36rem] min-h-80 overflow-auto',
}: PolityLocalGridViewProps<T>) {
  const compact = useCollectionPresentation()?.view === 'compact';
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    // React attaches the rendered div ref before running this mount effect.
    const element = parentRef.current as HTMLDivElement;
    if (typeof ResizeObserver === 'undefined') {
      setWidth(element.clientWidth || 1024);
      return;
    }
    const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const lanes = compact ? 1 : getLanes(width);
  const rowCount = Math.ceil(items.length / lanes);
  const virtualizer = usePolityLocalVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (compact ? 76 : estimateRowSize) + gap,
    overscan,
    initialRect: { width: width || 1024, height: 576 },
  });
  const anchor = useRef<number | null>(null);
  const layoutInitialized = useRef(false);
  useLayoutEffect(() => {
    const scrollElement = parentRef.current as HTMLDivElement;
    if (layoutInitialized.current) virtualizer.measure();
    layoutInitialized.current = true;
    if (anchor.current !== null)
      virtualizer.scrollToIndex(Math.floor(anchor.current / lanes), { align: 'start' });
    return () => {
      const offset = scrollElement.scrollTop;
      const visible = virtualizer.getVirtualItems().find(item => item.end > offset);
      anchor.current = visible ? visible.index * lanes : null;
    };
  }, [compact, lanes]);
  const measuredRows = virtualizer.getVirtualItems();
  const virtualRows =
    measuredRows.length > 0
      ? measuredRows
      : Array.from({ length: Math.min(rowCount, 12) }, (_, index) => ({
          key: index,
          index,
          start: index * ((compact ? 76 : estimateRowSize) + gap),
        }));
  const totalSize = Math.max(
    virtualizer.getTotalSize(),
    rowCount * ((compact ? 76 : estimateRowSize) + gap)
  );

  return (
    <div ref={parentRef} className={className}>
      <div className="relative w-full" style={{ height: totalSize }}>
        {virtualRows.map(virtualRow => {
          const startIndex = virtualRow.index * lanes;
          const rowItems = items.slice(startIndex, startIndex + lanes);
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 grid w-full"
              style={{
                gap,
                gridTemplateColumns: `repeat(${lanes}, minmax(0, 1fr))`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowItems.map((item, laneIndex) => (
                <div key={getItemKey(item)}>{renderItem(item, startIndex + laneIndex)}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
