/* @vitest-environment jsdom */
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { element, type StudioElement } from '../../logic/document';
import { StudioTableEditor } from '../StudioTableEditor';

afterEach(cleanup);

function show() {
  let current = element('table');
  const onClose = vi.fn(),
    onDelete = vi.fn(),
    onUndo = vi.fn(),
    onRedo = vi.fn();
  function View() {
    const [value, setValue] = useState(current);
    return (
      <StudioTableEditor
        element={value}
        geometry={{ left: 100, top: 180, width: 300, height: 180, rotation: 30 }}
        de={false}
        onChange={table => {
          current = { ...value, table } as StudioElement;
          setValue(current);
        }}
        onClose={onClose}
        onDelete={onDelete}
        onUndo={onUndo}
        onRedo={onRedo}
      />
    );
  }
  const view = render(<View />);
  return { view, value: () => current, onClose, onDelete, onUndo, onRedo };
}

it('selects a range, formats it, and inserts or deletes around the selection', () => {
  const { value } = show();
  const grid = screen.getByRole('grid', { name: 'Edit table' });
  expect(grid.closest('.polity-table-edit-surface')?.getAttribute('style')).toContain(
    'rotate(30deg)'
  );
  fireEvent.pointerDown(within(grid).getByRole('button', { name: /Cell 1, 1/ }));
  fireEvent.pointerDown(within(grid).getByRole('button', { name: /Cell 2, 2/ }), {
    shiftKey: true,
  });
  expect(within(grid).getAllByRole('gridcell', { selected: true })).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
  expect(value().table!.rows[1].cells[1].bold).toBe(true);
  expect(value().table!.rows[2].cells[1].bold).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'None' }));
  expect(value().table!.rows[0].cells[0].borders.right).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Insert column before' }));
  expect(value().table!.widths).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Delete columns' }));
  expect(value().table!.widths).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Insert row after' }));
  expect(value().table!.rows).toHaveLength(4);
});

it('edits cell text, navigates with Tab, keeps undo in Studio, and closes with Escape', async () => {
  const { value, onClose, onUndo } = show();
  const grid = screen.getByRole('grid', { name: 'Edit table' });
  fireEvent.doubleClick(within(grid).getByRole('button', { name: /Cell 1, 1/ }));
  const input = within(grid).getByRole('textbox', { name: 'Cell 1, 1' });
  fireEvent.change(input, { target: { value: 'Hello' } });
  expect(value().table!.rows[0].cells[0].text).toBe('Hello');
  fireEvent.keyDown(input, { key: 'Tab' });
  await waitFor(() =>
    expect(document.activeElement).toBe(within(grid).getByRole('button', { name: /Cell 1, 2/ }))
  );
  fireEvent.keyDown(within(grid).getByRole('button', { name: /Cell 1, 2/ }), {
    key: 'z',
    ctrlKey: true,
  });
  expect(onUndo).toHaveBeenCalledOnce();
  fireEvent.keyDown(within(grid).getByRole('button', { name: /Cell 1, 2/ }), { key: 'Escape' });
  expect(onClose).toHaveBeenCalledOnce();
});

it('selects complete rows and columns using their handles', () => {
  show();
  const grid = screen.getByRole('grid', { name: 'Edit table' });
  fireEvent.click(screen.getByRole('button', { name: 'Column 2 select' }));
  expect(within(grid).getAllByRole('gridcell', { selected: true })).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Row 1 select' }));
  expect(within(grid).getAllByRole('gridcell', { selected: true })).toHaveLength(2);
});

it('moves focus into a newly appended row', async () => {
  show();
  const grid = screen.getByRole('grid', { name: 'Edit table' });
  fireEvent.pointerDown(within(grid).getByRole('button', { name: /Cell 3, 1/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Insert row after' }));
  await waitFor(() =>
    expect(document.activeElement).toBe(within(grid).getByRole('button', { name: /Cell 4, 1/ }))
  );
});
