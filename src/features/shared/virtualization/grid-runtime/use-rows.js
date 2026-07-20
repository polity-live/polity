/* oxlint-disable no-unused-expressions */
// Vendored query windowing core; exposed only through the shared Polity grid adapter.
import { useQuery } from '@rocicorp/zero/react';
import { useCallback } from 'react';
import { assert, unreachable } from './asserts';
/**
 * Internal hook that manages the fetching and caching of rows for the virtualizer.
 *
 * @typeParam TRow - The type of row data returned from queries
 * @typeParam TStartRow - The type of data needed to anchor pagination
 */
export function useRows({ pageSize, anchor, settled, getPageQuery, getSingleQuery, toStartRow }) {
  const { kind, index: anchorIndex } = anchor;
  const isPermalink = kind === 'permalink';
  assert(!isPermalink || pageSize % 2 === 0);
  const halfPageSize = pageSize / 2;
  // --- All hooks called unconditionally, in the same order on every render ---
  // Hook 1: single-item lookup (permalink only; null otherwise keeps hook count stable)
  const permalinkId = isPermalink ? anchor.id : '';
  const singleResult_ = isPermalink ? getSingleQuery({ id: permalinkId, settled }) : null;
  const [singleRow, singleResult] = useQuery(singleResult_?.query ?? null, singleResult_?.options);
  const typedSingleRow = singleRow;
  const completeRow = singleResult.type === 'complete';
  const permalinkNotFound = isPermalink && completeRow && typedSingleRow === undefined;
  const singleStart = typedSingleRow ? toStartRow(typedSingleRow) : null;
  const pageStart = !isPermalink ? (anchor.startRow ?? null) : null;
  // Hook 2: page-before rows (permalink) OR main page rows (forward/backward)
  const q2Result = isPermalink
    ? !permalinkNotFound && singleStart
      ? getPageQuery({
          limit: halfPageSize + 1,
          start: singleStart,
          dir: 'backward',
          settled,
        })
      : null
    : getPageQuery({
        limit: pageSize + 1,
        start: pageStart,
        dir: kind,
        settled,
      });
  const [rows2, result2] = useQuery(q2Result?.query ?? null, q2Result?.options);
  // Hook 3: page-after rows (permalink only; null for forward/backward)
  const q3Result =
    isPermalink && !permalinkNotFound && singleStart
      ? getPageQuery({
          limit: halfPageSize,
          start: singleStart,
          dir: 'forward',
          settled,
        })
      : null;
  const [rows3, result3] = useQuery(q3Result?.query ?? null, q3Result?.options);
  // Derive values needed in useCallback before calling it
  const typedRows2 = rows2;
  const typedRows3 = rows3;
  const rowsBeforeLength = typedRows2?.length ?? 0;
  const rowsAfterLength = typedRows3?.length ?? 0;
  const rowsBeforeSize = Math.min(rowsBeforeLength, halfPageSize);
  const rowsAfterSize = Math.min(rowsAfterLength, halfPageSize - 1);
  const typedPageRows = typedRows2 ?? [];
  const hasMoreRows = !isPermalink && typedPageRows.length > pageSize;
  const paginatedRowsLength = hasMoreRows ? pageSize : typedPageRows.length;
  // Hook 4: single unified rowAt — same hook, same dep-array size, every render
  const rowAt = useCallback(
    index => {
      switch (kind) {
        case 'permalink': {
          if (index === anchorIndex) {
            return typedSingleRow;
          }
          if (index > anchorIndex) {
            if (typedRows3 === undefined) return undefined;
            const i = index - anchorIndex - 1;
            return i < rowsAfterSize ? typedRows3[i] : undefined;
          }
          if (typedRows2 === undefined) return undefined;
          const i = anchorIndex - index - 1;
          return i < rowsBeforeSize ? typedRows2[i] : undefined;
        }
        case 'forward': {
          const i = index - anchorIndex;
          return i >= 0 && i < paginatedRowsLength ? typedPageRows[i] : undefined;
        }
        case 'backward': {
          const i = anchorIndex - index - 1;
          return i >= 0 && i < paginatedRowsLength ? typedPageRows[i] : undefined;
        }
        default:
          unreachable(kind);
      }
    },
    [
      isPermalink,
      kind,
      anchorIndex,
      typedSingleRow,
      typedRows2,
      typedRows3,
      rowsBeforeSize,
      rowsAfterSize,
      typedPageRows,
      paginatedRowsLength,
    ]
  );
  // --- Pure value branching (no hooks below this line) ---
  const complete2 = result2.type === 'complete';
  const complete3 = result3.type === 'complete';
  if (isPermalink) {
    return {
      rowAt,
      rowsLength: permalinkNotFound ? 0 : rowsBeforeSize + rowsAfterSize + (typedSingleRow ? 1 : 0),
      complete: completeRow && (permalinkNotFound || (complete2 && complete3)),
      rowsEmpty:
        permalinkNotFound ||
        typedSingleRow === undefined ||
        (rowsBeforeSize === 0 && rowsAfterSize === 0),
      atStart: permalinkNotFound || (complete2 && rowsBeforeLength <= halfPageSize),
      atEnd: permalinkNotFound || (complete3 && rowsAfterLength <= halfPageSize - 1),
      firstRowIndex: permalinkNotFound ? anchorIndex : anchorIndex - rowsBeforeSize,
      permalinkNotFound,
    };
  }
  kind;
  if (kind === 'forward') {
    return {
      rowAt,
      rowsLength: paginatedRowsLength,
      complete: complete2,
      rowsEmpty: typedPageRows.length === 0,
      atStart: pageStart === null || anchorIndex === 0,
      atEnd: complete2 && !hasMoreRows,
      firstRowIndex: anchorIndex,
      permalinkNotFound,
    };
  }
  kind;
  assert(pageStart !== null);
  return {
    rowAt,
    rowsLength: paginatedRowsLength,
    complete: complete2,
    rowsEmpty: typedPageRows.length === 0,
    atStart: complete2 && !hasMoreRows,
    atEnd: false,
    firstRowIndex: anchorIndex - paginatedRowsLength,
    permalinkNotFound,
  };
}
