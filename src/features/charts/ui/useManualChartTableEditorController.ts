import * as React from 'react';
import { useTranslation } from 'react-i18next';

import type { ParsedChartTable } from '../logic/chartData';

const PAGE_SIZE = 20;

interface ManualChartTableEditorProps {
  table: ParsedChartTable;
  onChange: (table: ParsedChartTable) => void;
  readOnly?: boolean;
}
export function useManualChartTableEditorController({
  table,
  onChange,
  readOnly = false,
}: ManualChartTableEditorProps) {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(table.rows.length / PAGE_SIZE));
  const visibleRows = table.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  React.useEffect(() => {
    setPage(current => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const renameColumn = (oldName: string, nextName: string) => {
    if (readOnly) return;
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
    if (readOnly) return;
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

  const removeRow = (rowIndex: number) => {
    if (readOnly || table.rows.length <= 1) return;
    onChange({
      ...table,
      rows: table.rows.filter((_, index) => index !== rowIndex),
    });
  };

  return {
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
    readOnly,
  };
}
