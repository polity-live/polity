import type { CSSProperties, ReactNode } from 'react';
import {
  flexRender,
  type Row,
  type RowData,
  type Table as TanStackTable,
} from '@tanstack/react-table';
import { Search } from 'lucide-react';

import { Button } from '@/features/shared/ui/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/features/shared/ui/ui/empty';
import { Input } from '@/features/shared/ui/ui/input';
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
import {
  type SurfaceMode,
  useResolvedSurfaceMode,
} from '@/features/shared/ui/layout/SurfaceDepthContext';

import type { DataTableFilter } from './DataTable';
import type { DataTableFeatures } from './dataTableFeatures';

interface DataTableColumnMeta {
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
}

function getColumnMeta(columnDef: { meta?: unknown }): DataTableColumnMeta {
  return (columnDef.meta ?? {}) as DataTableColumnMeta;
}

interface DataTableViewProps<TData extends RowData> {
  isLoading: boolean;
  filter?: DataTableFilter;
  toolbar?: ReactNode;
  rowTestId?: string | ((row: TData) => string | undefined);
  getRowClassName?: (row: TData) => string | undefined;
  filterPlaceholder: string;
  surface?: SurfaceMode;
  className?: string;
  tableClassName?: string;
  table: TanStackTable<DataTableFeatures, TData>;
  rows: Row<DataTableFeatures, TData>[];
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  columnsLength: number;
  paginationEnabled: boolean;
  resolvedPreviousLabel: ReactNode;
  resolvedNextLabel: ReactNode;
  resolvedEmptyTitle: ReactNode;
  resolvedEmptyDescription?: ReactNode;
  resolvedEmptyAction?: ReactNode;
  loadingRows: number[];
}

export function DataTableView<TData extends RowData>({
  isLoading,
  filter,
  toolbar,
  rowTestId,
  getRowClassName,
  filterPlaceholder,
  surface = 'auto',
  className,
  tableClassName,
  table,
  rows,
  globalFilter,
  setGlobalFilter,
  columnsLength,
  paginationEnabled,
  resolvedPreviousLabel,
  resolvedNextLabel,
  resolvedEmptyTitle,
  resolvedEmptyDescription,
  resolvedEmptyAction,
  loadingRows,
}: DataTableViewProps<TData>) {
  const resolvedSurface = useResolvedSurfaceMode(surface);

  return (
    <div className={cn('space-y-3', className)}>
      {filter || toolbar ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {filter ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={globalFilter}
                onChange={event => setGlobalFilter(event.target.value)}
                placeholder={filter.placeholder ?? filterPlaceholder}
                className="pl-9"
              />
            </div>
          ) : null}
          {toolbar ? <div className="flex items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}

      <div
        className={cn(
          'overflow-hidden',
          resolvedSurface === 'standalone'
            ? 'civic-page-reveal bg-card rounded-md border shadow-[var(--shadow-panel)]'
            : 'border-border/70 border-y bg-transparent shadow-none'
        )}
        data-slot="data-table-surface"
        data-surface={resolvedSurface}
      >
        <Table className={tableClassName}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup: any) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header: any) => {
                  const meta = getColumnMeta(header.column.columnDef);

                  return (
                    <TableHead key={header.id} className={cn(meta.className, meta.headerClassName)}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              loadingRows.map((rowIndex: any) => (
                <TableRow key={`loading-${rowIndex}`}>
                  {Array.from({ length: columnsLength }, (_, cellIndex) => (
                    <TableCell key={`loading-${rowIndex}-${cellIndex}`}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row: any) => {
                const testId =
                  typeof rowTestId === 'function' ? rowTestId(row.original) : rowTestId;
                const rowClassName = getRowClassName?.(row.original);

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    data-testid={testId}
                    className={cn('civic-stagger-item', rowClassName)}
                    style={
                      {
                        '--civic-stagger-index': row.index % 12,
                      } as CSSProperties
                    }
                  >
                    {row.getVisibleCells().map((cell: any) => {
                      const meta = getColumnMeta(cell.column.columnDef);

                      return (
                        <TableCell key={cell.id} className={cn(meta.className, meta.cellClassName)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columnsLength} className="p-0">
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyTitle>{resolvedEmptyTitle}</EmptyTitle>
                      {resolvedEmptyDescription ? (
                        <EmptyDescription>{resolvedEmptyDescription}</EmptyDescription>
                      ) : null}
                    </EmptyHeader>
                    {resolvedEmptyAction ? (
                      <EmptyContent>{resolvedEmptyAction}</EmptyContent>
                    ) : null}
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {paginationEnabled && table.getPageCount() > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {resolvedPreviousLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {resolvedNextLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
