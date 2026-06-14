import type { Column, Table as ReactTable } from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { SearchField } from '@/features/shared/ui/form/SearchField';
import { StatusBadge } from '@/features/shared/ui/status/StatusBadges';
import { Button } from '@/features/shared/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';
import { cn } from '@/features/shared/utils/utils';

interface SortableHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  children: ReactNode;
  className?: string;
}

export function SortableHeader<TData, TValue>({
  column,
  children,
  className,
}: SortableHeaderProps<TData, TValue>) {
  const sortState = column.getIsSorted();
  const Icon = sortState === 'asc' ? ArrowUp : sortState === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('-ml-3 h-8 gap-1.5 px-2', className)}
      onClick={() => column.toggleSorting(sortState === 'asc')}
    >
      <span>{children}</span>
      <Icon className="size-3.5" />
    </Button>
  );
}

interface DataTableToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  className?: string;
}

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Filter...',
  children,
  className,
}: DataTableToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      {typeof searchValue === 'string' && onSearchChange ? (
        <SearchField
          value={searchValue}
          onValueChange={onSearchChange}
          placeholder={searchPlaceholder}
          fieldClassName="w-full sm:max-w-xs"
        />
      ) : (
        <div />
      )}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

interface DataTablePaginationProps<TData> {
  table: ReactTable<TData>;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
  className?: string;
}

export function DataTablePagination<TData>({
  table,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  className,
}: DataTablePaginationProps<TData>) {
  return (
    <div className={cn('flex items-center justify-end gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        <ChevronLeft className="size-4" />
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
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

interface RowAction {
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
}

interface RowActionsProps {
  actions: RowAction[];
  label?: string;
  className?: string;
}

export function RowActions({ actions, label = 'Open row actions', className }: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className={cn('size-8', className)}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, index) => (
          <div key={index}>
            {action.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              disabled={action.disabled}
              variant={action.destructive ? 'destructive' : 'default'}
              onSelect={action.onSelect}
            >
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface EntityCellProps {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  className?: string;
}

export function EntityCell({ title, description, meta, leading, className }: EntityCellProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        {description ? (
          <div className="text-muted-foreground truncate text-xs">{description}</div>
        ) : null}
        {meta ? <div className="text-muted-foreground mt-1 text-xs">{meta}</div> : null}
      </div>
    </div>
  );
}

interface DateCellProps {
  value: Date | string | number | null | undefined;
  emptyLabel?: ReactNode;
  format?: Intl.DateTimeFormatOptions;
  locale?: string;
}

export function DateCell({
  value,
  emptyLabel = '-',
  format = { dateStyle: 'medium' },
  locale,
}: DateCellProps) {
  if (!value) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return <span className="text-muted-foreground">{emptyLabel}</span>;
  }

  return <span>{new Intl.DateTimeFormat(locale, format).format(date)}</span>;
}

interface StatusCellProps {
  status?: string | null;
  children: ReactNode;
  className?: string;
}

export function StatusCell({ status, children, className }: StatusCellProps) {
  return (
    <StatusBadge status={status} className={className}>
      {children}
    </StatusBadge>
  );
}
