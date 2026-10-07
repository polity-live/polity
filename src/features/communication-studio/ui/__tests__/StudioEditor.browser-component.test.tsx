import {
  io,
  notifyAll,
  show,
  value,
  ydoc,
  useCanonicalDocument,
  setup,
} from './StudioWorkspace.fixture';
import { act, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { element } from '../../logic/document';
import { openStudioPanel } from '../../logic/panel-events';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.replace('features.studio.', '') }),
}));

async function mount() {
  useCanonicalDocument();
  const view = await show();
  await screen.findByTestId('canvas', {}, { timeout: 10_000 });
  return view;
}

async function selectText() {
  const selected = value().pages[0].elements.find(item => item.type === 'text')!;
  await userEvent.click(screen.getByRole('button', { name: `Select text ${selected.id}` }));
  return selected.id;
}

function current(id: string) {
  return value().pages[0].elements.find(item => item.id === id)!;
}

function inspector() {
  return within(screen.getByRole('region', { name: 'properties' }));
}

async function activate(element: HTMLElement) {
  element.focus();
  expect(document.activeElement).toBe(element);
  await userEvent.keyboard('{Enter}');
}

async function selectOption(control: HTMLSelectElement, value: string) {
  const index = [...control.options].findIndex(option => option.value === value);
  expect(index).toBeGreaterThanOrEqual(0);
  control.focus();
  await userEvent.keyboard(`{Home}${'{ArrowDown}'.repeat(index)}{Enter}`);
  expect(document.activeElement).toBe(control);
  expect(control.value).toBe(value);
}

async function menu(name: string) {
  const trigger = screen.getByRole('button', { name });
  await activate(trigger);
  return { trigger, menu: within(await screen.findByRole('menu')) };
}

it('edits selected text through native inspector keyboard controls', async () => {
  await mount();
  const selected = value().pages[0].elements.find(item => item.type === 'text')!;
  await userEvent.click(screen.getByRole('button', { name: `Select text ${selected.id}` }));
  const properties = screen.getByRole('region', { name: 'properties' });
  const inspector = within(properties);
  const text = inspector.getByRole('textbox', { name: 'text' });
  await userEvent.fill(text, 'Native editor text');
  expect(document.activeElement).toBe(text);
  await waitFor(() =>
    expect(value().pages[0].elements.find(item => item.id === selected.id)?.text).toBe(
      'Native editor text'
    )
  );
  const vertical = inspector.getByRole('combobox', { name: 'verticalAlign' });
  expect((vertical as HTMLSelectElement).value).toBe('top');
  vertical.focus();
  await userEvent.keyboard('{End}{Enter}');
  await waitFor(() =>
    expect(value().pages[0].elements.find(item => item.id === selected.id)?.verticalAlign).toBe(
      'bottom'
    )
  );
  expect(document.activeElement).toBe(vertical);
  await userEvent.keyboard('{Home}{Enter}');
  await waitFor(() => expect(current(selected.id).verticalAlign).toBe('top'));
});

it('toggles inspector text marks with native keyboard focus and retains the selected node', async () => {
  await mount();
  const id = await selectText();
  for (const mark of ['bold', 'italic', 'underline'] as const) {
    const original = current(id)[mark];
    const control = inspector().getByRole('button', { name: mark });
    expect(control.getAttribute('data-action-id')).toBe(
      'communication-studio.text.inspector.toggle-mark'
    );
    expect(control.getAttribute('aria-pressed')).toBe(String(original));
    await activate(control);
    await waitFor(() => expect(current(id)[mark]).toBe(!original));
    expect(control.getAttribute('aria-pressed')).toBe(String(!original));
    await userEvent.keyboard(' ');
    await waitFor(() => expect(current(id)[mark]).toBe(original));
    expect(io.canvasProps.selected).toEqual([id]);
    expect(document.activeElement).toBe(control);
  }
});

