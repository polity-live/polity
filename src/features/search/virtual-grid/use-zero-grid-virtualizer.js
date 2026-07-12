// @ts-nocheck -- vendored compatibility implementation; exercised through its typed adapter API.
/**
 * Search-grid adapter derived from @rocicorp/zero-virtual 0.5.1.
 * The upstream source is Apache-2.0 licensed; see LICENSE.md in this directory.
 * Kept feature-local because zero-virtual 0.6 intentionally supports vertical lists only.
 */
import { useVirtualizer } from '@tanstack/react-virtual';
import { defaultKeyExtractor } from '@tanstack/virtual-core';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { assert } from './asserts';
import { pagingReducer } from './paging-reducer';
import { useRows } from './use-rows';
// Make sure this is even since we half it for scroll state loading
const MIN_PAGE_SIZE = 100;
const NUM_ROWS_FOR_LOADING_SKELETON = 1;
const TOP_ANCHOR = Object.freeze({
  index: 0,
  kind: 'forward',
  startRow: undefined,
});
const createPermalinkAnchor = id => ({
  id,
  index: NUM_ROWS_FOR_LOADING_SKELETON,
  kind: 'permalink',
});
/**
 * Hook that creates a virtualized list with bidirectional pagination and state persistence.
 *
 * This hook combines Tanstack Virtual's efficient virtualization with Zero's reactive queries
 * to create infinitely scrolling lists that load data on demand. It supports:
 * - Bidirectional scrolling (load more items at top or bottom)
 * - Permalink functionality (jump to and highlight specific items)
 * - State persistence (restore scroll position across navigation)
 * - Dynamic page sizing based on viewport
 *
 * @typeParam TScrollElement - The type of the scrollable container element
 * @typeParam TItemElement - The type of the individual item elements
 * @typeParam TListContextParams - The type of parameters that define the list's query context
 * @typeParam TRow - The type of row data returned from queries
 * @typeParam TStartRow - The type of data needed to anchor pagination
 *
 * @param options - Configuration options including query functions, sizing, and state management
 * @returns An object containing the virtualizer instance, row accessor, and state flags
 *
 * @example
 * ```tsx
 * const {virtualizer, rowAt, complete} = useZeroVirtualizer({
 *   estimateSize: () => 50,
 *   getScrollElement: () => scrollRef.current,
 *   listContextParams: {projectId: 'abc'},
 *   getPageQuery: ({limit, start, dir}) => ({query: z.query.issues.where(...).limit(limit)}),
 *   getSingleQuery: ({id}) => ({query: z.query.issues.where('id', id)}),
 *   toStartRow: (row) => ({id: row.id, created: row.created}),
 * });
 * ```
 */
