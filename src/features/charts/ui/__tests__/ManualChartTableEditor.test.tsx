/* @vitest-environment jsdom */

import * as React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ParsedChartTable } from '../../logic/chartData';
import { ManualChartTableEditor } from '../ManualChartTableEditor';
import { useManualChartTableEditorController } from '../useManualChartTableEditorController';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'plateJs.chart.row': 'Row',
        'plateJs.chart.column': 'Column',
        'plateJs.chart.removeRow': 'Remove row',
        'plateJs.chart.removeColumn': 'Remove column',
        'generated.inline.0293_rows_df849afe': ' rows · ',
      })[key] ?? key,
  }),
}));

afterEach(cleanup);

function EditorHarness() {
  const [table, setTable] = React.useState<ParsedChartTable>({
    columns: ['Category', 'Value'],
    rows: [
      { Category: 'A', Value: '1' },
      { Category: 'B', Value: '2' },
      { Category: 'C', Value: '3' },
    ],
  });
  return <ManualChartTableEditor table={table} onChange={setTable} />;
}

function PagedEditorHarness() {
  const [table, setTable] = React.useState<ParsedChartTable>({
    columns: ['Category', 'Value'],
    rows: Array.from({ length: 21 }, (_, index) => ({
      Category: `Row ${index + 1}`,
      Value: String(index + 1),
    })),
  });
  return <ManualChartTableEditor table={table} onChange={setTable} />;
}

describe('ManualChartTableEditor', () => {
  it('adds and removes rows and columns', () => {
    render(<EditorHarness />);

    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '10' } });
    expect(screen.getByDisplayValue('10')).toBeTruthy();

    expect(screen.getAllByRole('button', { name: 'Remove row' })).toHaveLength(3);
    expect(
      screen.getAllByRole('button', { name: 'Remove row' })[0]?.getAttribute('data-action-id')
    ).toBe('charts.manual-table.remove-row');
    fireEvent.click(screen.getByRole('button', { name: 'Row' }));
    expect(screen.getByRole('button', { name: 'Row' }).getAttribute('data-action-id')).toBe(
      'charts.manual-table.add-row'
    );
    expect(screen.getAllByRole('button', { name: 'Remove row' })).toHaveLength(4);

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove row' })[1]);
    expect(screen.getAllByRole('button', { name: 'Remove row' })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Column' }));
    expect(screen.getByRole('button', { name: 'Column' }).getAttribute('data-action-id')).toBe(
      'charts.manual-table.add-column'
    );
    expect(screen.getByDisplayValue('Column 3')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Remove column' })).toHaveLength(3);
    expect(
      screen.getAllByRole('button', { name: 'Remove column' })[0]?.getAttribute('data-action-id')
    ).toBe('charts.manual-table.remove-column');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove column' })[2]);
    expect(screen.queryByDisplayValue('Column 3')).toBeNull();
  });

  it('pages large manual tables through labeled stable actions', () => {
    render(<PagedEditorHarness />);

    const previous = screen.getByRole('button', { name: 'common.pagination.previous' });
    const next = screen.getByRole('button', { name: 'common.pagination.next' });
    expect(previous.getAttribute('data-action-id')).toBe('charts.manual-table.previous-page');
    expect(next.getAttribute('data-action-id')).toBe('charts.manual-table.next-page');
    expect((previous as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(next);
    expect((previous as HTMLButtonElement).disabled).toBe(false);
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  it('guards every mutation in read-only mode', () => {
    const onChange = vi.fn();
    const table: ParsedChartTable = {
      columns: ['Category', 'Value', 'Other'],
      rows: [{ Category: 'A', Value: '1', Other: '2' }],
    };
    const { result } = renderHook(() =>
      useManualChartTableEditorController({ table, onChange, readOnly: true })
    );

    act(() => {
      result.current.renameColumn('Category', 'Renamed');
      result.current.removeColumn('Other');
      result.current.removeRow(0);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders missing cells and relies on the native read-only input contract', () => {
    const onChange = vi.fn();
    render(
      <ManualChartTableEditor
        table={{ columns: ['Category', 'Value'], rows: [{ Category: 'A' }] }}
        onChange={onChange}
        readOnly
      />
    );

    const emptyCell = screen.getByDisplayValue('') as HTMLInputElement;
    fireEvent.change(emptyCell, { target: { value: 'ignored' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('validates renames and minimum dimensions before applying normalized changes', () => {
    const onChange = vi.fn();
    const table: ParsedChartTable = {
      columns: ['Category', 'Value'],
      rows: [{ Category: 'A' }],
    };
    const { result, rerender } = renderHook(
      ({ value }) => useManualChartTableEditorController({ table: value, onChange }),
      { initialProps: { value: table } }
    );

    act(() => {
      result.current.renameColumn('Category', '   ');
      result.current.renameColumn('Category', 'Value');
      result.current.removeColumn('Value');
      result.current.removeRow(0);
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => result.current.renameColumn('Category', ' Label '));
    expect(onChange).toHaveBeenLastCalledWith({
      columns: ['Label', 'Value'],
      rows: [{ Label: 'A', Value: '' }],
    });

    const expanded: ParsedChartTable = {
      columns: ['Category', 'Value', 'Other'],
      rows: [
        { Category: 'A', Value: '1', Other: 'x' },
        { Category: 'B', Other: 'y' },
      ],
    };
    rerender({ value: expanded });
    act(() => result.current.removeColumn('Other'));
    expect(onChange).toHaveBeenLastCalledWith({
      columns: ['Category', 'Value'],
      rows: [
        { Category: 'A', Value: '1' },
        { Category: 'B', Value: '' },
      ],
    });
    act(() => result.current.removeRow(1));
    expect(onChange).toHaveBeenLastCalledWith({
      ...expanded,
      rows: [{ Category: 'A', Value: '1', Other: 'x' }],
    });
  });

  it('clamps the active page when the backing table shrinks', () => {
    const large: ParsedChartTable = {
      columns: ['Category', 'Value'],
      rows: Array.from({ length: 21 }, (_, index) => ({
        Category: `${index}`,
        Value: `${index}`,
      })),
    };
    const { result, rerender } = renderHook(
      ({ table }) => useManualChartTableEditorController({ table, onChange: vi.fn() }),
      { initialProps: { table: large } }
    );
    act(() => result.current.setPage(1));
    expect(result.current.visibleRows).toHaveLength(1);

    rerender({ table: { ...large, rows: large.rows.slice(0, 2) } });
    expect(result.current.page).toBe(0);
    expect(result.current.pageCount).toBe(1);
  });
});