it('chooses and clears native font menu radio selections and restores trigger focus', async () => {
  await mount();
  const id = await selectText();
  const original = current(id).font;
  let opened = await menu('font');
  const inter = opened.menu.getByRole('menuitemradio', { name: 'Inter' });
  expect(inter.getAttribute('data-action-id')).toBe('communication-studio.text.font.select');
  expect(inter.getAttribute('aria-checked')).toBe('false');
  await activate(inter);
  await waitFor(() => expect(current(id).font).toBe('Inter'));
  await waitFor(() => expect(document.activeElement).toBe(opened.trigger));
  opened = await menu('font');
  expect(
    opened.menu.getByRole('menuitemradio', { name: 'Inter' }).getAttribute('aria-checked')
  ).toBe('true');
  await activate(opened.menu.getByRole('menuitemradio', { name: original }));
  await waitFor(() => expect(current(id).font).toBe(original));
  expect(io.canvasProps.selected).toEqual([id]);
});

it('changes all paragraph alignment radio choices with native keyboard activation', async () => {
  await mount();
  const id = await selectText();
  for (const alignment of ['center', 'right', 'justify', 'left'] as const) {
    const opened = await menu('alignment');
    const option = opened.menu.getByRole('menuitemradio', { name: alignment });
    expect(option.getAttribute('data-action-id')).toBe(
      'communication-studio.text.alignment.select'
    );
    expect(option.getAttribute('aria-checked')).toBe('false');
    await activate(option);
    await waitFor(() => expect(current(id).align).toBe(alignment));
    await waitFor(() => expect(document.activeElement).toBe(opened.trigger));
    const selected = await menu('alignment');
    expect(
      selected.menu.getByRole('menuitemradio', { name: alignment }).getAttribute('aria-checked')
    ).toBe('true');
    await userEvent.keyboard('{Escape}');
  }
});

it('updates every horizontal and vertical constraint through native select keyboard controls', async () => {
  await mount();
  const id = await selectText();
  for (const [axis, values] of [
    ['horizontal', ['right', 'left-right', 'center', 'scale', 'left']],
    ['vertical', ['bottom', 'top-bottom', 'center', 'scale', 'top']],
  ] as const) {
    const control = inspector().getByRole('combobox', {
      name: `${axis}Constraint`,
    }) as HTMLSelectElement;
    expect(control.getAttribute('data-action-id')).toBe(
      `communication-studio.node.constraint.${axis}`
    );
    for (const value of values) {
      await selectOption(control, value);
      await waitFor(() =>
        expect(io.editor.v3Value.nodes.find((node: any) => node.id === id).constraints[axis]).toBe(
          value
        )
      );
    }
  }
  expect(io.canvasProps.selected).toEqual([id]);
});

it('selects every arrowhead on both ends using native keyboard controls', async () => {
  const arrow = element('arrow', { x: 30, y: 40, width: 240, height: 50 });
  ydoc.pages[0].elements.push(arrow);
  await mount();
  await userEvent.click(screen.getByRole('button', { name: `Select arrow ${arrow.id}` }));
  for (const endpoint of ['startArrowhead', 'endArrowhead'] as const) {
    const control = inspector().getByRole('combobox', { name: endpoint }) as HTMLSelectElement;
    expect(control.getAttribute('data-action-id')).toBe(
      'communication-studio.shape.arrowhead.select'
    );
    for (const shape of ['arrow', 'bar', 'dot', 'triangle', 'none']) {
      await selectOption(control, shape);
      await waitFor(() =>
        expect(io.editor.v3Value.nodes.find((node: any) => node.id === arrow.id)[endpoint]).toBe(
          shape
        )
      );
    }
  }
});