function useZeroGridVirtualizerImplementation({
  // Tanstack Virtual params
  estimateSize,
  overscan = 5, // Virtualizer defaults to 1.
  getScrollElement,
  getItemKey = defaultKeyExtractor,
  // Zero specific params
  listContextParams,
  count,
  permalinkID,
  getPageQuery,
  getSingleQuery,
  settleTime = 2000,
  toStartRow,
  getRowKey,
  // Permalink state persistence
  scrollState,
  onScrollStateChange,
  onSettled,
  ...restVirtualizerOptions
}) {
  // Only restore from scrollState if its listContextParams matches the current context.
  // This prevents restoring stale scroll positions when filters/sort change.
  // Uses JSON.stringify for comparison since scrollState may come from serialized
  // storage (e.g., history.state) where object identity is not preserved.
  const effectiveScrollState = useMemo(() => {
    if (!scrollState) return null;
    if (JSON.stringify(scrollState.listContextParams) !== JSON.stringify(listContextParams)) {
      return null;
    }
    return scrollState;
  }, [scrollState, listContextParams]);
  // Settled state: starts unsettled, flips to true after settleTime ms of
  // no scroll activity. Resets on scroll or listContextParams change.
  const [settled, setSettled] = useState(false);
  // Tracks that a programmatic scroll adjustment (scrollToOffset) has been
  // issued but the browser scroll event has not yet been processed by the
  // virtualizer. While true, virtual items and scrollOffset are stale and
  // must not be used for paging decisions.
  const awaitingScrollSettleRef = useRef(false);
  const scrollOffsetRef = useRef(undefined);
  const resetSettleTimer = useCallback(() => {
    setSettled(false);
    const timer = setTimeout(() => {
      setSettled(true);
    }, settleTime);
    return () => clearTimeout(timer);
  }, [settleTime]);
  // Reset on listContextParams change and on initial mount.
  useEffect(() => {
    return resetSettleTimer();
  }, [resetSettleTimer, listContextParams]);
  // Fire onSettled callback when settled transitions to true.
  // Use a ref so that changes to the callback identity don't re-trigger the effect.
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  useEffect(() => {
    if (settled) {
      onSettledRef.current?.();
    }
  }, [settled]);
  // Initialize paging state from scrollState directly to avoid Strict Mode double-mount rows
  const [
    {
      estimatedTotal,
      hasReachedStart,
      hasReachedEnd,
      queryAnchor,
      pagingPhase,
      pendingScrollAdjustment,
    },
    dispatch,
  ] = useReducer(pagingReducer, undefined, () => {
    const anchor = effectiveScrollState
      ? effectiveScrollState.anchor
      : permalinkID
        ? createPermalinkAnchor(permalinkID)
        : TOP_ANCHOR;
    return {
      estimatedTotal: effectiveScrollState?.estimatedTotal ?? NUM_ROWS_FOR_LOADING_SKELETON,
      hasReachedStart: effectiveScrollState?.hasReachedStart ?? false,
      hasReachedEnd: effectiveScrollState?.hasReachedEnd ?? false,
      queryAnchor: {
        anchor,
        listContextParams,
      },
      pagingPhase: 'idle',
      pendingScrollAdjustment: 0,
    };
  });
  const isListContextCurrent = queryAnchor.listContextParams === listContextParams;
  const anchor = useMemo(() => {
    if (isListContextCurrent) {
      return queryAnchor.anchor;
    }
    return permalinkID ? createPermalinkAnchor(permalinkID) : TOP_ANCHOR;
  }, [isListContextCurrent, queryAnchor.anchor, permalinkID]);
  const [pageSize, setPageSize] = useState(MIN_PAGE_SIZE);
  const {
    rowAt,
    rowsLength,
    complete,
    rowsEmpty,
    atStart,
    atEnd,
    firstRowIndex,
    permalinkNotFound,
  } = useRows({
    pageSize,
    anchor,
    settled,
    getPageQuery,
    getSingleQuery,
    toStartRow,
  });
  const newEstimatedTotal = firstRowIndex + rowsLength;
  const internalCount =
    atEnd && atStart && complete
      ? rowsLength
      : Math.max(estimatedTotal, newEstimatedTotal) +
        (!atEnd && rowsLength > 0 ? NUM_ROWS_FOR_LOADING_SKELETON : 0);
  const effectiveCount = count ?? internalCount;
  const effectiveEstimatedTotal = count ?? estimatedTotal;
  const effectiveRowsEmpty = count === undefined ? rowsEmpty : count === 0;
  const virtualizer = useVirtualizer({
    ...restVirtualizerOptions,
    count: effectiveCount,
    estimateSize,
    overscan,
    getScrollElement,
    getItemKey: getRowKey
      ? index => {
          const row = rowAt(index);
          return row ? getRowKey(row) : getItemKey(index);
        }
      : getItemKey,
    initialOffset: () => {
      if (effectiveScrollState?.scrollTop !== undefined) {
        return effectiveScrollState.scrollTop;
      }
      if (anchor.kind === 'permalink') {
        // TODO: Support dynamic item sizes
        return anchor.index * estimateSize(0);
      }
      return 0;
    },
    horizontal: false,
  });
  // Reset settle timer on scroll.
  useEffect(() => {
    const offset = virtualizer.scrollOffset;
    const didScroll = scrollOffsetRef.current !== undefined && offset !== scrollOffsetRef.current;
    scrollOffsetRef.current = offset ?? undefined;
    if (didScroll) {
      awaitingScrollSettleRef.current = false;
      return resetSettleTimer();
    }
    return undefined;
  }, [virtualizer.scrollOffset, resetSettleTimer]);
  // Wrappers that mark a programmatic scroll as pending so paging effects
  // skip stale virtual items until the browser fires the real scroll event.
  const scrollToOffset = targetOffset => {
    const currentOffset = virtualizer.scrollOffset ?? 0;
    virtualizer.scrollToOffset(targetOffset);
    if (targetOffset !== currentOffset) {
      awaitingScrollSettleRef.current = true;
    }
  };
  const scrollToIndex = (...args) => {
    virtualizer.scrollToIndex(...args);
    awaitingScrollSettleRef.current = true;
  };
  useEffect(() => {
    // Make sure page size is enough to fill the scroll element at least
    // 3 times.  Don't shrink page size.
    const newPageSize = virtualizer.scrollRect
      ? Math.max(
          MIN_PAGE_SIZE,
          makeEven(
            Math.ceil(
              virtualizer.scrollRect?.height /
                // TODO: Support dynamic item sizes
                estimateSize(0)
            ) * 3
          )
        )
      : MIN_PAGE_SIZE;
    if (newPageSize > pageSize) {
      setPageSize(newPageSize);
    }
  }, [pageSize, virtualizer.scrollRect]);
  useEffect(() => {
    if (!isListContextCurrent || !onScrollStateChange) {
      return;
    }
    const timeoutId = setTimeout(() => {
      onScrollStateChange({
        anchor,
        scrollTop: virtualizer.scrollOffset ?? 0,
        estimatedTotal: effectiveEstimatedTotal,
        hasReachedStart,
        hasReachedEnd,
        listContextParams,
      });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [
    anchor,
    virtualizer.scrollOffset,
    effectiveEstimatedTotal,
    hasReachedStart,
    hasReachedEnd,
    isListContextCurrent,
    onScrollStateChange,
    listContextParams,
  ]);
  useEffect(() => {
    if (atStart) {
      dispatch({ type: 'REACHED_START' });
    }
  }, [atStart]);
  useEffect(() => {
    if (atEnd) {
      dispatch({ type: 'REACHED_END' });
    }
  }, [atEnd]);
  useEffect(() => {
    if (complete) {
      if (atStart && atEnd) {
        dispatch({ type: 'UPDATE_ESTIMATED_TOTAL', newTotal: rowsLength });
      } else if (newEstimatedTotal > estimatedTotal) {
        dispatch({ type: 'UPDATE_ESTIMATED_TOTAL', newTotal: newEstimatedTotal });
      }
    }
  }, [estimatedTotal, complete, atStart, atEnd, newEstimatedTotal]);
  // Apply scroll adjustments synchronously with layout to prevent visual jumps
  useLayoutEffect(() => {
    if (pendingScrollAdjustment !== 0) {
      const targetOffset =
        (virtualizer.scrollOffset ?? 0) +
        pendingScrollAdjustment *
          // TODO: Support dynamic item sizes
          estimateSize(0);
      scrollToOffset(targetOffset);
      dispatch({ type: 'SCROLL_ADJUSTED' });
    }
  }, [pendingScrollAdjustment, virtualizer]);
  useEffect(() => {
    if (rowsEmpty || !isListContextCurrent) {
      return;
    }
    if (pagingPhase === 'skipping' && pendingScrollAdjustment === 0) {
      dispatch({ type: 'PAGING_COMPLETE' });
      return;
    }
    // Skip if there's a pending scroll adjustment - let useLayoutEffect handle it
    if (pendingScrollAdjustment !== 0) {
      return;
    }
    // First row is before start of list - need to shift down
    if (firstRowIndex < 0) {
      const placeholderRows = !atStart ? NUM_ROWS_FOR_LOADING_SKELETON : 0;
      const offset = -firstRowIndex + placeholderRows;
      const newAnchor = {
        ...anchor,
        index: anchor.index + offset,
      };
      dispatch({ type: 'SHIFT_ANCHOR_DOWN', offset, newAnchor });
      return;
    }
    if (atStart && firstRowIndex > 0) {
      dispatch({ type: 'RESET_TO_TOP', offset: -firstRowIndex });
      return;
    }
  }, [
    firstRowIndex,
    anchor,
    atStart,
    pendingScrollAdjustment,
    pagingPhase,
    rowsEmpty,
    isListContextCurrent,
    // virtualizer - omitted to avoid infinite render loops from scroll events
  ]);
  // Track the last applied scroll state so we can detect when it changes due
  // to a real navigation (back/forward/push) as opposed to a re-render.
  const appliedScrollStateRef = useRef(effectiveScrollState);
  // Use layoutEffect to restore scroll position synchronously to avoid visual jumps.
  // Triggers when listContextParams changes OR when effectiveScrollState
  // changes (e.g. browser back/forward within the same list context).
  useLayoutEffect(() => {
    const scrollStateChanged = effectiveScrollState !== appliedScrollStateRef.current;
    appliedScrollStateRef.current = effectiveScrollState;
    if (!isListContextCurrent || scrollStateChanged) {
      if (effectiveScrollState) {
        scrollToOffset(effectiveScrollState.scrollTop);
        dispatch({
          type: 'RESET_STATE',
          estimatedTotal: effectiveScrollState.estimatedTotal,
          hasReachedStart: effectiveScrollState.hasReachedStart,
          hasReachedEnd: effectiveScrollState.hasReachedEnd,
          anchor: effectiveScrollState.anchor,
          listContextParams,
        });
      } else if (permalinkID) {
        // Check if the permalink item is already in the current virtual items.
        // If so, scroll directly to it instead of resetting to the loading skeleton.
        const permalinkVirtualItem = getRowKey
          ? virtualizer.getVirtualItems().find(item => {
              const row = rowAt(item.index);
              return row !== undefined && getRowKey(row) === permalinkID;
            })
          : undefined;
        if (permalinkVirtualItem) {
          scrollToIndex(permalinkVirtualItem.index, {
            align: 'auto',
          });
        } else {
          // TODO(arv): Figure out if we should scroll to top or bottom.
          const targetOffset =
            NUM_ROWS_FOR_LOADING_SKELETON *
            // TODO: Support dynamic item sizes
            estimateSize(0);
          scrollToOffset(targetOffset);
          dispatch({
            type: 'RESET_STATE',
            estimatedTotal: NUM_ROWS_FOR_LOADING_SKELETON,
            hasReachedStart: false,
            hasReachedEnd: false,
            anchor: createPermalinkAnchor(permalinkID),
            listContextParams,
          });
        }
      } else {
        scrollToOffset(0);
        dispatch({
          type: 'RESET_STATE',
          estimatedTotal: 0,
          hasReachedStart: true,
          hasReachedEnd: false,
          anchor: TOP_ANCHOR,
          listContextParams,
        });
      }
    }
  }, [isListContextCurrent, effectiveScrollState, permalinkID, virtualizer, listContextParams]);
  const total =
    count ??
    (atStart && atEnd ? rowsLength : hasReachedStart && hasReachedEnd ? estimatedTotal : undefined);
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    if (
      !isListContextCurrent ||
      virtualItems.length === 0 ||
      !complete ||
      pagingPhase !== 'idle' ||
      pendingScrollAdjustment !== 0
    ) {
      return;
    }
    // After a scroll adjustment (scrollToOffset), the browser fires the scroll
    // event asynchronously. Until then the virtualizer's virtual items and
    // scrollOffset are stale — they still reflect the *previous* scroll
    // position. Acting on stale items would cause spurious anchor updates
    // and cascading shifts.
    if (awaitingScrollSettleRef.current) {
      return;
    }
    if (atStart) {
      if (firstRowIndex !== 0) {
        dispatch({ type: 'UPDATE_ANCHOR', anchor: TOP_ANCHOR });
        return;
      }
    }
    const updateAnchorForEdge = (targetIndex, type, indexOffset) => {
      const index = toBoundIndex(targetIndex, firstRowIndex, rowsLength);
      const startRow = rowAt(index);
      assert(startRow !== undefined || type === 'forward');
      dispatch({
        type: 'UPDATE_ANCHOR',
        anchor: {
          index: index + indexOffset,
          kind: type,
          startRow,
        },
      });
    };
    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];
    const nearPageEdgeThreshold = getNearPageEdgeThreshold(pageSize);
    const distanceFromStart = firstItem.index - firstRowIndex;
    const distanceFromEnd = firstRowIndex + rowsLength - lastItem.index;
    if (!atStart && distanceFromStart <= nearPageEdgeThreshold) {
      updateAnchorForEdge(lastItem.index + 2 * nearPageEdgeThreshold, 'backward', 0);
      return;
    }
    if (!atEnd && distanceFromEnd <= nearPageEdgeThreshold) {
      updateAnchorForEdge(firstItem.index - 2 * nearPageEdgeThreshold, 'forward', 1);
      return;
    }
  }, [
    isListContextCurrent,
    virtualItems,
    pagingPhase,
    pendingScrollAdjustment,
    complete,
    pageSize,
    firstRowIndex,
    rowsLength,
    atStart,
    atEnd,
    rowAt,
  ]);
  return {
    virtualizer,
    rowAt,
    complete,
    rowsEmpty: effectiveRowsEmpty,
    permalinkNotFound,
    estimatedTotal: effectiveEstimatedTotal,
    total,
    settled,
  };
}
/**
 * Clamps an index to be within the valid range of rows.
 * @param targetIndex - The desired index to clamp
 * @param firstRowIndex - The first valid row index
 * @param rowsLength - The number of rows available
 * @returns The clamped index within [firstRowIndex, firstRowIndex + rowsLength - 1]
 */
function toBoundIndex(targetIndex, firstRowIndex, rowsLength) {
  if (rowsLength === 0) {
    return firstRowIndex;
  }
  return Math.max(firstRowIndex, Math.min(firstRowIndex + rowsLength - 1, targetIndex));
}
/**
 * Calculates the threshold for when to trigger loading more rows based on the page size.
 * @param pageSize - The current page size
 * @returns The threshold number of rows
 */
function getNearPageEdgeThreshold(pageSize) {
  return Math.ceil(pageSize / 10);
}
/**
 * Ensures a number is even by adding 1 if it is odd.
 * @param n - The number to make even
 * @returns The even number
 */
function makeEven(n) {
  return n % 2 === 0 ? n : n + 1;
}
/** Search-specific callers use the explicitly typed facade in use-search-grid-virtualizer.ts. */
export function useZeroGridVirtualizer(options) {
  return useZeroGridVirtualizerImplementation(options);
}
