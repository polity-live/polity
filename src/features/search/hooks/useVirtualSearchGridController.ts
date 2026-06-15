import { useHistoryScrollState, useZeroVirtualizer } from '@rocicorp/zero-virtual/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { queries } from '@/zero/queries';

import type {
  SearchDocument,
  SearchListContext,
  SearchStart,
} from '../types/search-document.types';
import {
  SEARCH_CARD_HEIGHT,
  SEARCH_GRID_GAP,
  type VirtualSearchGridCell,
} from '../ui/VirtualSearchGridView';

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

interface UseVirtualSearchGridControllerOptions {
  context: SearchListContext;
  permalinkID?: string | null;
  onTotalChange?: (total: number) => void;
}

export function useVirtualSearchGridController({
  context,
  permalinkID,
  onTotalChange,
}: UseVirtualSearchGridControllerOptions) {
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
      bounds: context.bounds ?? null,
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

  const cells = useMemo<VirtualSearchGridCell[]>(
    () =>
      virtualItems.map(virtualItem => ({
        key: virtualItem.key,
        index: virtualItem.index,
        top: virtualItem.start,
        left: (virtualItem.lane ?? 0) * (columnWidth + SEARCH_GRID_GAP),
        width: columnWidth,
        document: rowAt(virtualItem.index),
      })),
    [columnWidth, rowAt, virtualItems]
  );

  return {
    parentRef,
    cells,
    totalHeight: virtualizer.getTotalSize(),
    showNewResults: hasNewResults,
    rowsEmpty,
    isComplete: complete,
    newResultsLabel: translateText('generated.inline.1109_neue_ergebnisse_6eeff1f6'),
    emptyLabel: translateText('generated.inline.1110_keine_ergebnisse_2c33e7bb'),
    onJumpToTop: jumpToTop,
    onScroll: handleScroll,
    onMeasureElement: virtualizer.measureElement,
  };
}

export type VirtualSearchGridController = ReturnType<typeof useVirtualSearchGridController>;