it('applies palette colors with native keyboard focus and exposes the selected color', async () => {
  await mount();
  const id = await selectText();
  for (const role of ['primary', 'secondary']) {
    const control = inspector().getByRole('button', { name: `color ${role}` });
    expect(control.getAttribute('data-action-id')).toBe(
      'communication-studio.text.color.select-role'
    );
    await activate(control);
    expect(control.getAttribute('aria-pressed')).toBe('true');
    expect(current(id).fill.toLowerCase()).toBe(
      io.canvasProps.document.theme.light[role].toLowerCase()
    );
  }
});

it('disables text and constraint controls when collaboration editing permission is revoked', async () => {
  await mount();
  const id = await selectText();
  const original = current(id);
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  const properties = screen.getByRole('region', { name: 'properties' });
  for (const control of properties.querySelectorAll('button,input,select,textarea')) {
    expect(control.matches(':disabled')).toBe(true);
  }
  const toolbar = within(screen.getByRole('toolbar', { name: 'tools' }));
  for (const mark of [
    'bold',
    'italic',
    'underline',
    'strikethrough',
    'code',
    'highlight',
    'font',
    'alignment',
  ]) {
    expect(toolbar.getByRole('button', { name: mark }).getAttribute('aria-disabled')).toBe('true');
  }
  await userEvent.keyboard('{Tab}{Enter}');
  expect(current(id)).toEqual(original);
});

it('toggles text toolbar marks through native keyboard activation without altering other nodes', async () => {
  await mount();
  const id = await selectText();
  const toolbar = within(screen.getByRole('toolbar', { name: 'tools' }));
  const untouched = value()
    .pages[0].elements.filter(node => node.id !== id)
    .map(({ richText: _richText, ...node }) => node);
  for (const mark of ['bold', 'italic', 'underline', 'strikethrough'] as const) {
    const before = current(id)[mark];
    const control = toolbar.getByRole('button', { name: mark });
    expect(control.getAttribute('data-action-id')).toBe(
      'communication-studio.text.toolbar.toggle-mark'
    );
    await activate(control);
    await waitFor(() => expect(current(id)[mark]).toBe(!before));
    expect(control.getAttribute('aria-pressed')).toBe(String(!before));
    await userEvent.keyboard(' ');
    await waitFor(() => expect(current(id)[mark]).toBe(before));
  }
  expect(
    value()
      .pages[0].elements.filter(node => node.id !== id)
      .map(({ richText: _richText, ...node }) => node)
  ).toEqual(untouched);
});

it('applies code and highlight marks from the native toolbar while retaining keyboard focus', async () => {
  await mount();
  const id = await selectText();
  const toolbar = within(screen.getByRole('toolbar', { name: 'tools' }));
  for (const mark of ['code', 'highlight']) {
    const control = toolbar.getByRole('button', { name: mark });
    expect(control.getAttribute('data-action-id')).toBe(
      `communication-studio.text.mark-${mark}.apply`
    );
    await activate(control);
    expect(
      io.editor.v3Value.nodes.find((node: any) => node.id === id).content[0].children[0][mark]
    ).toBe(true);
    expect(document.activeElement).toBe(control);
    expect(io.canvasProps.selected).toEqual([id]);
  }
});

it('locks and unlocks the selected node with native keyboard activation and updates inspector availability', async () => {
  await mount();
  const id = await selectText();
  const tools = within(screen.getByRole('toolbar', { name: 'tools' }));
  const lock = tools.getByRole('button', { name: 'lock' });
  expect(lock.getAttribute('data-action-id')).toBe('communication-studio.selection.lock.toggle');
  expect(lock.getAttribute('aria-pressed')).toBe('false');
  await activate(lock);
  expect(current(id).locked).toBe(true);
  const unlock = tools.getByRole('button', { name: 'unlock' });
  expect(unlock.getAttribute('aria-pressed')).toBe('true');
  expect(inspector().getByRole('textbox', { name: 'text' }).matches(':disabled')).toBe(true);
  await activate(unlock);
  expect(current(id).locked).toBe(false);
  expect(inspector().getByRole('textbox', { name: 'text' }).matches(':disabled')).toBe(false);
  expect(io.canvasProps.selected).toEqual([id]);
  expect(document.activeElement).toBe(lock);
});

