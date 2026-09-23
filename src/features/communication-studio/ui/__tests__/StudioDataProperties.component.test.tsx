/* @vitest-environment jsdom */
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { element, documentSchema } from '../../logic/document';
import { createDocument } from '../../logic/templates';
import { StudioDataProperties } from '../StudioDataProperties';
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));
afterEach(cleanup);
function show(type: 'table' | 'chart') {
  let current = element(type);
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
