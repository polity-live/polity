import type { StudioElement } from './document';

export type StudioTable = NonNullable<StudioElement['table']>;
export type StudioTableCell = StudioTable['rows'][number]['cells'][number];
export interface TableDimensions {
  rowCount: number;
  colCount: number;
}
export interface TableSelection {
  anchorRow: number;
  anchorColumn: number;
  focusRow: number;
  focusColumn: number;
}
export type TableBorderAction = 'top' | 'right' | 'bottom' | 'left' | 'outer' | 'none';
export type TableSide = 'top' | 'right' | 'bottom' | 'left';

export const visibleTableBorders = { top: true, right: true, bottom: true, left: true } as const;

export function createTableData({ rowCount, colCount }: TableDimensions): StudioTable {
  if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 50) {
    throw new RangeError('Table row count must be between 1 and 50');
  }
  if (!Number.isInteger(colCount) || colCount < 1 || colCount > 20) {
    throw new RangeError('Table column count must be between 1 and 20');
  }
  return {
    widths: Array.from({ length: colCount }, () => 1 / colCount),
    border: '#888888',
    rows: Array.from({ length: rowCount }, () => ({
      id: crypto.randomUUID(),
      cells: Array.from({ length: colCount }, () => ({
        id: crypto.randomUUID(),
        text: '',
        fill: '#FFFFFF',
        color: '#12362D',
        align: 'left',
        bold: false,
        borders: { ...visibleTableBorders },
      })),
    })),
  };
}

export function normalizeTableSelection(
  table: StudioTable,
  selection: TableSelection
): TableSelection {
  const row = (value: number) => Math.max(0, Math.min(table.rows.length - 1, value));
  const column = (value: number) => Math.max(0, Math.min(table.widths.length - 1, value));
  return {
    anchorRow: row(selection.anchorRow),
    anchorColumn: column(selection.anchorColumn),
    focusRow: row(selection.focusRow),
    focusColumn: column(selection.focusColumn),
  };
}

export function tableSelectionBounds(table: StudioTable, selection: TableSelection) {
  const s = normalizeTableSelection(table, selection);
  return {
    minRow: Math.min(s.anchorRow, s.focusRow),
    maxRow: Math.max(s.anchorRow, s.focusRow),
    minColumn: Math.min(s.anchorColumn, s.focusColumn),
    maxColumn: Math.max(s.anchorColumn, s.focusColumn),
  };
}

function cloneEmptyCell(source: StudioTableCell): StudioTableCell {
  return { ...structuredClone(source), id: crypto.randomUUID(), text: '' };
}

function reconcileTableEdges(table: StudioTable): StudioTable {
  table.rows.forEach((row, rowIndex) =>
    row.cells.forEach((cell, columnIndex) => {
      if (rowIndex > 0)
        cell.borders.top = table.rows[rowIndex - 1].cells[columnIndex].borders.bottom;
      if (columnIndex > 0) cell.borders.left = row.cells[columnIndex - 1].borders.right;
    })
  );
  return table;
}