it('duplicates and deletes through the native toolbar while preserving other nodes and clearing removed selection', async () => {
  await mount();
  const id = await selectText();
  const ids = new Set(io.editor.v3Value.nodes.map((node: any) => node.id));
  const tools = within(screen.getByRole('toolbar', { name: 'tools' }));
  const duplicate = tools.getByRole('button', { name: 'duplicate' });
  expect(duplicate.getAttribute('data-action-id')).toBe(
    'communication-studio.selection.copy.duplicate'
  );
  await activate(duplicate);
  const added = io.editor.v3Value.nodes.filter((node: any) => !ids.has(node.id));
  expect(added).toHaveLength(1);
  expect(added[0].type).toBe('richText');
  expect(added[0].content[0].children.map((leaf: any) => leaf.text).join('')).toBe(
    current(id).text
  );
  expect(io.canvasProps.selected).toEqual([id]);
  const remove = tools.getByRole('button', { name: 'remove' });
  expect(remove.getAttribute('data-action-id')).toBe(
    'communication-studio.selection.remove.delete'
  );
  await activate(remove);
  expect(io.editor.v3Value.nodes.some((node: any) => node.id === id)).toBe(false);
  expect(io.editor.v3Value.nodes.some((node: any) => node.id === added[0].id)).toBe(true);
  expect(io.canvasProps.selected).toEqual([]);
  expect(tools.getByRole('button', { name: 'remove' }).getAttribute('aria-disabled')).toBe('true');
});

it('disables lock duplicate and delete for empty selection and revoked editing rights', async () => {
  await mount();
  const tools = within(screen.getByRole('toolbar', { name: 'tools' }));
  for (const name of ['lock', 'duplicate', 'remove']) {
    expect(tools.getByRole('button', { name }).getAttribute('aria-disabled')).toBe('true');
  }
  const id = await selectText();
  const before = structuredClone(io.editor.v3Value);
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  for (const name of ['lock', 'duplicate', 'remove']) {
    expect(tools.getByRole('button', { name }).getAttribute('aria-disabled')).toBe('true');
  }
  await userEvent.keyboard('{Tab} ');
  expect(io.editor.v3Value).toEqual(before);
  expect(io.editor.v3Value.nodes.some((node: any) => node.id === id)).toBe(true);
});

it('rejects document keyboard shortcuts while procedure editing is disabled', async () => {
  io.procedureEditingAllowed = false;
  await mount();
  await selectText();
  const original = structuredClone(io.editor.v3Value);
  const focus = screen.getByRole('button', { name: 'selection' });
  focus.focus();
  io.canvasExecute.mockClear();
  for (const keys of [
    '{ArrowLeft}',
    '{Delete}',
    '{Control>}d{/Control}',
    '{Control>}x{/Control}',
    '{Control>}b{/Control}',
    '{Control>}z{/Control}',
  ]) {
    await userEvent.keyboard(keys);
    expect(io.editor.v3Value).toEqual(original);
    expect(io.canvasExecute).not.toHaveBeenCalled();
  }
  expect(io.editor.undo).not.toHaveBeenCalled();
});

it('edits the project title with native keyboard focus and blocks title changes after permission revocation', async () => {
  await mount();
  const title = screen.getByRole('textbox', { name: 'name' }) as HTMLInputElement;
  expect(title.getAttribute('data-action-id')).toBe('communication-studio.project.title.edit');
  expect(title.value).toBe('Editable campaign');
  await userEvent.fill(title, 'Native project title');
  expect(document.activeElement).toBe(title);
  await waitFor(() => expect(value().title).toBe('Native project title'));
  await userEvent.fill(title, 'Restored title');
  await waitFor(() => expect(value().title).toBe('Restored title'));
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  expect(title.disabled).toBe(true);
});

