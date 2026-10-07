/* @vitest-environment jsdom */
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { element, type StudioElement } from '../../logic/document';
import { createTableData } from '../../logic/table-operations';
import { StudioTableEditor, type StudioTableGeometry } from '../StudioTableEditor';

afterEach(cleanup);

function show(
  initial = element('table'),
  de = false,
  geometry: StudioTableGeometry = { left: 100, top: 180, width: 300, height: 180, rotation: 30 }
) {
  let current = initial;
  const onClose = vi.fn(),
    onDelete = vi.fn(),
    onUndo = vi.fn(),
    onRedo = vi.fn();
  const onChange = vi.fn();
  function View() {
    const [value, setValue] = useState(current);
    return (
      <StudioTableEditor
        element={value}
        geometry={geometry}
        de={de}
        onChange={table => {
          onChange(table);
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
  return { view, value: () => current, onClose, onDelete, onUndo, onRedo, onChange };
}

it('selects a range, formats it, and inserts or deletes around the selection', () => {
  const { value } = show();
  const grid = screen.getByRole('grid', { name: 'Edit table' });
  expect(grid.closest('.polity-table-edit-surface')?.getAttribute('style')).toContain(
    'rotate(30deg)'
  );
  fireEvent.pointerDown(within(grid).getByRole('button', { name: /^Cell 1, 1:/ }));
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
  fireEvent.doubleClick(within(grid).getByRole('button', { name: /^Cell 1, 1:/ }));
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

it.each([
  ['Insert row before', 'rows', 4],
  ['Insert row after', 'rows', 4],
  ['Delete rows', 'rows', 2],
  ['Insert column before', 'widths', 3],
  ['Insert column after', 'widths', 3],
  ['Delete columns', 'widths', 1],
] as const)(
  'changes table dimensions with %s by keyboard, preserves remaining cells and focuses the resulting selection',
  async (name, dimension, count) => {
    const user = userEvent.setup();
    const { value, onChange } = show();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Cell 1, 1:/ }))
    );
    const before = structuredClone(value().table!);
    const button = screen.getByRole<HTMLButtonElement>('button', { name });
    button.focus();
    expect(document.activeElement).toBe(button);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledOnce();
    expect(value().table![dimension]).toHaveLength(count);
    const remaining = value().table!.rows.flatMap(row => row.cells);
    const surviving = before.rows
      .flatMap(row => row.cells)
      .filter(cell => remaining.some(next => next.id === cell.id));
    expect(surviving.length).toBeGreaterThan(0);
    for (const cell of surviving) {
      const next = remaining.find(item => item.id === cell.id)!;
      expect(next.text).toBe(cell.text);
      expect(next.fill).toBe(cell.fill);
      expect(next.color).toBe(cell.color);
    }
    await waitFor(() =>
      expect((document.activeElement as HTMLElement)?.dataset.tableCell).toBe('true')
    );
  }
);

it.each([
  [50, 1],
  [1, 20],
  [1, 1],
] as const)(
  'disables dimension changes at %s rows and %s columns without emitting a document change',
  async (rows, columns) => {
    const initial = element('table', {
      table: createTableData({ rowCount: rows, colCount: columns }),
    });
    const { onChange } = show(initial);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Cell 1, 1:/ }))
    );
    const user = userEvent.setup();
    const names =
      rows === 50
        ? ['Insert row before', 'Insert row after']
        : columns === 20
          ? ['Insert column before', 'Insert column after']
          : ['Delete rows', 'Delete columns'];
    for (const name of names) {
      const button = screen.getByRole<HTMLButtonElement>('button', { name });
      expect(button.disabled).toBe(true);
      await user.click(button);
    }
    expect(onChange).not.toHaveBeenCalled();
  }
);

