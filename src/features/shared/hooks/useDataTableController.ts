import type React from 'react';
import { useMemo, useState } from 'react';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';

import type {
  DataTableEmptyState,
  DataTableFilter,
  DataTablePaginationOptions,
} from '@/features/shared/ui/data-table/DataTable';

interface UseDataTableControllerOptions<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowId?: (row: TData, index: number) => string;
  loadingRowCount: number;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  emptyState?: DataTableEmptyState;
  filter?: DataTableFilter;
  previousLabel?: React.ReactNode;
  nextLabel?: React.ReactNode;
  enablePagination: boolean;
  initialPageSize: number;
  pagination?: DataTablePaginationOptions;
}

export function useDataTableController<TData, TValue>({
  columns,
  data,
  getRowId,
  loadingRowCount,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyState,
  filter,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  enablePagination,
  initialPageSize,
  pagination,
}: UseDataTableControllerOptions<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalFilter, setInternalFilter] = useState('');
  const globalFilter = filter?.value ?? internalFilter;
  const setGlobalFilter = filter?.onChange ?? setInternalFilter;
  const columnsLength = Math.max(columns.length, 1);
  const paginationEnabled = pagination?.enabled ?? enablePagination;
  const pageSize = pagination?.pageSize ?? initialPageSize;
  const resolvedPreviousLabel = pagination?.previousLabel ?? previousLabel;
  const resolvedNextLabel = pagination?.nextLabel ?? nextLabel;
  const resolvedEmptyTitle = emptyState?.title ?? emptyTitle ?? 'No results';
  const resolvedEmptyDescription = emptyState?.description ?? emptyDescription;
  const resolvedEmptyAction = emptyState?.action ?? emptyAction;
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
        pageSize,
      },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: paginationEnabled ? getPaginationRowModel() : undefined,
  });

  const rows = paginationEnabled ? table.getRowModel().rows : table.getFilteredRowModel().rows;

  return {
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
  };
}
