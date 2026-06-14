import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { MAX_MANUAL_CHART_COLUMNS, MAX_MANUAL_CHART_ROWS } from '../types';
import type { ParsedChartTable } from '../logic/chartData';

const PAGE_SIZE = 20;

interface ManualChartTableEditorProps {
  table: ParsedChartTable;
  onChange: (table: ParsedChartTable) => void;
}

/**
 * Design-system exception: this is a spreadsheet-style chart editor, not an app data table.
 * It intentionally uses shadcn Table primitives for editable cells and sticky headers.
 */
export function ManualChartTableEditor({ table, onChange }: ManualChartTableEditorProps) {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(table.rows.length / PAGE_SIZE));
  const visibleRows = table.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  React.useEffect(() => {
    setPage(current => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const renameColumn = (oldName: string, nextName: string) => {
    const normalized = nextName.trim();
    if (!normalized || (normalized !== oldName && table.columns.includes(normalized))) return;
    onChange({
      columns: table.columns.map(column => (column === oldName ? normalized : column)),
      rows: table.rows.map(row =>
        Object.fromEntries(
          table.columns.map(column => [column === oldName ? normalized : column, row[column] ?? ''])
        )
      ),
    });
  };

  const removeColumn = (column: string) => {
    if (table.columns.length <= 2) return;
    onChange({
      columns: table.columns.filter(item => item !== column),
      rows: table.rows.map(row =>
        Object.fromEntries(
          table.columns.filter(item => item !== column).map(item => [item, row[item] ?? ''])
        )
      ),
    });
  };

  return (
    <div className="grid gap-3">
      <div className="max-h-[340px] overflow-auto border">
        <Table>
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-12 px-2 text-center">#</TableHead>
              {table.columns.map(column => (
                <TableHead key={column} className="min-w-36 p-2">
                  <div className="flex items-center gap-1">
                    <Input
                      defaultValue={column}
                      className="hover:border-input h-8 border-transparent px-2 font-medium"
                      onBlur={event => renameColumn(column, event.target.value)}
                    />
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
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, visibleIndex) => {
              const rowIndex = page * PAGE_SIZE + visibleIndex;
              return (
                <TableRow key={rowIndex}>
                  <TableCell className="text-muted-foreground px-2 text-center">
                    {rowIndex + 1}
                  </TableCell>
                  {table.columns.map(column => (
                    <TableCell key={column} className="p-1">
                      <Input
                        value={row[column] ?? ''}
                        className="hover:border-input h-9 min-w-32 border-transparent"
                        onChange={event => {
                          const rows = [...table.rows];
                          rows[rowIndex] = { ...row, [column]: event.target.value };
                          onChange({ ...table, rows });
                        }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
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
                  Object.fromEntries(table.columns.map(column => [column, ''])),
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
                rows: table.rows.map(row => ({ ...row, [name]: '' })),
              });
            }}
          >
            <PlusIcon className="size-4" />
            {t('plateJs.chart.column')}
          </Button>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>
            {table.rows.length.toLocaleString()}
            {translateText('generated.inline.0293_rows_df849afe')}
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
