import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';

import { usePolityZeroList, usePolityZeroWindowList } from './usePolityZeroList';
import { ZeroVirtualSpacer } from './ZeroVirtualSpacer';
import { rowAttributes, type ZeroVirtualizerResult } from '@rocicorp/zero-virtual/react';

interface PageOptions<TStart> {
  limit: number;
  start: TStart | null;
  dir: 'forward' | 'backward';
  settled: boolean;
}

export interface PolityZeroListViewProps<TRow, TStart, TContext> {
  context: TContext;
  historyKey: string;
  estimateSize: number;
  getRowKey: (row: TRow) => string;
  toStartRow: (row: TRow) => TStart;
  getPageQuery: (options: PageOptions<TStart>) => unknown;
  getSingleQuery: (options: { id: string; settled: boolean }) => unknown;
  renderRow: (row: TRow, index: number) => ReactNode;
  renderSkeleton: (index: number) => ReactNode;
  renderEmpty: () => ReactNode;
  onTotalChange?: (total: number) => void;
  permalinkID?: string | null;
  overscan?: number;
  windowScroll?: boolean;
  className?: string;
  contentClassName?: string;
}

/** Cursor-paged vertical list with stable history restoration and row attributes. */
export function PolityZeroListView<TRow, TStart, TContext>({
  windowScroll = false,
  ...props
}: PolityZeroListViewProps<TRow, TStart, TContext>) {
  return windowScroll ? (
    <PolityZeroWindowListContent {...props} windowScroll />
  ) : (
    <PolityZeroContainedListContent {...props} />
  );
}

function PolityZeroContainedListContent<TRow, TStart, TContext>({
  context,
  historyKey,
  estimateSize,
  getRowKey,
  toStartRow,
  getPageQuery,
  getSingleQuery,
  permalinkID,
  overscan = 8,
  ...renderProps
}: PolityZeroListViewProps<TRow, TStart, TContext>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const list = usePolityZeroList<TContext, TRow, TStart>({
    scrollStateKey: historyKey,
    listContextParams: context,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: useCallback(() => estimateSize, [estimateSize]),
    overscan,
    getPageQuery: getPageQuery as never,
    getSingleQuery: getSingleQuery as never,
    getRowKey,
    toStartRow,
    permalinkID: permalinkID ?? undefined,
  });
  return <PolityZeroListBody {...renderProps} list={list} scrollRef={scrollRef} />;
}

function PolityZeroWindowListContent<TRow, TStart, TContext>({
  context,
  historyKey,
  estimateSize,
  getRowKey,
  toStartRow,
  getPageQuery,
  getSingleQuery,
  permalinkID,
  overscan = 8,
  ...renderProps
}: PolityZeroListViewProps<TRow, TStart, TContext>) {
  const contentRef = useRef<HTMLDivElement>(null);
  const list = usePolityZeroWindowList<TContext, TRow, TStart>({
    scrollStateKey: historyKey,
    listContextParams: context,
    getScrollElement: useCallback(() => contentRef.current, []),
    estimateSize: useCallback(() => estimateSize, [estimateSize]),
    overscan,
    getPageQuery: getPageQuery as never,
    getSingleQuery: getSingleQuery as never,
    getRowKey,
    toStartRow,
    permalinkID: permalinkID ?? undefined,
  });
  return <PolityZeroListBody {...renderProps} list={list} scrollRef={contentRef} windowScroll />;
}

function PolityZeroListBody<TRow>({
  renderRow,
  renderSkeleton,
  renderEmpty,
  onTotalChange,
  className = 'h-[calc(100dvh-16rem)] min-h-80 overflow-auto',
  contentClassName = 'space-y-3',
  list,
  scrollRef,
  windowScroll = false,
}: Pick<
  PolityZeroListViewProps<TRow, unknown, unknown>,
  | 'renderRow'
  | 'renderSkeleton'
  | 'renderEmpty'
  | 'onTotalChange'
  | 'className'
  | 'contentClassName'
> & {
  list: ZeroVirtualizerResult<TRow>;
  scrollRef?: RefObject<HTMLDivElement | null>;
  windowScroll?: boolean;
}) {
  useEffect(() => {
    if (list.total !== undefined) onTotalChange?.(list.total);
  }, [list.total, onTotalChange]);

  if (list.rowsEmpty) {
    const emptyContent = renderEmpty();
    return windowScroll ? (
      <div ref={scrollRef}>{emptyContent}</div>
    ) : (
      <div ref={scrollRef} className={className}>
        {emptyContent}
      </div>
    );
  }

  const content = (
    <div ref={windowScroll ? scrollRef : undefined} className={contentClassName}>
      <ZeroVirtualSpacer position="before" size={list.spaceBefore} />
      {list.items.map((item, itemPosition) => (
        <div
          key={item.key}
          {...rowAttributes(item.index, item.key)}
          style={itemPosition === 0 ? { marginTop: 0 } : undefined}
        >
          {item.row ? renderRow(item.row, item.index) : renderSkeleton(item.index)}
        </div>
      ))}
      <ZeroVirtualSpacer position="after" size={list.spaceAfter} />
    </div>
  );

  if (windowScroll) return content;
  return (
    <div ref={scrollRef} className={className}>
      {content}
    </div>
  );
}
