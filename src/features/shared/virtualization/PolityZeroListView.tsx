import { useCallback, useRef, type ReactNode, type RefObject } from 'react';

import { usePolityZeroList, usePolityZeroWindowList } from './usePolityZeroList';
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
  const list = usePolityZeroWindowList<TContext, TRow, TStart>({
    scrollStateKey: historyKey,
    listContextParams: context,
    getScrollElement: useCallback(() => null, []),
    estimateSize: useCallback(() => estimateSize, [estimateSize]),
    overscan,
    getPageQuery: getPageQuery as never,
    getSingleQuery: getSingleQuery as never,
    getRowKey,
    toStartRow,
    permalinkID: permalinkID ?? undefined,
  });
  return <PolityZeroListBody {...renderProps} list={list} windowScroll />;
}

function PolityZeroListBody<TRow>({
  renderRow,
  renderSkeleton,
  renderEmpty,
  className = 'h-[calc(100dvh-16rem)] min-h-80 overflow-auto',
  contentClassName = 'space-y-3',
  list,
  scrollRef,
  windowScroll = false,
}: Pick<
  PolityZeroListViewProps<TRow, unknown, unknown>,
  'renderRow' | 'renderSkeleton' | 'renderEmpty' | 'className' | 'contentClassName'
> & {
  list: ZeroVirtualizerResult<TRow>;
  scrollRef?: RefObject<HTMLDivElement | null>;
  windowScroll?: boolean;
}) {
  if (list.rowsEmpty) return renderEmpty();

  const content = (
    <div
      className={contentClassName}
      style={{ paddingTop: list.spaceBefore, paddingBottom: list.spaceAfter }}
    >
      {list.items.map(item => (
        <div key={item.key} {...rowAttributes(item.index, item.key)}>
          {item.row ? renderRow(item.row, item.index) : renderSkeleton(item.index)}
        </div>
      ))}
    </div>
  );

  if (windowScroll) return content;
  return (
    <div ref={scrollRef} className={className}>
      {content}
    </div>
  );
}
