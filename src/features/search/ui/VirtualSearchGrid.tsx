import { useZeroVirtualizer, useHistoryScrollState } from '@rocicorp/zero-virtual/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Card } from '@/features/shared/ui/ui/card';
import { queries } from '@/zero/queries';
import type {
  SearchDocument,
  SearchListContext,
  SearchStart,
} from '../types/search-document.types';
import { SearchResultCard } from './SearchResultCard';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export const SEARCH_CARD_HEIGHT = 360;
export const SEARCH_GRID_GAP = 16;

function getLanes(width: number) {
  if (width >= 1440) return 4;
  if (width >= 1040) return 3;
  if (width >= 700) return 2;
  return 1;
}

function toStartRow(document: SearchDocument): SearchStart {
  return {
    id: document.id,
    created_at: document.created_at,
    engagement_score: document.engagement_score,
    trending_score: document.trending_score,
  };
}

function getRowKey(document: SearchDocument) {
  return document.id;
}

function SearchCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden rounded-xl border-gray-100 shadow-sm dark:border-gray-800">
      <div className="bg-muted/80 h-24 animate-pulse p-4">
        <div className="bg-background/70 h-5 w-2/3 rounded" />
        <div className="bg-background/60 mt-2 h-3 w-1/2 rounded" />
      </div>
      <div className="space-y-3 p-4">
        <div className="bg-muted h-4 animate-pulse rounded" />
        <div className="bg-muted h-4 w-5/6 animate-pulse rounded" />
        <div className="flex gap-2 pt-1">
          <div className="bg-muted h-5 w-16 animate-pulse rounded" />
          <div className="bg-muted h-5 w-20 animate-pulse rounded" />
        </div>
        <div className="mt-8 flex gap-2">
          <div className="bg-muted h-8 w-20 animate-pulse rounded-md" />
          <div className="bg-muted h-8 w-8 animate-pulse rounded-md" />
        </div>
      </div>
    </Card>
  );
}

interface VirtualSearchGridProps {
  context: SearchListContext;
  permalinkID?: string | null;
  onTotalChange?: (total: number) => void;
}

export function VirtualSearchGrid({ context, permalinkID, onTotalChange }: VirtualSearchGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [isAwayFromTop, setIsAwayFromTop] = useState(false);
  const [hasNewResults, setHasNewResults] = useState(false);
  const previousHeadKeyRef = useRef<string | null>(null);
  const [scrollState, setScrollState] = useHistoryScrollState<SearchStart>('search-grid');

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      setWidth(entry.contentRect.width);
    });

    resizeObserver.observe(element);
    setWidth(element.clientWidth);

    return () => resizeObserver.disconnect();
  }, []);

  const lanes = getLanes(width);
  const columnWidth = Math.max(0, (width - SEARCH_GRID_GAP * (lanes - 1)) / lanes);

  const listContextParams = useMemo(
    () => ({
      query: context.query,
      types: [...context.types].sort(),
      topics: [...context.topics].sort(),
      createdAfter: context.createdAfter,
      engagement: context.engagement,
      sort: context.sort,
      snapshotAt: context.snapshotAt,
    }),
    [context]
  );

  const getPageQuery = useCallback(
    ({
      limit,
      start,
      dir,
      settled,
    }: {
      limit: number;
      start: SearchStart | null;
      dir: 'forward' | 'backward';
      settled: boolean;
    }) => {
      const ttl = settled ? ('5m' as const) : ('none' as const);

      return {
        query: queries.search.searchDocumentPage({
          ...context,
          limit,
          start,
          dir,
        }) as any,
        options: { ttl },
      };
    },
    [context]
  );

  const getSingleQuery = useCallback(({ id, settled }: { id: string; settled: boolean }) => {
    const ttl = settled ? ('5m' as const) : ('none' as const);

    return {
      query: queries.search.searchDocumentById({ id }) as any,
      options: { ttl },
    };
  }, []);

  const { virtualizer, rowAt, complete, rowsEmpty, estimatedTotal, total } = useZeroVirtualizer<
    HTMLDivElement,
    HTMLDivElement,
    SearchListContext,
    SearchDocument,
    SearchStart
  >({
    listContextParams,
    getScrollElement: useCallback(() => parentRef.current, []),
    estimateSize: useCallback(() => SEARCH_CARD_HEIGHT + SEARCH_GRID_GAP, []),
    overscan: 12,
    lanes,
    getPageQuery,
    getSingleQuery,
    getRowKey,
    toStartRow,
    permalinkID,
    scrollState,
    onScrollStateChange: setScrollState,
    settleTime: 750,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const headKey = rowAt(0)?.id ?? null;

  useEffect(() => {
    onTotalChange?.(total ?? estimatedTotal);
  }, [estimatedTotal, onTotalChange, total]);

  useEffect(() => {
    if (!headKey) return;

    if (previousHeadKeyRef.current && previousHeadKeyRef.current !== headKey && isAwayFromTop) {
      setHasNewResults(true);
    }

    previousHeadKeyRef.current = headKey;
  }, [headKey, isAwayFromTop]);

  const handleScroll = useCallback(() => {
    const nextIsAwayFromTop = (parentRef.current?.scrollTop ?? 0) > SEARCH_CARD_HEIGHT;
    setIsAwayFromTop(nextIsAwayFromTop);
    if (!nextIsAwayFromTop) {
      setHasNewResults(false);
    }
  }, []);

  const jumpToTop = useCallback(() => {
    virtualizer.scrollToIndex(0, { align: 'start' });
    setHasNewResults(false);
  }, [virtualizer]);

  return (
    <div className="relative">
      {hasNewResults && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
          <Button className="pointer-events-auto shadow-md" size="sm" onClick={jumpToTop}>
            {translateText('generated.inline.1109_neue_ergebnisse_6eeff1f6')}
          </Button>
        </div>
      )}

      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="h-[calc(100dvh-15rem)] min-h-[520px] overflow-auto pr-1"
      >
        {rowsEmpty && complete ? (
          <div className="text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed text-sm">
            {translateText('generated.inline.1110_keine_ergebnisse_2c33e7bb')}
          </div>
        ) : (
          <div
            className="relative"
            style={{
              height: virtualizer.getTotalSize(),
            }}
          >
            {virtualItems.map(virtualItem => {
              const document = rowAt(virtualItem.index);
              const left = (virtualItem.lane ?? 0) * (columnWidth + SEARCH_GRID_GAP);

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className="absolute"
                  style={{
                    height: SEARCH_CARD_HEIGHT,
                    width: columnWidth,
                    transform: `translate(${left}px, ${virtualItem.start}px)`,
                  }}
                >
                  {document ? <SearchResultCard document={document} /> : <SearchCardSkeleton />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
