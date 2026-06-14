import type { ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { useDataTableController } from '@/features/shared/hooks/useDataTableController';

import { DataTableView } from './DataTableView';

export interface DataTableFilter {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface DataTableEmptyState {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export interface DataTablePaginationOptions {
  enabled?: boolean;
  pageSize?: number;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
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
  emptyState?: DataTableEmptyState;
  filter?: DataTableFilter;
  toolbar?: ReactNode;
  rowTestId?: string | ((row: TData) => string | undefined);
  filterPlaceholder?: string;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
  enablePagination?: boolean;
  initialPageSize?: number;
  pagination?: DataTablePaginationOptions;
  className?: string;
  tableClassName?: string;
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
  emptyState,
  filter,
  toolbar,
  rowTestId,
  filterPlaceholder = 'Filter...',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  enablePagination = true,
  initialPageSize = 10,
  pagination,
  className,
  tableClassName,
}: DataTableProps<TData, TValue>) {
  const controller = useDataTableController({
    columns,
    data,
    getRowId,
    loadingRowCount,
    emptyTitle,
    emptyDescription,
    emptyAction,
    emptyState,
    filter,
    previousLabel,
    nextLabel,
    enablePagination,
    initialPageSize,
    pagination,
  });

  return (
    <DataTableView
      isLoading={isLoading}
      filter={filter}
      toolbar={toolbar}
      rowTestId={rowTestId}
      filterPlaceholder={filterPlaceholder}
      className={className}
      tableClassName={tableClassName}
      {...controller}
    />
  );
}

export type { ColumnDef, DataTableProps };
