import { useCallback, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { flexRender, useTable, type RowData } from '@tanstack/react-table';
import { rowAttributes } from '@rocicorp/zero-virtual/react';

import { usePolityZeroList } from '@/features/shared/virtualization';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { cn } from '@/features/shared/utils/utils';

import { dataTableFeatures, type DataTableColumnDef } from './dataTableFeatures';

interface PageOptions<TStart> {
  limit: number;
  start: TStart | null;
  dir: 'forward' | 'backward';
  settled: boolean;
}

export interface VirtualDataTableSource<TRow extends RowData, TStart, TContext> {
  context: TContext;
  historyKey: string;
  getPageQuery: (options: PageOptions<TStart>) => unknown;
  getSingleQuery: (options: { id: string; settled: boolean }) => unknown;
  getRowKey: (row: TRow) => string;
  toStartRow: (row: TRow) => TStart;
  mapRow?: (row: TRow) => TRow;
  permalinkID?: string | null;
}

export interface VirtualDataTableProps<TRow extends RowData, TStart, TContext> {
  columns: DataTableColumnDef<TRow, any>[];
  source: VirtualDataTableSource<TRow, TStart, TContext>;
  estimateRowSize?: number;
  overscan?: number;
  emptyTitle?: ReactNode;
  className?: string;
  tableClassName?: string;
  viewportClassName?: string;
  rowTestId?: string | ((row: TRow) => string | undefined);
  getRowClassName?: (row: TRow) => string | undefined;
}

/** Cursor-paged data table. Only visible rows plus overscan are mounted. */
export function VirtualDataTable<TRow extends RowData, TStart, TContext>({
  columns,
  source,
  estimateRowSize = 68,
  overscan = 10,
  emptyTitle = 'No results',
  className,
  tableClassName,
  viewportClassName = 'max-h-[42rem] overflow-auto',
  rowTestId,
  getRowClassName,
}: VirtualDataTableProps<TRow, TStart, TContext>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const list = usePolityZeroList<TContext, TRow, TStart>({
    scrollStateKey: source.historyKey,
    listContextParams: source.context,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: useCallback(() => estimateRowSize, [estimateRowSize]),
    overscan,
    getPageQuery: source.getPageQuery as never,
    getSingleQuery: source.getSingleQuery as never,
    getRowKey: source.getRowKey,
    toStartRow: source.toStartRow,
    permalinkID: source.permalinkID ?? undefined,
  });
  const visibleRows = useMemo(
    () =>
      list.items.flatMap(item =>
        item.row ? [source.mapRow ? source.mapRow(item.row) : item.row] : []
      ),
    [list.items, source]
  );
  const table = useTable({
    features: dataTableFeatures,
    data: visibleRows,
    columns,
    getRowId: source.getRowKey,
  });
  const rowsById = new Map(table.getRowModel().rows.map(row => [row.id, row]));

  return (
    <div
      className={cn('overflow-hidden rounded-md border', className)}
      data-slot="virtual-data-table"
    >
      <div ref={scrollRef} className={viewportClassName}>
        <Table className={tableClassName} aria-rowcount={list.total || undefined}>
          <TableHeader className="bg-card sticky top-0 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {list.spaceBefore > 0 ? (
              <TableRow aria-hidden="true">
                <TableCell
                  colSpan={columns.length}
                  className="p-0"
                  style={{ height: list.spaceBefore }}
                />
              </TableRow>
            ) : null}
            {list.rowsEmpty ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  {emptyTitle}
                </TableCell>
              </TableRow>
            ) : (
              list.items.map(item => {
                if (!item.row) {
                  return (
                    <TableRow
                      key={item.key}
                      {...rowAttributes(item.index, item.key)}
                      aria-busy="true"
                    >
                      {columns.map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                }
                const displayRow = source.mapRow ? source.mapRow(item.row) : item.row;
                const row = rowsById.get(source.getRowKey(displayRow));
                if (!row) return null;
                const testId = typeof rowTestId === 'function' ? rowTestId(displayRow) : rowTestId;
                return (
                  <TableRow
                    key={item.key}
                    {...rowAttributes(item.index, item.key)}
                    aria-rowindex={item.index + 2}
                    data-testid={testId}
                    className={getRowClassName?.(displayRow)}
                    style={{ '--civic-stagger-index': item.index % 12 } as CSSProperties}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
            {list.spaceAfter > 0 ? (
              <TableRow aria-hidden="true">
                <TableCell
                  colSpan={columns.length}
                  className="p-0"
                  style={{ height: list.spaceAfter }}
                />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
