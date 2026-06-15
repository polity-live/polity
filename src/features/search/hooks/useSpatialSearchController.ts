import { useHistoryScrollState, useZeroVirtualizer } from '@rocicorp/zero-virtual/react';
import { useQuery } from '@rocicorp/zero/react';
import { useCallback, useEffect, useMemo, useRef, useState, type Key } from 'react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { queries } from '@/zero/queries';
import {
  GERMANY_CENTER,
  GERMANY_SEARCH_BOUNDS,
  mapSearchDocumentToSpatialItem,
  type SearchBounds,
  type SearchSpatialItem,
} from '../logic/searchSpatial';
import type {
  SearchDocument,
  SearchListContext,
  SearchStart,
} from '../types/search-document.types';
import { SEARCH_CARD_HEIGHT, SEARCH_GRID_GAP } from '../ui/VirtualSearchGridView';

export interface SpatialSearchListCell {
  key: Key;
  index: number;
  top: number;
  document?: SearchDocument | null;
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

function sameBounds(left: SearchBounds, right: SearchBounds) {
  const epsilon = 0.0001;
  return (
    Math.abs(left.north - right.north) < epsilon &&
    Math.abs(left.south - right.south) < epsilon &&
    Math.abs(left.east - right.east) < epsilon &&
    Math.abs(left.west - right.west) < epsilon
  );
}

function isSpatialItem(item: SearchSpatialItem | null): item is SearchSpatialItem {
  return item !== null;
}

function averageCenter(items: SearchSpatialItem[]): [number, number] {
  if (items.length === 0) return GERMANY_CENTER;

  const totals = items.reduce(
    (sum, item) => ({
      latitude: sum.latitude + item.coordinates.latitude,
      longitude: sum.longitude + item.coordinates.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return [totals.latitude / items.length, totals.longitude / items.length];
}

interface UseSpatialSearchControllerOptions {
  context: SearchListContext;
  permalinkID?: string | null;
  onTotalChange?: (total: number) => void;
}

export function useSpatialSearchController({
  context,
  permalinkID,
  onTotalChange,
}: UseSpatialSearchControllerOptions) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<SearchBounds>(GERMANY_SEARCH_BOUNDS);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(permalinkID ?? null);
  const [scrollState, setScrollState] = useHistoryScrollState<SearchStart>('search-spatial-list');

  const spatialContext = useMemo<SearchListContext>(
    () => ({
      ...context,
      bounds,
    }),
    [bounds, context]
  );

  const listContextParams = useMemo(
    () => ({
      query: spatialContext.query,
      types: [...spatialContext.types].sort(),
      topics: [...spatialContext.topics].sort(),
      createdAfter: spatialContext.createdAfter,
      engagement: spatialContext.engagement,
      sort: spatialContext.sort,
      snapshotAt: spatialContext.snapshotAt,
      bounds,
    }),
    [bounds, spatialContext]
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
          ...spatialContext,
          limit,
          start,
          dir,
        }) as any,
        options: { ttl },
      };
    },
    [spatialContext]
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
    overscan: 8,
    lanes: 1,
    getPageQuery,
    getSingleQuery,
    getRowKey,
    toStartRow,
    permalinkID,
    scrollState,
    onScrollStateChange: setScrollState,
    settleTime: 750,
  });

  const [rawMapRows = []] = useQuery(
    queries.search.searchDocumentPage({
      ...spatialContext,
      limit: 200,
      start: null,
      dir: 'forward',
    }) as any
  );
  const mapRows = rawMapRows as SearchDocument[];

  const mapItems = useMemo(
    () => mapRows.map(mapSearchDocumentToSpatialItem).filter(isSpatialItem),
    [mapRows]
  );
  const activeMapItem = mapItems.find(item => item.id === activeDocumentId) ?? null;
  const mapCenter = useMemo(() => averageCenter(mapItems), [mapItems]);

  useEffect(() => {
    onTotalChange?.(total ?? estimatedTotal);
  }, [estimatedTotal, onTotalChange, total]);

  const handleBoundsChange = useCallback((nextBounds: SearchBounds) => {
    setBounds(currentBounds =>
      sameBounds(currentBounds, nextBounds) ? currentBounds : nextBounds
    );
  }, []);

  const scrollToDocument = useCallback(
    (documentId: string) => {
      const index = mapRows.findIndex(row => row.id === documentId);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: 'start' });
      }
    },
    [mapRows, virtualizer]
  );

  const handleMapItemSelect = useCallback(
    (documentId: string) => {
      setActiveDocumentId(documentId);
      scrollToDocument(documentId);
    },
    [scrollToDocument]
  );

  const handleDocumentSelect = useCallback((document: SearchDocument) => {
    setActiveDocumentId(document.id);
  }, []);

  const virtualItems = virtualizer.getVirtualItems();
  const cells = useMemo<SpatialSearchListCell[]>(
    () =>
      virtualItems.map(virtualItem => ({
        key: virtualItem.key,
        index: virtualItem.index,
        top: virtualItem.start,
        document: rowAt(virtualItem.index),
      })),
    [rowAt, virtualItems]
  );

  return {
    parentRef,
    cells,
    totalHeight: virtualizer.getTotalSize(),
    rowsEmpty,
    isComplete: complete,
    emptyLabel: translateText('generated.inline.1110_keine_ergebnisse_2c33e7bb'),
    mapItems,
    activeMapItem,
    activeDocumentId,
    mapCenter,
    onBoundsChange: handleBoundsChange,
    onMapItemSelect: handleMapItemSelect,
    onActiveDocumentChange: setActiveDocumentId,
    onDocumentSelect: handleDocumentSelect,
    onMeasureElement: virtualizer.measureElement,
  };
}

export type SpatialSearchController = ReturnType<typeof useSpatialSearchController>;
