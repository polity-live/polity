import { useCollectionPresentation } from '@/features/shared/ui/collections/CollectionScope';
import { useHistoryScrollState } from '@rocicorp/zero-virtual/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { usePolityZeroGrid } from './usePolityZeroGrid';

interface PageOptions<TStart> {
  limit: number;
  start: TStart | null;
  dir: 'forward' | 'backward';
  settled: boolean;
}

export interface PolityZeroGridViewProps<TRow, TStart, TContext> {
  context: TContext;
  layoutKey?: string;
  historyKey: string;
  estimateSize: number;
  gap?: number;
  overscan?: number;
  getLanes: (width: number) => number;
  getRowKey: (row: TRow) => string;
  toStartRow: (row: TRow) => TStart;
  getPageQuery: (options: PageOptions<TStart>) => unknown;
  getSingleQuery: (options: { id: string; settled: boolean }) => unknown;
  renderRow: (row: TRow, index: number) => ReactNode;
  renderSkeleton: (index: number) => ReactNode;
  renderEmpty: () => ReactNode;
  permalinkID?: string | null;
  viewportClassName?: string;
}

/** Responsive, measured, cursor-paged grid using the shared Polity runtime. */
export function PolityZeroGridView<TRow, TStart, TContext>({
  context,
  layoutKey,
  historyKey,
  estimateSize,
  gap = 16,
  overscan = 8,
  getLanes,
  getRowKey,
  toStartRow,
  getPageQuery,
  getSingleQuery,
  renderRow,
  renderSkeleton,
  renderEmpty,
  permalinkID,
  viewportClassName = 'h-[calc(100dvh-16rem)] min-h-80 overflow-auto',
}: PolityZeroGridViewProps<TRow, TStart, TContext>) {
  const collection = useCollectionPresentation();
  const compact = (layoutKey ?? collection?.view) === 'compact';
  const layout = compact ? 'compact' : 'cards';
  const anchor = useRef<number | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollState, onScrollStateChange] = useHistoryScrollState<TStart>(
    layoutKey || collection ? `${historyKey}:${layout}` : historyKey
  );

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const lanes = compact ? 1 : getLanes(width);
  const columnWidth = Math.max(0, (width - gap * (lanes - 1)) / lanes);
  const result = usePolityZeroGrid<TRow>({
    listContextParams: context,
    getScrollElement: useCallback(() => parentRef.current, []),
    estimateSize: useCallback(
      () => (compact ? 76 : estimateSize) + gap,
      [compact, estimateSize, gap]
    ),
    overscan,
    lanes,
    getPageQuery,
    getSingleQuery,
    getRowKey,
    toStartRow,
    permalinkID,
    scrollState,
    onScrollStateChange,
    settleTime: 750,
  });

  const layoutInitialized = useRef(false);
  useLayoutEffect(() => {
    if (layoutInitialized.current) result.virtualizer.measure();
    layoutInitialized.current = true;
    if (anchor.current !== null)
      result.virtualizer.scrollToIndex(anchor.current, { align: 'start' });
    return () => {
      const offset = parentRef.current?.scrollTop ?? 0;
      anchor.current =
        result.virtualizer.getVirtualItems().find(item => item.end > offset)?.index ?? null;
    };
  }, [layout, lanes]);

  if (result.rowsEmpty) return renderEmpty();

  return (
    <div ref={parentRef} className={viewportClassName}>
      <div className="relative w-full" style={{ height: result.virtualizer.getTotalSize() }}>
        {result.virtualizer.getVirtualItems().map(item => {
          const row = result.rowAt(item.index);
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={result.virtualizer.measureElement}
              className="absolute top-0 left-0 pb-4"
              style={{
                width: columnWidth,
                transform: `translate(${(item.lane ?? 0) * (columnWidth + gap)}px, ${item.start}px)`,
              }}
            >
              {row ? (
                renderRow(row, item.index)
              ) : compact ? (
                <div className="bg-muted h-16 w-full animate-pulse rounded" />
              ) : (
                renderSkeleton(item.index)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
