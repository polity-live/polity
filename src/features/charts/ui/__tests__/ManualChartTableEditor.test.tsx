/* @vitest-environment jsdom */

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ParsedChartTable } from '../../logic/chartData';
import { ManualChartTableEditor } from '../ManualChartTableEditor';

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

describe('ManualChartTableEditor', () => {
  it('adds and removes rows and columns', () => {
    render(<EditorHarness />);

    expect(screen.getAllByTitle('Remove row')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Row' }));
    expect(screen.getAllByTitle('Remove row')).toHaveLength(4);

    fireEvent.click(screen.getAllByTitle('Remove row')[1]);
    expect(screen.getAllByTitle('Remove row')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Column' }));
    expect(screen.getByDisplayValue('Column 3')).toBeTruthy();
    expect(screen.getAllByTitle('Remove column')).toHaveLength(3);

    fireEvent.click(screen.getAllByTitle('Remove column')[2]);
    expect(screen.queryByDisplayValue('Column 3')).toBeNull();
  });
});
