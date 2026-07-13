import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    if (typeof ResizeObserver === 'undefined') {
      setWidth(element.clientWidth || 1024);
      return;
    }
    const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const lanes = getLanes(width);
  const rowCount = Math.ceil(items.length / lanes);
  const virtualizer = usePolityLocalVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowSize + gap,
    overscan,
    initialRect: { width: width || 1024, height: 576 },
  });
  const measuredRows = virtualizer.getVirtualItems();
  const virtualRows =
    measuredRows.length > 0
      ? measuredRows
      : Array.from({ length: Math.min(rowCount, 12) }, (_, index) => ({
          key: index,
          index,
          start: index * (estimateRowSize + gap),
        }));
  const totalSize = Math.max(virtualizer.getTotalSize(), rowCount * (estimateRowSize + gap));

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
