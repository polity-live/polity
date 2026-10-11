import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createPlateEditor, Plate, PlateContent } from 'platejs/react';
import { TablePlugin } from '@platejs/table/react';
import { expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { TableToolbarButtonView } from '../TableToolbarButtonView';
import { Toolbar } from '@/features/shared/ui/layout';
import '@/styles.css';

async function fixture() {
  const editor = createPlateEditor({
    plugins: [TablePlugin],
    value: [{ type: 'p', children: [{ text: 'Original paragraph' }] }],
  });
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <Plate editor={editor}>
        <Toolbar>
          <TableToolbarButtonView
            props={{}}
            tableSelected={false}
            editor={editor}
            tf={editor.getTransforms(TablePlugin)}
            t={(key: string) => key}
            open={open}
            setOpen={setOpen}
            mergeState={{ canMerge: false, canSplit: false }}
          />
        </Toolbar>
        <PlateContent aria-label="Native Plate editor" />
      </Plate>
    );
  }
  const view = render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'plateJs.toolbar.table.title' });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const menu = within(await screen.findByRole('menu'));
  menu.getByRole('menuitem', { name: 'plateJs.toolbar.table.title' }).focus();
  await userEvent.keyboard('{ArrowRight}');
  const picker = await screen.findByRole('button', { name: 'plateJs.toolbar.table.title: 0 x 0' });
  const submenu = picker.closest<HTMLElement>('[data-slot="dropdown-menu-sub-content"]')!;
  // Finding the picker does not mean its animated submenu has stopped moving.
  // Aim the native pointer only after the actual opening animation finishes.
  await waitFor(() =>
    expect(submenu.getAnimations().some(animation => animation.playState === 'running')).toBe(false)
  );
  return { editor, view, picker };
}

it('inserts native keyboard table dimensions into the real Plate document and focuses the editor', async () => {
  const { editor, picker } = await fixture();
  picker.focus();
  expect(document.activeElement).toBe(picker);
  await userEvent.keyboard('{Enter}');
  expect(editor.children.some(node => node.type === 'table')).toBe(false);
  await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowDown}{Enter}');
  await waitFor(() => expect(editor.children.some(node => node.type === 'table')).toBe(true));
  const table = editor.children.find(node => node.type === 'table')!;
  expect(table.children).toHaveLength(2);
  expect(table.children.every((row: any) => row.children.length === 3)).toBe(true);
  expect(editor.children[0].children[0]).toMatchObject({ text: 'Original paragraph' });
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Native Plate editor' })
    )
  );
});

it('inserts pointer-selected grid dimensions into the real Plate editor without duplicate tables', async () => {
  const { editor, picker } = await fixture();
  const cell = picker.querySelector<HTMLElement>(
    '[data-table-size-row="3"][data-table-size-column="4"]'
  )!;
  await userEvent.hover(cell);
  await waitFor(() =>
    expect(picker.getAttribute('aria-label')).toBe('plateJs.toolbar.table.title: 3 x 4')
  );
  await userEvent.click(cell);
  await waitFor(() =>
    expect(editor.children.filter(node => node.type === 'table')).toHaveLength(1)
  );
  const table = editor.children.find(node => node.type === 'table')!;
  expect(table.children).toHaveLength(3);
  expect(table.children.every((row: any) => row.children.length === 4)).toBe(true);
});