/** Keep the total at one and every schema-constrained width at least 0.01. */
export function normalizeTableWidths(widths: number[]): number[] {
  const positive = widths.map(value => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = positive.reduce((sum, value) => sum + value, 0);
  const weights = total
    ? positive.map(value => value / total)
    : positive.map(() => 1 / widths.length);
  const minimum = 0.01;
  const remaining = 1 - widths.length * minimum;
  return weights.map(weight => minimum + remaining * weight);
}

export function insertTableRow(table: StudioTable, index: number): StudioTable {
  if (table.rows.length >= 50) return table;
  const next = structuredClone(table);
  const at = Math.max(0, Math.min(index, next.rows.length));
  const adjacent = next.rows[Math.max(0, Math.min(at - 1, next.rows.length - 1))];
  next.rows.splice(at, 0, {
    id: crypto.randomUUID(),
    cells: adjacent.cells.map(cloneEmptyCell),
  });
  return reconcileTableEdges(next);
}

export function insertTableColumn(table: StudioTable, index: number): StudioTable {
  if (table.widths.length >= 20) return table;
  const next = structuredClone(table);
  const at = Math.max(0, Math.min(index, next.widths.length));
  const adjacent = Math.max(0, Math.min(at - 1, next.widths.length - 1));
  next.widths.splice(at, 0, next.widths[adjacent]);
  next.widths = normalizeTableWidths(next.widths);
  next.rows.forEach(row => row.cells.splice(at, 0, cloneEmptyCell(row.cells[adjacent])));
  return reconcileTableEdges(next);
}

export function deleteTableRows(table: StudioTable, selection: TableSelection): StudioTable {
  const { minRow, maxRow } = tableSelectionBounds(table, selection);
  if (maxRow - minRow + 1 >= table.rows.length) return table;
  const next = structuredClone(table);
  next.rows.splice(minRow, maxRow - minRow + 1);
  return reconcileTableEdges(next);
}

export function deleteTableColumns(table: StudioTable, selection: TableSelection): StudioTable {
  const { minColumn, maxColumn } = tableSelectionBounds(table, selection);
  if (maxColumn - minColumn + 1 >= table.widths.length) return table;
  const next = structuredClone(table);
  next.widths.splice(minColumn, maxColumn - minColumn + 1);
  next.widths = normalizeTableWidths(next.widths);
  next.rows.forEach(row => row.cells.splice(minColumn, maxColumn - minColumn + 1));
  return reconcileTableEdges(next);
}

export function formatTableCells(
  table: StudioTable,
  selection: TableSelection,
  patch: Partial<Pick<StudioTableCell, 'fill' | 'color' | 'align' | 'bold'>>
): StudioTable {
  const next = structuredClone(table);
  const { minRow, maxRow, minColumn, maxColumn } = tableSelectionBounds(next, selection);
  for (let row = minRow; row <= maxRow; row++) {
    for (let column = minColumn; column <= maxColumn; column++) {
      Object.assign(next.rows[row].cells[column], patch);
    }
  }
  return next;
}

function setEdge(
  table: StudioTable,
  row: number,
  column: number,
  side: TableSide,
  visible: boolean
) {
  const cell = table.rows[row].cells[column];
  cell.borders[side] = visible;
  const neighbors = {
    top: [row - 1, column, 'bottom'],
    right: [row, column + 1, 'left'],
    bottom: [row + 1, column, 'top'],
    left: [row, column - 1, 'right'],
  } as const;
  const [neighborRow, neighborColumn, opposite] = neighbors[side];
  const neighbor = table.rows[neighborRow]?.cells[neighborColumn];
  if (neighbor) neighbor.borders[opposite] = visible;
}

export function setTableBorders(
  table: StudioTable,
  selection: TableSelection,
  action: TableBorderAction
): StudioTable {
  const next = structuredClone(table);
  const { minRow, maxRow, minColumn, maxColumn } = tableSelectionBounds(next, selection);
  if (action === 'none') {
    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        for (const side of ['top', 'right', 'bottom', 'left'] as const) {
          setEdge(next, row, column, side, false);
        }
      }
    }
    return next;
  }
  const edges: { row: number; column: number; side: TableSide }[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let column = minColumn; column <= maxColumn; column++) {
      if (row === minRow && (action === 'top' || action === 'outer'))
        edges.push({ row, column, side: 'top' });
      if (row === maxRow && (action === 'bottom' || action === 'outer'))
        edges.push({ row, column, side: 'bottom' });
      if (column === minColumn && (action === 'left' || action === 'outer'))
        edges.push({ row, column, side: 'left' });
      if (column === maxColumn && (action === 'right' || action === 'outer'))
        edges.push({ row, column, side: 'right' });
    }
  }
  const visible = !edges.every(
    ({ row, column, side }) => next.rows[row].cells[column].borders[side]
  );
  edges.forEach(({ row, column, side }) => setEdge(next, row, column, side, visible));
  return next;
}
