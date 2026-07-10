import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { MAX_MANUAL_CHART_COLUMNS, MAX_MANUAL_CHART_ROWS } from '../types';
const PAGE_SIZE = 20;
export interface ManualChartTableEditorViewProps {
  table: { columns: any[]; rows: Record<string, string>[] };
  onChange: any;
  t: any;
  page: any;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageCount: any;
  visibleRows: any[];
  renameColumn: any;
  removeColumn: any;
  removeRow: (rowIndex: number) => void;
  readOnly?: boolean;
}

export function ManualChartTableEditorView({
  table,
  onChange,
  t,
  page,
  setPage,
  pageCount,
  visibleRows,
  renameColumn,
  removeColumn,
  removeRow,
  readOnly = false,
}: ManualChartTableEditorViewProps) {
  return (
    <div className="grid gap-3">
      <div className="max-h-[340px] overflow-auto border">
        <Table>
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-12 px-2 text-center">#</TableHead>
              {table.columns.map((column: any) => (
                <TableHead key={column} className="min-w-36 p-2">
                  <div className="flex items-center gap-1">
                    <Input
                      defaultValue={column}
                      className="hover:border-input h-8 border-transparent px-2 font-medium"
                      readOnly={readOnly}
                      onBlur={event => renameColumn(column, event.target.value)}
                    />
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        disabled={table.columns.length <= 2}
                        onClick={() => removeColumn(column)}
                        title={t('plateJs.chart.removeColumn')}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </TableHead>
              ))}
              {!readOnly ? <TableHead className="w-10 p-1" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row: any, visibleIndex: number) => {
              const rowIndex = page * PAGE_SIZE + visibleIndex;
              return (
                <TableRow key={rowIndex}>
                  <TableCell className="text-muted-foreground px-2 text-center">
                    {rowIndex + 1}
                  </TableCell>
                  {table.columns.map((column: any) => (
                    <TableCell key={column} className="p-1">
                      <Input
                        value={row[column] ?? ''}
                        className="hover:border-input h-9 min-w-32 border-transparent"
                        readOnly={readOnly}
                        onChange={event => {
                          if (readOnly) return;
                          const rows = [...table.rows];
                          rows[rowIndex] = { ...row, [column]: event.target.value };
                          onChange({ ...table, rows });
                        }}
                      />
                    </TableCell>
                  ))}
                  {!readOnly ? (
                    <TableCell className="w-10 p-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={table.rows.length <= 1}
                        onClick={() => removeRow(rowIndex)}
                        title={t('plateJs.chart.removeRow')}
                      >
                        <Trash2Icon className="size-4" />
                        <span className="sr-only">{t('plateJs.chart.removeRow')}</span>
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!readOnly ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={table.rows.length >= MAX_MANUAL_CHART_ROWS}
              onClick={() =>
                onChange({
                  ...table,
                  rows: [
                    ...table.rows,
                    Object.fromEntries(table.columns.map((column: any) => [column, ''])),
                  ],
                })
              }
            >
              <PlusIcon className="size-4" />
              {t('plateJs.chart.row')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={table.columns.length >= MAX_MANUAL_CHART_COLUMNS}
              onClick={() => {
                let index = table.columns.length + 1;
                let name = `Column ${index}`;
                while (table.columns.includes(name)) {
                  index += 1;
                  name = `Column ${index}`;
                }
                onChange({
                  columns: [...table.columns, name],
                  rows: table.rows.map((row: any) => ({ ...row, [name]: '' })),
                });
              }}
            >
              <PlusIcon className="size-4" />
              {t('plateJs.chart.column')}
            </Button>
          </div>
        ) : (
          <div />
        )}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>
            {table.rows.length.toLocaleString()}
            {t('generated.inline.0293_rows_df849afe')}
            {page + 1}/{pageCount}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={page === 0}
            onClick={() => setPage(current => current - 1)}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(current => current + 1)}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
