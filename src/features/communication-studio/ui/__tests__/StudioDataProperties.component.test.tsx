/* @vitest-environment jsdom */
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { element, documentSchema } from '../../logic/document';
import { createDocument } from '../../logic/templates';
import { createTableData } from '../../logic/table-operations';
import { StudioDataProperties } from '../StudioDataProperties';
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));
afterEach(cleanup);
function show(type: 'table' | 'chart', initial = element(type)) {
  let current = initial;
  function View() {
    const [value, setValue] = useState(current);
    return (
      <StudioDataProperties
        element={value}
        patch={patch => {
          current = { ...value, ...patch };
          const d = createDocument('single', 'Data');
          d.pages[0].elements = [current];
          documentSchema.parse(d);
          setValue(current);
        }}
      />
    );
  }
  render(<View />);
  return () => current;
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
it.each(['addRow', 'removeRow', 'addColumn', 'removeColumn'])(
  'changes table dimensions with %s through keyboard focus while preserving surviving cell identities',
  async action => {
    const value = show('table');
    const before = structuredClone(value().table!);
    const button = screen.getByRole('button', { name: action });
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(button).toHaveProperty('disabled', false);
    await userEvent.setup().keyboard('{Enter}');
    const after = value().table!;
    const delta = action.startsWith('add') ? 1 : -1;
    expect(after.rows.length).toBe(before.rows.length + (action.endsWith('Row') ? delta : 0));
    expect(after.widths.length).toBe(
      before.widths.length + (action.endsWith('Column') ? delta : 0)
    );
    const beforeIds = before.rows.flatMap(row => row.cells.map(cell => cell.id));
    const afterIds = after.rows.flatMap(row => row.cells.map(cell => cell.id));
    expect(afterIds.filter(id => beforeIds.includes(id))).toHaveLength(
      Math.min(beforeIds.length, afterIds.length)
    );
  }
);
it.each([
  [50, 1, 'addRow', 'removeColumn'],
  [1, 20, 'addColumn', 'removeRow'],
] as const)(
  'locks table dimension limits at %s rows and %s columns',
  async (rowCount, colCount, maximum, minimum) => {
    const value = show(
      'table',
      element('table', { table: createTableData({ rowCount, colCount }) })
    );
    const before = structuredClone(value());
    for (const name of [maximum, minimum]) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveProperty('disabled', true);
      await userEvent.setup().click(button);
    }
    expect(value()).toEqual(before);
  }
);
it.each(['table', 'chart'] as const)(
  'toggles %s formatting by keyboard in both selection states',
  async type => {
    const value = show(type);
    const label = type === 'table' ? 'bold' : 'legend';
    const checkbox = screen.getAllByRole('checkbox', { name: label })[0];
    const selected = () =>
      type === 'table' ? value().table!.rows[0].cells[0].bold : value().chart!.legend;
    const before = selected();
    checkbox.focus();
    expect(document.activeElement).toBe(checkbox);
    const user = userEvent.setup();
    await user.keyboard(' ');
    expect(selected()).toBe(!before);
    await user.keyboard(' ');
    expect(selected()).toBe(before);
  }
);
it('rejects out-of-range column widths and nonnumeric chart values and supports line charts', () => {
  const table = show('table');
  const width = table().table!.widths[0];
  fireEvent.change(screen.getByLabelText('columnWidth 1'), { target: { value: '0' } });
  expect(table().table!.widths[0]).toBe(width);
  cleanup();
  const chart = show('chart');
  fireEvent.change(screen.getByLabelText('chartType'), { target: { value: 'line' } });
  expect(chart().chart!.kind).toBe('line');
  const values = [...chart().chart!.series[0].values];
  fireEvent.change(screen.getByLabelText(`${chart().chart!.series[0].name} A`), {
    target: { value: '' },
  });
  expect(chart().chart!.series[0].values).toEqual(values);
});
it('edits cells and selected row or column structure while keeping stable identities', () => {
  const value = show('table'),
    first = value().table!.rows[0].id;
  const cell = screen.getByLabelText('cell 2, 1');
  cell.focus();
  fireEvent.focus(cell);
  fireEvent.change(cell, { target: { value: 'Edited' } });
  expect(value().table!.rows[1].cells[0].text).toBe('Edited');
  fireEvent.change(screen.getAllByLabelText('background')[0], { target: { value: '#abcdef' } });
  fireEvent.change(screen.getAllByLabelText('color')[0], { target: { value: '#123456' } });
  fireEvent.change(screen.getAllByLabelText('alignment')[0], { target: { value: 'center' } });
  fireEvent.click(screen.getAllByLabelText('bold')[0]);
  expect(value().table!.rows[0].cells[0]).toMatchObject({
    fill: '#abcdef',
    color: '#123456',
    align: 'center',
    bold: true,
  });
  click('removeRow');
  expect(value().table!.rows[0].id).toBe(first);
  expect(value().table!.rows).toHaveLength(2);
  click('addRow');
  expect(value().table!.rows).toHaveLength(3);
  click('addColumn');
  expect(value().table!.widths).toHaveLength(3);
  click('removeColumn');
  expect(value().table!.widths).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('columnWidth 1'), { target: { value: '0.7' } });
  expect(value().table!.widths[0]).toBe(0.7);
  fireEvent.change(screen.getByLabelText('border'), { target: { value: '#aabbcc' } });
  expect(value().table!.border).toBe('#aabbcc');
  click('removeRow');
  click('removeRow');
  expect((screen.getByRole('button', { name: 'removeRow' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  click('removeColumn');
  expect((screen.getByRole('button', { name: 'removeColumn' }) as HTMLButtonElement).disabled).toBe(
    true
  );
});
it('edits chart data and legend while keeping pie constraints and minimum dimensions valid', () => {
  const value = show('chart');
  fireEvent.change(screen.getByLabelText('series'), { target: { value: 'Votes' } });
  fireEvent.change(screen.getByLabelText('color'), { target: { value: '#aabbcc' } });
  fireEvent.change(screen.getAllByLabelText('label')[0], { target: { value: 'North' } });
  fireEvent.change(screen.getByLabelText('Votes North'), { target: { value: '12' } });
  fireEvent.click(screen.getByLabelText('legend'));
  expect(value().chart).toMatchObject({
    legend: false,
    series: [{ name: 'Votes', color: '#aabbcc', values: [12, 60, 45] }],
  });
  click('addData');
  click('removeData');
  click('addSeries');
  expect(value().chart!.series).toHaveLength(2);
  click('removeSeries');
  fireEvent.change(screen.getByLabelText('chartType'), { target: { value: 'pie' } });
  expect((screen.getByRole('button', { name: 'addSeries' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  fireEvent.change(screen.getByLabelText('color North'), { target: { value: '#cc3377' } });
  expect(value().chart!.colors![0]).toBe('#cc3377');
  fireEvent.change(screen.getByLabelText('Votes North'), { target: { value: '-3' } });
  expect(value().chart!.series[0].values[0]).toBeGreaterThan(0);
  click('removeData');
  click('removeData');
  expect((screen.getByRole('button', { name: 'removeData' }) as HTMLButtonElement).disabled).toBe(
    true
  );
});
