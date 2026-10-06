import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { StudioElement } from '../logic/document';
import {
  deleteTableColumns,
  deleteTableRows,
  formatTableCells,
  insertTableColumn,
  insertTableRow,
  normalizeTableSelection,
  setTableBorders,
  tableSelectionBounds,
  type StudioTable,
  type TableBorderAction,
  type TableSelection,
} from '../logic/table-operations';

export interface StudioTableGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  flipX?: boolean;
  flipY?: boolean;
}

export function StudioTableEditor({
  element,
  geometry,
  onChange,
  onDelete,
  onClose,
  onUndo,
  onRedo,
  de,
}: {
  element: StudioElement;
  geometry: StudioTableGeometry;
  onChange: (table: StudioTable) => void;
  onDelete: () => void;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  de: boolean;
}) {
  const table = element.table;
  if (!table) return null;
  return (
    <StudioTableEditorReady
      element={element}
      table={table}
      geometry={geometry}
      onChange={onChange}
      onDelete={onDelete}
      onClose={onClose}
      onUndo={onUndo}
      onRedo={onRedo}
      de={de}
    />
  );
}

function StudioTableEditorReady({
  element,
  table,
  geometry,
  onChange,
  onDelete,
  onClose,
  onUndo,
  onRedo,
  de,
}: {
  element: StudioElement;
  table: StudioTable;
  geometry: StudioTableGeometry;
  onChange: (table: StudioTable) => void;
  onDelete: () => void;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  de: boolean;
}) {
  const label = (german: string, english: string) => (de ? german : english);
  const [selection, setSelection] = useState<TableSelection>({
    anchorRow: 0,
    anchorColumn: 0,
    focusRow: 0,
    focusColumn: 0,
  });
  const [editing, setEditing] = useState<{ row: number; column: number } | null>(null);
  const dragging = useRef(false);
  const cellButtons = useRef(new Map<string, HTMLButtonElement>());
  const inputRef = useRef<HTMLInputElement>(null);
  const current = normalizeTableSelection(table, selection);
  const bounds = tableSelectionBounds(table, current);
  const key = (row: number, column: number) => `${row}:${column}`;
  const focusCell = (row: number, column: number) => {
    const r = Math.max(0, row);
    const c = Math.max(0, column);
    setSelection({ anchorRow: r, anchorColumn: c, focusRow: r, focusColumn: c });
    setEditing(null);
    queueMicrotask(() => cellButtons.current.get(key(r, c))?.focus());
  };
  useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  useEffect(() => {
    queueMicrotask(() => cellButtons.current.get('0:0')?.focus());
  }, [element.id]);
  useEffect(() => {
    setSelection(value => normalizeTableSelection(table, value));
    queueMicrotask(() =>
      cellButtons.current.get(key(current.focusRow, current.focusColumn))?.focus()
    );
  }, [table.rows.length, table.widths.length]);
  // Dimension limits are enforced by the disabled controls; every enabled
  // operation constructs a new table value.
  const apply = onChange;
  const startEdit = (row: number, column: number) => {
    setEditing({ row, column });
    setSelection({ anchorRow: row, anchorColumn: column, focusRow: row, focusColumn: column });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) onRedo();
      else onUndo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      onRedo();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (editing) focusCell(editing.row, editing.column);
      else onClose();
      return;
    }
    if (event.key === 'Tab' && editing) {
      event.preventDefault();
      const index = editing.row * table.widths.length + editing.column + (event.shiftKey ? -1 : 1);
      const wrapped =
        (index + table.rows.length * table.widths.length) %
        (table.rows.length * table.widths.length);
      focusCell(Math.floor(wrapped / table.widths.length), wrapped % table.widths.length);
      return;
    }
    if (editing || !(event.target instanceof HTMLButtonElement) || !event.target.dataset.tableCell)
      return;
    const { focusRow, focusColumn } = current;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      startEdit(focusRow, focusColumn);
      return;
    }
    const directions: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      const row = Math.max(0, Math.min(table.rows.length - 1, focusRow + direction[0]));
      const column = Math.max(0, Math.min(table.widths.length - 1, focusColumn + direction[1]));
      setSelection(value =>
        event.shiftKey
          ? { ...value, focusRow: row, focusColumn: column }
          : { anchorRow: row, anchorColumn: column, focusRow: row, focusColumn: column }
      );
      queueMicrotask(() => cellButtons.current.get(key(row, column))?.focus());
    }
  };
  const selectedCells = table.rows
    .slice(bounds.minRow, bounds.maxRow + 1)
    .flatMap(row => row.cells.slice(bounds.minColumn, bounds.maxColumn + 1));
  // A normalized selection in a schema-valid table always contains a cell.
  const selectedCell = table.rows[bounds.minRow].cells[bounds.minColumn];
  const cellStyle = (row: number, column: number): CSSProperties => {
    const cell = table.rows[row].cells[column];
    const edges = cell.borders ?? { top: true, right: true, bottom: true, left: true };
    return {
      backgroundColor: cell.fill,
      color: cell.color,
      fontWeight: cell.bold ? 700 : 400,
      textAlign: cell.align,
      borderColor: table.border,
      borderStyle: 'solid',
      borderWidth: `${edges.top ? 1 : 0}px ${edges.right ? 1 : 0}px ${edges.bottom ? 1 : 0}px ${edges.left ? 1 : 0}px`,
      width: `${(table.widths[column] / table.widths.reduce((a, b) => a + b, 0)) * 100}%`,
    };
  };
  const fullRowsSelected = bounds.maxRow - bounds.minRow + 1 >= table.rows.length;
  const fullColumnsSelected = bounds.maxColumn - bounds.minColumn + 1 >= table.widths.length;
  return (
    <div
      className="polity-table-edit-layer"
      onPointerDown={event => event.stopPropagation()}
      onPointerMove={event => event.stopPropagation()}
      onWheel={event => event.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <div className="polity-table-edit-scrim" onPointerDown={onClose} />
      <div
        className="polity-table-edit-toolbar"
        role="toolbar"
        aria-label={label('Tabellenwerkzeuge', 'Table tools')}
        style={{ left: Math.max(8, geometry.left), top: Math.max(8, geometry.top - 52) }}
      >
        <button
          type="button"
          disabled={table.rows.length >= 50}
          onClick={() => {
            apply(insertTableRow(table, bounds.minRow));
            focusCell(bounds.minRow, bounds.minColumn);
          }}
        >
          {label('Zeile davor', 'Insert row before')}
        </button>
        <button
          type="button"
          disabled={table.rows.length >= 50}
          onClick={() => {
            apply(insertTableRow(table, bounds.maxRow + 1));
            focusCell(bounds.maxRow + 1, bounds.minColumn);
          }}
        >
          {label('Zeile danach', 'Insert row after')}
        </button>
        <button
          type="button"
          disabled={fullRowsSelected}
          onClick={() => {
            apply(deleteTableRows(table, current));
            focusCell(bounds.minRow, bounds.minColumn);
          }}
        >
          {label('Zeile löschen', 'Delete rows')}
        </button>
        <button
          type="button"
          disabled={table.widths.length >= 20}
          onClick={() => {
            apply(insertTableColumn(table, bounds.minColumn));
            focusCell(bounds.minRow, bounds.minColumn);
          }}
        >
          {label('Spalte davor', 'Insert column before')}
        </button>
        <button
          type="button"
          disabled={table.widths.length >= 20}
          onClick={() => {
            apply(insertTableColumn(table, bounds.maxColumn + 1));
            focusCell(bounds.minRow, bounds.maxColumn + 1);
          }}
        >
          {label('Spalte danach', 'Insert column after')}
        </button>
        <button
          type="button"
          disabled={fullColumnsSelected}
          onClick={() => {
            apply(deleteTableColumns(table, current));
            focusCell(bounds.minRow, bounds.minColumn);
          }}
        >
          {label('Spalte löschen', 'Delete columns')}
        </button>
        <label>
          {label('Füllung', 'Fill')}{' '}
          <input
            data-action-kind="interaction"
            aria-label={label('Zellfüllung', 'Cell fill')}
            type="color"
            value={selectedCell.fill}
            onChange={event =>
              apply(formatTableCells(table, current, { fill: event.target.value }))
            }
          />
        </label>
        <label>
          {label('Textfarbe', 'Text color')}{' '}
          <input
            data-action-kind="interaction"
            aria-label={label('Zelltextfarbe', 'Cell text color')}
            type="color"
            value={selectedCell.color}
            onChange={event =>
              apply(formatTableCells(table, current, { color: event.target.value }))
            }
          />
        </label>
        <button
          type="button"
          aria-pressed={selectedCells.every(cell => cell.bold)}
          onClick={() =>
            apply(
              formatTableCells(table, current, { bold: !selectedCells.every(cell => cell.bold) })
            )
          }
        >
          {label('Fett', 'Bold')}
        </button>
        <label>
          {label('Ausrichtung', 'Alignment')}{' '}
          <select
            aria-label={label('Zellausrichtung', 'Cell alignment')}
            value={selectedCell.align}
            onChange={event =>
              apply(
                formatTableCells(table, current, {
                  align: event.target.value as 'left' | 'center' | 'right',
                })
              )
            }
          >
            <option value="left">{label('Links', 'Left')}</option>
            <option value="center">{label('Mitte', 'Center')}</option>
            <option value="right">{label('Rechts', 'Right')}</option>
          </select>
        </label>
        {(['top', 'right', 'bottom', 'left', 'outer', 'none'] as TableBorderAction[]).map(
          action => (
            <button
              key={action}
              type="button"
              onClick={() => apply(setTableBorders(table, current, action))}
            >
              {label(
                {
                  top: 'Oben',
                  right: 'Rechts',
                  bottom: 'Unten',
                  left: 'Links',
                  outer: 'Außen',
                  none: 'Keine',
                }[action],
                {
                  top: 'Top',
                  right: 'Right',
                  bottom: 'Bottom',
                  left: 'Left',
                  outer: 'Outer',
                  none: 'None',
                }[action]
              )}
            </button>
          )
        )}
        <button type="button" onClick={onDelete}>
          {label('Tabelle löschen', 'Delete table')}
        </button>
        <button type="button" onClick={onClose}>
          {label('Fertig', 'Done')}
        </button>
      </div>
      <div
        className="polity-table-edit-surface"
        style={{
          left: geometry.left,
          top: geometry.top,
          width: geometry.width,
          height: geometry.height,
          transform: `rotate(${geometry.rotation}deg) scale(${geometry.flipX ? -1 : 1}, ${geometry.flipY ? -1 : 1})`,
        }}
      >
        {table.widths.map((width, column) => (
          <button
            key={column}
            type="button"
            className="polity-table-column-handle"
            style={{
              left: `${(table.widths.slice(0, column).reduce((a, b) => a + b, 0) / table.widths.reduce((a, b) => a + b, 0)) * 100}%`,
              width: `${(width / table.widths.reduce((a, b) => a + b, 0)) * 100}%`,
            }}
            aria-label={`${label('Spalte', 'Column')} ${column + 1} ${label('auswählen', 'select')}`}
            onClick={() =>
              setSelection({
                anchorRow: 0,
                focusRow: table.rows.length - 1,
                anchorColumn: column,
                focusColumn: column,
              })
            }
          >
            {column + 1}
          </button>
        ))}
        {table.rows.map((row, index) => (
          <button
            key={row.id}
            type="button"
            className="polity-table-row-handle"
            style={{
              top: `${(index / table.rows.length) * 100}%`,
              height: `${100 / table.rows.length}%`,
            }}
            aria-label={`${label('Zeile', 'Row')} ${index + 1} ${label('auswählen', 'select')}`}
            onClick={() =>
              setSelection({
                anchorRow: index,
                focusRow: index,
                anchorColumn: 0,
                focusColumn: table.widths.length - 1,
              })
            }
          >
            {index + 1}
          </button>
        ))}
        <table
          role="grid"
          aria-label={label('Tabelle bearbeiten', 'Edit table')}
          style={{
            fontFamily: element.font,
            fontSize: Math.max(10, element.fontSize * (geometry.width / element.width)),
          }}
        >
          <colgroup>
            {table.widths.map((width, column) => (
              <col
                key={column}
                style={{ width: `${(width / table.widths.reduce((a, b) => a + b, 0)) * 100}%` }}
              />
            ))}
          </colgroup>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={row.id} style={{ height: `${100 / table.rows.length}%` }}>
                {row.cells.map((cell, columnIndex) => {
                  const selected =
                    rowIndex >= bounds.minRow &&
                    rowIndex <= bounds.maxRow &&
                    columnIndex >= bounds.minColumn &&
                    columnIndex <= bounds.maxColumn;
                  const isEditing = editing?.row === rowIndex && editing.column === columnIndex;
                  return (
                    <td
                      key={cell.id}
                      role="gridcell"
                      aria-selected={selected}
                      style={cellStyle(rowIndex, columnIndex)}
                    >
                      {isEditing ? (
                        <input
                          data-action-kind="interaction"
                          ref={inputRef}
                          aria-label={`${label('Zelle', 'Cell')} ${rowIndex + 1}, ${columnIndex + 1}`}
                          value={cell.text}
                          onChange={event => {
                            const next = structuredClone(table);
                            next.rows[rowIndex].cells[columnIndex].text = event.target.value;
                            apply(next);
                          }}
                          onBlur={() => setEditing(null)}
                        />
                      ) : (
                        <button
                          ref={node => {
                            if (node) cellButtons.current.set(key(rowIndex, columnIndex), node);
                            else cellButtons.current.delete(key(rowIndex, columnIndex));
                          }}
                          data-table-cell="true"
                          type="button"
                          aria-label={`${label('Zelle', 'Cell')} ${rowIndex + 1}, ${columnIndex + 1}: ${cell.text}`}
                          onPointerDown={event => {
                            dragging.current = true;
                            if (event.shiftKey)
                              setSelection(value => ({
                                ...value,
                                focusRow: rowIndex,
                                focusColumn: columnIndex,
                              }));
                            else
                              setSelection({
                                anchorRow: rowIndex,
                                anchorColumn: columnIndex,
                                focusRow: rowIndex,
                                focusColumn: columnIndex,
                              });
                          }}
                          onPointerEnter={() => {
                            if (dragging.current)
                              setSelection(value => ({
                                ...value,
                                focusRow: rowIndex,
                                focusColumn: columnIndex,
                              }));
                          }}
                          onDoubleClick={() => startEdit(rowIndex, columnIndex)}
                        >
                          {cell.text}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