it('changes selected cell formatting by keyboard, toggles bold in both states and leaves other cells unchanged', async () => {
  const user = userEvent.setup();
  const { value } = show();
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Cell 1, 1:/ }))
  );
  const other = structuredClone(value().table!.rows[2].cells[1]);
  const bold = screen.getByRole<HTMLButtonElement>('button', { name: 'Bold' });
  expect(bold.getAttribute('aria-pressed')).toBe('false');
  bold.focus();
  await user.keyboard(' ');
  expect(document.activeElement).toBe(bold);
  expect(bold.getAttribute('aria-pressed')).toBe('true');
  expect(value().table!.rows[0].cells[0].bold).toBe(true);
  await user.keyboard(' ');
  expect(bold.getAttribute('aria-pressed')).toBe('false');
  const align = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Cell alignment' });
  align.focus();
  await user.selectOptions(align, 'center');
  expect(document.activeElement).toBe(align);
  expect(value().table!.rows[0].cells[0].align).toBe('center');
  await user.selectOptions(align, 'right');
  expect(value().table!.rows[0].cells[0].align).toBe('right');
  for (const [name, property] of [
    ['Cell fill', 'fill'],
    ['Cell text color', 'color'],
  ] as const) {
    const input = screen.getByLabelText<HTMLInputElement>(name);
    input.focus();
    expect(document.activeElement).toBe(input);
    // jsdom exposes the native color selection as a change event.
    fireEvent.change(input, { target: { value: '#123456' } });
    expect(value().table!.rows[0].cells[0][property]).toBe('#123456');
  }
  expect(value().table!.rows[2].cells[1]).toEqual(other);
});

it.each(['Top', 'Right', 'Bottom', 'Left', 'Outer', 'None'])(
  'sets %s borders with keyboard activation while retaining toolbar focus',
  async name => {
    const user = userEvent.setup();
    const { value, onChange } = show();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Cell 1, 1:/ }))
    );
    const button = screen.getByRole<HTMLButtonElement>('button', { name });
    button.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(button);
    expect(onChange).toHaveBeenCalledOnce();
    const borders = value().table!.rows[0].cells[0].borders;
    if (name === 'None' || name === 'Outer')
      expect(Object.values(borders).every(value => !value)).toBe(true);
    else expect(borders[name.toLowerCase() as 'top' | 'right' | 'bottom' | 'left']).toBe(false);
    if (name !== 'None') {
      await user.keyboard('{Enter}');
      const restored = value().table!.rows[0].cells[0].borders;
      if (name === 'Outer') expect(Object.values(restored).every(Boolean)).toBe(true);
      else expect(restored[name.toLowerCase() as 'top' | 'right' | 'bottom' | 'left']).toBe(true);
    }
  }
);

it.each(['Done', 'Delete table'])(
  'dispatches %s once using keyboard and does not modify table contents',
  async name => {
    const user = userEvent.setup();
    const { value, onClose, onDelete, onChange } = show();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Cell 1, 1:/ }))
    );
    const before = structuredClone(value());
    const button = screen.getByRole<HTMLButtonElement>('button', { name });
    button.focus();
    await user.keyboard('{Enter}');
    expect(name === 'Done' ? onClose : onDelete).toHaveBeenCalledOnce();
    expect(name === 'Done' ? onDelete : onClose).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(value()).toEqual(before);
  }
);

it.each(['Row 2 select', 'Column 2 select'])(
  'selects %s by keyboard and changes the selected cells without modifying the rest',
  async name => {
    const user = userEvent.setup();
    const { value } = show();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Cell 1, 1:/ }))
    );
    const button = screen.getByRole<HTMLButtonElement>('button', { name });
    button.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(button);
    const selected = screen.getAllByRole('gridcell', { selected: true });
    expect(selected).toHaveLength(name.startsWith('Row') ? 2 : 3);
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    value().table!.rows.forEach((row, r) =>
      row.cells.forEach((cell, c) => {
        expect(cell.bold).toBe(name.startsWith('Row') ? r === 1 : c === 1);
      })
    );
    const first = screen.getByRole<HTMLButtonElement>('button', { name: /^Cell 1, 1:/ });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getAllByRole('gridcell', { selected: true })).toHaveLength(1);
  }
);

