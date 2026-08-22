import type { ReactNode } from 'react';
import type { CellData, RowData } from '@tanstack/react-table';

import { useDataTableController } from '@/features/shared/hooks/useDataTableController';
import type { SurfaceMode } from '@/features/shared/ui/layout/SurfaceDepthContext';

import { DataTableView } from './DataTableView';
import type { DataTableColumnDef } from './dataTableFeatures';

export type ColumnDef<
  TData extends RowData,
  TValue extends CellData = CellData,
> = DataTableColumnDef<TData, TValue>;

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

interface DataTableProps<TData extends RowData> {
  columns: DataTableColumnDef<TData, any>[];
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
  getRowClassName?: (row: TData) => string | undefined;
  filterPlaceholder?: string;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
  enablePagination?: boolean;
  initialPageSize?: number;
  pagination?: DataTablePaginationOptions;
  surface?: SurfaceMode;
  className?: string;
  tableClassName?: string;
}

export function DataTable<TData extends RowData>({
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
  getRowClassName,
  filterPlaceholder = 'Filter...',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  enablePagination = true,
  initialPageSize = 10,
  pagination,
  surface = 'standalone',
  className,
  tableClassName,
}: DataTableProps<TData>) {
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
      getRowClassName={getRowClassName}
      filterPlaceholder={filterPlaceholder}
      surface={surface}
      className={className}
      tableClassName={tableClassName}
      {...controller}
    />
  );
}

export type { DataTableProps };
