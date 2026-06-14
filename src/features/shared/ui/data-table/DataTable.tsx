import { useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
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

interface DataTableFilter {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowId?: (row: TData, index: number) => string;
  isLoading?: boolean;
  loadingRowCount?: number;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  filter?: DataTableFilter;
  toolbar?: ReactNode;
  rowTestId?: string | ((row: TData) => string | undefined);
  filterPlaceholder?: string;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
  enablePagination?: boolean;
  initialPageSize?: number;
  className?: string;
  tableClassName?: string;
}

interface DataTableColumnMeta {
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
}

function getColumnMeta(columnDef: { meta?: unknown }): DataTableColumnMeta {
  return (columnDef.meta ?? {}) as DataTableColumnMeta;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  getRowId,
  isLoading = false,
  loadingRowCount = 5,
  emptyTitle,
  emptyDescription,
  emptyAction,
  filter,
  toolbar,
  rowTestId,
  filterPlaceholder = 'Filter...',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  enablePagination = true,
  initialPageSize = 10,
  className,
  tableClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalFilter, setInternalFilter] = useState('');
  const globalFilter = filter?.value ?? internalFilter;
  const setGlobalFilter = filter?.onChange ?? setInternalFilter;
  const columnsLength = Math.max(columns.length, 1);
  const loadingRows = useMemo(
    () => Array.from({ length: loadingRowCount }, (_, index) => index),
    [loadingRowCount]
  );

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: {
      sorting,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: initialPageSize,
      },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
  });

  const rows = enablePagination ? table.getRowModel().rows : table.getFilteredRowModel().rows;

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

      <div className="bg-card overflow-hidden rounded-md border">
        <Table className={tableClassName}>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
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
              loadingRows.map(rowIndex => (
                <TableRow key={`loading-${rowIndex}`}>
                  {Array.from({ length: columnsLength }, (_, cellIndex) => (
                    <TableCell key={`loading-${rowIndex}-${cellIndex}`}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map(row => {
                const testId =
                  typeof rowTestId === 'function' ? rowTestId(row.original) : rowTestId;

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    data-testid={testId}
                  >
                    {row.getVisibleCells().map(cell => {
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
                      <EmptyTitle>{emptyTitle ?? 'No results'}</EmptyTitle>
                      {emptyDescription ? (
                        <EmptyDescription>{emptyDescription}</EmptyDescription>
                      ) : null}
                    </EmptyHeader>
                    {emptyAction ? <EmptyContent>{emptyAction}</EmptyContent> : null}
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && table.getPageCount() > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {previousLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {nextLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export type { ColumnDef, DataTableProps };