it('searches export frames and toggles all and current selections using native keyboard focus', async () => {
  setup('carousel');
  ydoc.pages.forEach((frame, index) => {
    frame.name = `Native export frame ${index + 1}`;
  });
  await mount();
  await act(async () => {
    openStudioPanel('exports');
  });
  const panel = within(await screen.findByRole('dialog', { name: 'exports' }));
  const query = panel.getByRole('searchbox', { name: 'searchExportFrames' });
  expect(query.getAttribute('data-action-id')).toBe('communication-studio.export.frames.search');
  const boxes = () => panel.getAllByRole('checkbox') as HTMLInputElement[];
  expect(boxes().every(box => box.checked)).toBe(true);
  await userEvent.fill(query, 'frame 2');
  expect(document.activeElement).toBe(query);
  await waitFor(() => expect(boxes()).toHaveLength(1));
  const box = boxes()[0];
  expect(box.getAttribute('data-action-id')).toBe('communication-studio.export.frame.toggle');
  box.focus();
  await userEvent.keyboard(' ');
  expect(box.checked).toBe(false);
  expect(document.activeElement).toBe(box);
  await userEvent.keyboard(' ');
  expect(box.checked).toBe(true);
  await userEvent.fill(query, 'missing');
  await waitFor(() => expect(panel.queryAllByRole('checkbox')).toHaveLength(0));
  await userEvent.fill(query, '');
  await waitFor(() => expect(boxes()).toHaveLength(ydoc.pages.length));
  for (const box of boxes()) {
    box.focus();
    await userEvent.keyboard(' ');
  }
  expect(boxes().every(box => !box.checked)).toBe(true);
  const all = panel.getByRole('button', { name: 'markAllFrames' });
  expect(all.getAttribute('data-action-id')).toBe('communication-studio.export.frames.select-all');
  await activate(all);
  expect(boxes().every(box => box.checked)).toBe(true);
  const selected = panel.getByRole('button', { name: 'markSelectedFrame' }) as HTMLButtonElement;
  expect(selected.getAttribute('data-action-id')).toBe(
    'communication-studio.export.frames.select-current'
  );
  expect(selected.disabled).toBe(true);
  for (const box of boxes()) {
    box.focus();
    await userEvent.keyboard(' ');
  }
  expect(boxes().every(box => !box.checked)).toBe(true);
  await act(async () => {
    io.canvasProps.selectExact([ydoc.pages[1].id]);
  });
  expect(selected.disabled).toBe(false);
  await activate(selected);
  expect(boxes().filter(box => box.checked)).toHaveLength(1);
  expect(
    (panel.getByRole('checkbox', { name: 'Native export frame 2' }) as HTMLInputElement).checked
  ).toBe(true);
  expect(document.activeElement).toBe(selected);
});

it('inserts keyboard-selected table dimensions into the Studio document and returns focus to its toolbar', async () => {
  await mount();
  const before = io.editor.v3Value.nodes.filter((node: any) => node.type === 'table').length;
  const opened = await menu('table');
  const picker = opened.menu.getByRole('button', { name: 'tableSize: 0 x 0' });
  picker.focus();
  expect(document.activeElement).toBe(picker);
  await userEvent.keyboard('{Enter}');
  expect(io.editor.v3Value.nodes.filter((node: any) => node.type === 'table')).toHaveLength(before);
  await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowDown}{Enter}');
  await waitFor(() =>
    expect(io.editor.v3Value.nodes.filter((node: any) => node.type === 'table')).toHaveLength(
      before + 1
    )
  );
  const table = io.editor.v3Value.nodes.find((node: any) => node.type === 'table');
  expect(table.data.rows).toHaveLength(2);
  expect(table.data.rows.every((row: any) => row.cells.length === 3)).toBe(true);
  expect(io.canvasProps.selected).toEqual([table.id]);
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'table' }))
  );
});
