import { useHistoryScrollState } from '@rocicorp/zero-virtual/react';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { usePolityZeroGrid } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { useSearchCardState } from '../SearchCardStateProvider';

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
import { useStableSearchListContext } from './useStableSearchListContext';
import { useProgressiveSearchCards } from './useProgressiveSearchCards';

export function getSearchGridLanes(width: number) {
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
  onTotalChange?: (total: number | null) => void;
}

export function useVirtualSearchGridController({
  context,
  permalinkID,
  onTotalChange,
}: UseVirtualSearchGridControllerOptions) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hasNewResults, setHasNewResults] = useState(false);
  const isAwayFromTopRef = useRef(false);
  const previousHeadKeyRef = useRef<string | null>(null);
  const [scrollState, setScrollState] = useHistoryScrollState<SearchStart>('search-grid');

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      startTransition(() => setWidth(entry.contentRect.width));
    });

    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const element = parentRef.current;
    const scrollWindow = element?.ownerDocument.defaultView;
    if (!element || !scrollWindow) return;

    let animationFrame: number | null = null;
    const updateScrollPosition = () => {
      animationFrame = null;
      const nextIsAwayFromTop = element.scrollTop > SEARCH_CARD_HEIGHT;
      if (isAwayFromTopRef.current === nextIsAwayFromTop) return;

      isAwayFromTopRef.current = nextIsAwayFromTop;
      if (!nextIsAwayFromTop) {
        setHasNewResults(false);
      }
    };
    const handleScroll = () => {
      if (animationFrame !== null) return;
      animationFrame = scrollWindow.requestAnimationFrame(updateScrollPosition);
    };

    updateScrollPosition();
    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (animationFrame !== null) {
        scrollWindow.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  const lanes = getSearchGridLanes(width);
  const columnWidth = Math.max(0, (width - SEARCH_GRID_GAP * (lanes - 1)) / lanes);

  const listContextParams = useStableSearchListContext(context);

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
          ...listContextParams,
          limit,
          start,
          dir,
        }) as any,
        options: { ttl },
      };
    },
    [listContextParams]
  );

  const getSingleQuery = useCallback(({ id, settled }: { id: string; settled: boolean }) => {
    const ttl = settled ? ('5m' as const) : ('none' as const);

    return {
      query: queries.search.searchDocumentById({ id }) as any,
      options: { ttl },
    };
  }, []);

  const { virtualizer, rowAt, complete, rowsEmpty, total } = usePolityZeroGrid<SearchDocument>({
    listContextParams,
    getScrollElement: useCallback(() => parentRef.current, []),
    estimateSize: useCallback(() => SEARCH_CARD_HEIGHT + SEARCH_GRID_GAP, []),
    overscan: 2,
    minPageSize: 18,
    maxPageSize: 48,
    useFlushSync: false,
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
    onTotalChange?.(total ?? null);
  }, [listContextParams, onTotalChange, total]);

  useEffect(() => {
    if (!headKey) return;

    if (
      previousHeadKeyRef.current &&
      previousHeadKeyRef.current !== headKey &&
      isAwayFromTopRef.current
    ) {
      setHasNewResults(true);
    }

    previousHeadKeyRef.current = headKey;
  }, [headKey]);

  const jumpToTop = useCallback(() => {
    isAwayFromTopRef.current = false;
    virtualizer.scrollToIndex(0, { align: 'start' });
    setHasNewResults(false);
  }, [virtualizer]);

  const baseCells = useMemo<Omit<VirtualSearchGridCell, 'mode'>[]>(
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
  const visibleDocumentIds = useMemo(
    () => baseCells.flatMap(cell => (cell.document ? [cell.document.id] : [])),
    [baseCells]
  );
  const progressiveContextKey = useMemo(
    () => JSON.stringify(listContextParams),
    [listContextParams]
  );
  const searchCardState = useSearchCardState();
  const interactiveIds = useProgressiveSearchCards({
    contextKey: progressiveContextKey,
    documentIds: visibleDocumentIds,
    stateReady: searchCardState?.isReady ?? false,
  });
  const cells = useMemo<VirtualSearchGridCell[]>(
    () =>
      baseCells.map(cell => ({
        ...cell,
        mode: cell.document && interactiveIds.has(cell.document.id) ? 'interactive' : 'preview',
      })),
    [baseCells, interactiveIds]
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
  };
}

export type VirtualSearchGridController = ReturnType<typeof useVirtualSearchGridController>;