it('edits cells with keyboard focus, wraps Tab, restores selection on Escape and isolates history shortcuts', async () => {
  const user = userEvent.setup();
  const { value, onClose, onUndo, onRedo } = show();
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Cell 1, 1:/ }))
  );
  const first = screen.getByRole<HTMLButtonElement>('button', { name: /^Cell 1, 1:/ });
  await waitFor(() => expect(document.activeElement).toBe(first));
  await user.keyboard('{Enter}');
  const text = screen.getByRole<HTMLInputElement>('textbox', { name: 'Cell 1, 1' });
  expect(document.activeElement).toBe(text);
  await user.type(text, 'Edited cell');
  expect(value().table!.rows[0].cells[0].text).toBe('Edited cell');
  await user.keyboard('{Shift>}{Tab}{/Shift}');
  const last = screen.getByRole<HTMLButtonElement>('button', { name: /Cell 3, 2/ });
  expect(document.activeElement).toBe(last);
  await user.keyboard(' ');
  await user.keyboard('{Tab}');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Cell 1, 1:/ }));
  await user.keyboard('{Enter}{Escape}');
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  await user.keyboard('{Control>}z{/Control}{Control>}{Shift>}z{/Shift}{/Control}{Meta>}y{/Meta}');
  expect(onUndo).toHaveBeenCalledOnce();
  expect(onRedo).toHaveBeenCalledTimes(2);
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledOnce();
});

it('extends cell selection with Shift arrows, clamps navigation at table edges and stops pointer dragging after release or cancellation', async () => {
  const user = userEvent.setup();
  const { view } = show();
  const first = screen.getByRole<HTMLButtonElement>('button', { name: /^Cell 1, 1:/ });
  await waitFor(() => expect(document.activeElement).toBe(first));
  await user.keyboard('{ArrowUp}{ArrowLeft}');
  expect(document.activeElement).toBe(first);
  await user.keyboard('{Shift>}{ArrowRight}{ArrowDown}{/Shift}');
  expect(screen.getAllByRole('gridcell', { selected: true })).toHaveLength(4);
  await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
  const last = screen.getByRole<HTMLButtonElement>('button', { name: /Cell 3, 2/ });
  expect(document.activeElement).toBe(last);
  fireEvent.pointerDown(first);
  fireEvent.pointerEnter(last);
  expect(screen.getAllByRole('gridcell', { selected: true })).toHaveLength(6);
  fireEvent.pointerUp(window);
  fireEvent.pointerEnter(first);
  expect(screen.getAllByRole('gridcell', { selected: true })).toHaveLength(6);
  fireEvent.pointerDown(first);
  fireEvent.pointerCancel(window);
  fireEvent.pointerEnter(last);
  expect(screen.getAllByRole('gridcell', { selected: true })).toHaveLength(1);
  const layer = view.container.querySelector('.polity-table-edit-layer')!;
  const outerWheel = vi.fn();
  document.addEventListener('wheel', outerWheel);
  fireEvent.wheel(layer);
  expect(outerWheel).not.toHaveBeenCalled();
  document.removeEventListener('wheel', outerWheel);
  fireEvent.pointerMove(layer);
});

it('ends cell editing on blur and dismisses the editor from the outside scrim', async () => {
  const { view, onClose } = show();
  const first = screen.getByRole('button', { name: /^Cell 1, 1:/ });
  fireEvent.doubleClick(first);
  fireEvent.blur(screen.getByRole('textbox', { name: 'Cell 1, 1' }));
  expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.pointerDown(view.container.querySelector('.polity-table-edit-scrim')!);
  expect(onClose).toHaveBeenCalledOnce();
});

it('renders German tools and flipped geometry and preserves visible borders for legacy cells', () => {
  const initial = element('table');
  initial.table!.rows[0].cells[0] = Object.fromEntries(
    Object.entries(initial.table!.rows[0].cells[0]).filter(([key]) => key !== 'borders')
  ) as any;
  const { view } = show(initial, true, {
    left: 0,
    top: 0,
    width: 300,
    height: 180,
    rotation: 90,
    flipX: true,
    flipY: true,
  });
  expect(
    screen.getByRole('toolbar', { name: 'Tabellenwerkzeuge' }).getAttribute('style')
  ).toContain('left: 8px');
  expect(screen.getByRole('button', { name: 'Zeile davor' })).toBeTruthy();
  expect(screen.getByRole('grid', { name: 'Tabelle bearbeiten' })).toBeTruthy();
  expect(
    view.container.querySelector('.polity-table-edit-surface')?.getAttribute('style')
  ).toContain('scale(-1, -1)');
  const cell = screen.getAllByRole('gridcell')[0];
  for (const side of [
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
  ] as const)
    expect((cell as HTMLElement).style[side]).toBe('1px');
});

it('renders no table editor for a non-table element', () => {
  const { view, onChange, onClose } = show(element('text'));
  expect(view.container.children).toHaveLength(0);
  expect(onChange).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});
