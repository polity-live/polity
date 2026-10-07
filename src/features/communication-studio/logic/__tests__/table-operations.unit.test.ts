import { describe, expect, it } from 'vitest';
import { documentSchema, element } from '../document';
import { createDocument } from '../templates';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../v3-adapter';
import { diffStudio, mergeStudioV3 } from '../operations';
import {
  createTableData,
  deleteTableColumns,
  deleteTableRows,
  formatTableCells,
  insertTableColumn,
  insertTableRow,
  normalizeTableSelection,
  normalizeTableWidths,
  setTableBorders,
  type TableSelection,
} from '../table-operations';

const select = (
  anchorRow: number,
  anchorColumn: number,
  focusRow = anchorRow,
  focusColumn = anchorColumn
): TableSelection => ({
  anchorRow,
  anchorColumn,
  focusRow,
  focusColumn,
});

describe('Studio table operations', () => {
  it('toggles perimeter borders without neighbors and preserves other sides when toggling a single side', () => {
    const table = createTableData({ rowCount: 1, colCount: 1 });
    const empty = setTableBorders(table, select(0, 0), 'none');
    expect(empty.rows[0].cells[0].borders).toEqual({
      top: false,
      right: false,
      bottom: false,
      left: false,
    });
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const visible = setTableBorders(empty, select(0, 0), side);
      expect(visible.rows[0].cells[0].borders).toEqual({
        top: false,
        right: false,
        bottom: false,
        left: false,
        [side]: true,
      });
      expect(setTableBorders(visible, select(0, 0), side).rows[0].cells[0].borders[side]).toBe(
        false
      );
    }
  });
  it('normalizes zero and invalid column weights while respecting schema minimum widths', () => {
    expect(normalizeTableWidths([0, NaN, -1, Infinity])).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(normalizeTableWidths([1, 0, -1])).toEqual([0.98, 0.01, 0.01]);
    expect(normalizeTableWidths([])).toEqual([]);
  });
  it('retains full tables when insertion would exceed the row or column limit', () => {
    const table = createTableData({ rowCount: 50, colCount: 20 });
    expect(insertTableRow(table, 0)).toBe(table);
    expect(insertTableColumn(table, 20)).toBe(table);
    for (const dimensions of [
      { rowCount: 1.5, colCount: 1 },
      { rowCount: 1, colCount: 1.5 },
      { rowCount: 1, colCount: 0 },
    ])
      expect(() => createTableData(dimensions)).toThrow(RangeError);
  });
  it('creates valid dimensions and stable distinct IDs while rejecting limits', () => {
    const table = createTableData({ rowCount: 3, colCount: 4 });
    expect(table.rows).toHaveLength(3);
    expect(table.widths).toHaveLength(4);
    expect(table.widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(1);
    const ids = [
      ...table.rows.map(row => row.id),
      ...table.rows.flatMap(row => row.cells.map(cell => cell.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    for (const dimensions of [
      { rowCount: 0, colCount: 2 },
      { rowCount: 51, colCount: 2 },
      { rowCount: 1, colCount: 21 },
    ]) {
      expect(() => createTableData(dimensions)).toThrow(RangeError);
    }
  });

  it('inserts and removes selected rows and columns without mutating existing content', () => {
    const original = createTableData({ rowCount: 3, colCount: 3 });
    original.rows[0].cells[0].text = 'Original';
    original.rows[0].cells[0].fill = '#123456';
    const insertedRow = insertTableRow(original, 1);
    expect(insertedRow.rows[1].cells[0]).toMatchObject({ text: '', fill: '#123456' });
    expect(insertedRow.rows[1].cells[0].id).not.toBe(original.rows[0].cells[0].id);
    const insertedColumn = insertTableColumn(insertedRow, 1);
    expect(insertedColumn.rows[0].cells[1]).toMatchObject({ text: '', fill: '#123456' });
    expect(insertedColumn.widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(1);
    const withoutRows = deleteTableRows(insertedColumn, select(1, 0, 2, 0));
    expect(withoutRows.rows).toHaveLength(2);
    const withoutColumns = deleteTableColumns(withoutRows, select(0, 1, 0, 2));
    expect(withoutColumns.widths).toHaveLength(2);
    expect(withoutColumns.rows[0].cells[0].text).toBe('Original');
    expect(original.rows[0].cells[0].text).toBe('Original');
    expect(original.rows).toHaveLength(3);
    expect(deleteTableRows(original, select(0, 0, 2, 0))).toBe(original);
    expect(deleteTableColumns(original, select(0, 0, 0, 2))).toBe(original);
    expect(normalizeTableSelection(withoutColumns, select(90, 90))).toMatchObject({
      focusRow: 1,
      focusColumn: 1,
    });
  });

  it('formats rectangular selections and mirrors shared borders', () => {
    const table = createTableData({ rowCount: 3, colCount: 3 });
    const range = select(0, 0, 1, 1);
    const formatted = formatTableCells(table, range, { bold: true, fill: '#abcdef' });
    expect(formatted.rows[1].cells[1]).toMatchObject({ bold: true, fill: '#abcdef' });
    expect(formatted.rows[2].cells[2].bold).toBe(false);
    const noBorders = setTableBorders(formatted, select(1, 1), 'none');
    expect(noBorders.rows[1].cells[1].borders).toEqual({
      top: false,
      right: false,
      bottom: false,
      left: false,
    });
    expect(noBorders.rows[0].cells[1].borders.bottom).toBe(false);
    expect(noBorders.rows[1].cells[0].borders.right).toBe(false);
    const restored = setTableBorders(noBorders, select(1, 1), 'outer');
    expect(restored.rows[1].cells[1].borders).toEqual({
      top: true,
      right: true,
      bottom: true,
      left: true,
    });
    const toggled = setTableBorders(restored, select(1, 1), 'top');
    expect(toggled.rows[1].cells[1].borders.top).toBe(false);
    expect(toggled.rows[0].cells[1].borders.bottom).toBe(false);
    expect(table.rows[1].cells[1].borders.top).toBe(true);
    const inserted = insertTableRow(toggled, 1);
    expect(inserted.rows[1].cells[1].borders.top).toBe(inserted.rows[0].cells[1].borders.bottom);
  });

  it('loads legacy cells without borders, round-trips V3, and merges independent cell edits', () => {
    const doc = createDocument('single', 'Table');
    const source = element('table');
    doc.pages[0].elements = [source];
    const old = structuredClone(doc);
    old.pages[0].elements[0].table?.rows.forEach(row =>
      row.cells.forEach(cell => {
        Reflect.deleteProperty(cell, 'borders');
      })
    );
    const parsed = documentSchema.parse(old);
    expect(parsed.pages[0].elements[0].table?.rows[0].cells[0].borders.top).toBe(true);
    const base = legacyDocumentToV3(parsed);
    const alice = structuredClone(base);
    const bob = structuredClone(base);
    const tableA = alice.nodes.find(node => node.type === 'table');
    const tableB = bob.nodes.find(node => node.type === 'table');
    if (!tableA || !tableB) throw new Error('Missing table');
    tableA.data.rows[0].cells[0].text = 'Alice';
    tableB.data.rows[0].cells[1].text = 'Bob';
    const first = mergeStudioV3(base, diffStudio(base, alice));
    const second = mergeStudioV3(first.value, diffStudio(base, bob));
    expect(second.conflicts).toEqual([]);
    const restored = v3DocumentToLegacy(second.value).pages[0].elements[0].table!;
    expect(restored.rows[0].cells.slice(0, 2).map(cell => cell.text)).toEqual(['Alice', 'Bob']);
    expect(restored.rows[0].cells[0].borders.top).toBe(true);
  });
});
