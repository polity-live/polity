import {
  io,
  notifyAll,
  show,
  value,
  ydoc,
  useCanonicalDocument,
  setup,
} from './StudioWorkspace.fixture';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { element } from '../../logic/document';
import { openStudioPanel } from '../../logic/panel-events';
import { applyStudioCommandV3 } from '../../logic/commands-v3';
import { createStudioV3ClipboardPayload } from '../../logic/studio-clipboard';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { StudioWorkspace } from '../StudioWorkspace';

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
  const triggers = screen
    .getAllByRole('button', { name })
    .filter(button => button.getAttribute('aria-haspopup') === 'menu');
  expect(triggers).toHaveLength(1);
  const trigger = triggers[0];
  await activate(trigger);
  return { trigger, menu: within(await screen.findByRole('menu')) };
}

async function editorRouter(
  groupId: string | null = 'group',
  loader: () => Promise<void> = async () => undefined,
  initial = '/editor'
) {
  io.realLinks = true;
  useCanonicalDocument();
  const root = createRootRoute({ component: Outlet });
  const editor = createRoute({
    getParentRoute: () => root,
    path: '/editor',
    component: () => <StudioWorkspace projectId="project" groupId={groupId} open={vi.fn()} />,
  });
  const destinations = [
    '/studio',
    '/group/$id/studio',
    '/group/$id/settings',
    '/studio/$projectId',
  ].map(path =>
    createRoute({
      getParentRoute: () => root,
      path,
      loader,
      pendingMs: 0,
      pendingMinMs: 0,
      pendingComponent: () => <p role="status">Loading destination</p>,
      errorComponent: () => <p role="alert">Destination access failed</p>,
      component: () => <p>Studio destination opened</p>,
    })
  );
  const router = createRouter({
    routeTree: root.addChildren([editor, ...destinations]),
    history: createMemoryHistory({ initialEntries: [initial] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  if (initial === '/editor') await screen.findByTestId('canvas', {}, { timeout: 10000 });
  return router;
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

it('selects alignment references and applies all six directions through native menus with retained toolbar focus', async () => {
  await mount();
  const empty = await menu('elementAlignment');
  for (const name of ['frame', 'view'])
    expect(empty.menu.getByRole('menuitemradio', { name }).hasAttribute('data-disabled')).toBe(
      true
    );
  expect(empty.menu.getByRole('menuitem', { name: 'left' }).hasAttribute('data-disabled')).toBe(
    true
  );
  await userEvent.keyboard('{Escape}');
  const id = await selectText();
  for (const name of ['frame', 'view', 'selection', 'view']) {
    const opened = await menu('elementAlignment');
    const chosen = opened.menu.getByRole('menuitemradio', { name });
    expect(chosen.getAttribute('data-action-id')).toBe(
      'communication-studio.arrangement.reference.select'
    );
    expect(chosen.getAttribute('aria-checked')).toBe('false');
    await activate(chosen);
    await waitFor(() => expect(document.activeElement).toBe(opened.trigger));
    const verify = await menu('elementAlignment');
    expect(verify.menu.getByRole('menuitemradio', { name }).getAttribute('aria-checked')).toBe(
      'true'
    );
    await userEvent.keyboard('{Escape}');
  }
  for (const direction of ['left', 'center', 'right', 'top', 'middle', 'bottom']) {
    const opened = await menu('elementAlignment');
    const command = opened.menu.getByRole('menuitem', { name: direction });
    expect(command.getAttribute('data-action-id')).toBe(
      'communication-studio.selection.align.apply'
    );
    await activate(command);
    const node = current(id);
    if (direction === 'left') expect(node.x).toBeCloseTo(100);
    if (direction === 'center') expect(node.x + node.width / 2).toBeCloseTo(500);
    if (direction === 'right') expect(node.x + node.width).toBeCloseTo(900);
    if (direction === 'top') expect(node.y).toBeCloseTo(200);
    if (direction === 'middle') expect(node.y + node.height / 2).toBeCloseTo(600);
    if (direction === 'bottom') expect(node.y + node.height).toBeCloseTo(1000);
    await waitFor(() => expect(document.activeElement).toBe(opened.trigger));
  }
});

it('distributes actual selected nodes on both axes with native menu focus and disables insufficient selections', async () => {
  ydoc.pages[0].elements = [
    element('rect', { x: 20, y: 30, width: 50, height: 50 }),
    element('rect', { x: 150, y: 140, width: 50, height: 50 }),
    element('rect', { x: 500, y: 500, width: 50, height: 50 }),
  ];
  await mount();
  let opened = await menu('distribute');
  for (const axis of ['horizontal', 'vertical'])
    expect(
      opened.menu
        .getByRole('menuitem', { name: `distribute ${axis}` })
        .hasAttribute('data-disabled')
    ).toBe(true);
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
  for (const axis of ['horizontal', 'vertical'] as const) {
    opened = await menu('distribute');
    const item = opened.menu.getByRole('menuitem', { name: `distribute ${axis}` });
    expect(item.getAttribute('data-action-id')).toBe(
      `communication-studio.selection.distribute.${axis}`
    );
    await activate(item);
    const positions = value()
      .pages[0].elements.map(node => (axis === 'horizontal' ? node.x : node.y))
      .sort((a, b) => a - b);
    expect(positions[1] - positions[0]).toBeCloseTo(positions[2] - positions[1]);
    await waitFor(() => expect(document.activeElement).toBe(opened.trigger));
  }
});

it('reorders and groups canonical nodes through native menus while preserving selection and focus', async () => {
  await mount();
  let opened = await menu('order');
  for (const name of ['front', 'back', 'forward', 'backward'])
    expect(opened.menu.getByRole('menuitem', { name }).hasAttribute('data-disabled')).toBe(true);
  await userEvent.keyboard('{Escape}');
  opened = await menu('groupElements');
  for (const name of ['groupElements', 'ungroup'])
    expect(opened.menu.getByRole('menuitem', { name }).hasAttribute('data-disabled')).toBe(true);
  await userEvent.keyboard('{Escape}');
  const id = await selectText();
  const siblings = () =>
    io.editor.v3Value.nodes
      .filter(
        (node: any) =>
          node.parentFrameId ===
          io.editor.v3Value.nodes.find((item: any) => item.id === id).parentFrameId
      )
      .sort((a: any, b: any) => a.zIndex - b.zIndex);
  for (const [action, expected] of [
    ['back', 0],
    ['forward', 1],
    ['backward', 0],
    ['front', siblings().length - 1],
  ] as const) {
    opened = await menu('order');
    const item = opened.menu.getByRole('menuitem', { name: action });
    expect(item.getAttribute('data-action-id')).toBe('communication-studio.selection.order.apply');
    await activate(item);
    expect(siblings().findIndex((node: any) => node.id === id)).toBe(expected);
    await waitFor(() => expect(document.activeElement).toBe(opened.trigger));
  }
  await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
  const selected = [...io.canvasProps.selected];
  opened = await menu('groupElements');
  const group = opened.menu.getByRole('menuitem', { name: 'groupElements' });
  expect(group.getAttribute('data-action-id')).toBe('communication-studio.selection.group.toggle');
  await activate(group);
  const members = () => io.editor.v3Value.nodes.filter((node: any) => selected.includes(node.id));
  expect(members().every((node: any) => node.groupIds.length === 1)).toBe(true);
  expect(new Set(members().map((node: any) => node.groupIds[0])).size).toBe(1);
  await waitFor(() => expect(document.activeElement).toBe(opened.trigger));
  opened = await menu('groupElements');
  await activate(opened.menu.getByRole('menuitem', { name: 'ungroup' }));
  expect(members().every((node: any) => node.groupIds.length === 0)).toBe(true);
  expect(io.canvasProps.selected).toEqual(selected);
  await waitFor(() => expect(document.activeElement).toBe(opened.trigger));
});

it('applies both native text list actions and submits only an HTTP link from its focused popover', async () => {
  await mount();
  const id = await selectText();
  for (const [name, list, action] of [
    ['bulletList', 'bullet', 'bullet'],
    ['numberedList', 'number', 'numbered'],
  ] as const) {
    const opened = await menu('text');
    const item = opened.menu.getByRole('menuitem', { name });
    expect(item.getAttribute('data-action-id')).toBe(`communication-studio.text.list.${action}`);
    await activate(item);
    expect(current(id).richText.every(paragraph => paragraph.list === list)).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(opened.trigger));
  }
  const opened = await menu('text');
  const link = opened.menu.getByRole('menuitem', { name: 'link' });
  expect(link.getAttribute('data-action-id')).toBe('communication-studio.text.link.open');
  await activate(link);
  const input = await screen.findByRole('textbox', { name: 'link' });
  expect(input.getAttribute('data-action-id')).toBe('communication-studio.text.link.edit');
  await userEvent.fill(input, 'javascript:alert(1)');
  expect(document.activeElement).toBe(input);
  await userEvent.keyboard('{Enter}');
  expect(screen.getByRole('textbox', { name: 'link' })).toBe(input);
  expect(current(id).richText.every(paragraph => paragraph.children.every(run => !run.url))).toBe(
    true
  );
  await userEvent.fill(input, 'https://example.org/native-studio');
  expect(document.activeElement).toBe(input);
  await userEvent.keyboard('{Enter}');
  expect(screen.queryByRole('textbox', { name: 'link' })).toBeNull();
  expect(
    current(id).richText.every(paragraph =>
      paragraph.children.every(run => run.url === 'https://example.org/native-studio')
    )
  ).toBe(true);
});

it('selects themes and both appearance modes with native focus then applies a text style and disables all theme editing after permission revocation', async () => {
  await mount();
  const id = await selectText();
  render(
    <nav
      data-navigation-type="secondary"
      style={{ position: 'fixed', right: 0, top: 50, width: 48, height: 500 }}
    >
      <button
        data-navigation-item-id="theme"
        onClick={() =>
          openStudioPanel({
            panelKey: 'theme',
            origin: 'secondary-navigation',
            navigationItemId: 'theme',
          })
        }
      >
        Open theme panel
      </button>
    </nav>
  );
  await activate(screen.getByRole('button', { name: 'Open theme panel' }));
  const select = (await screen.findByRole('combobox', { name: 'theme' })) as HTMLSelectElement;
  expect(select.getAttribute('data-action-id')).toBe(
    'communication-studio.theme.definition.select'
  );
  const first = select.options[0].value;
  const last = select.options[select.options.length - 1].value;
  await selectOption(select, last);
  expect(io.editor.v3Value.theme.themeId).toBe(last);
  await selectOption(select, first);
  expect(io.editor.v3Value.theme.themeId).toBe(first);
  for (const mode of ['dark', 'light'] as const) {
    const button = screen.getByRole('button', { name: mode });
    expect(button.getAttribute('data-action-id')).toBe(
      'communication-studio.theme.appearance-mode.select'
    );
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await activate(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(io.editor.v3Value.theme.mode).toBe(mode);
    expect(document.activeElement).toBe(button);
  }
  const style = io.editor.v3Value.theme.textStyles[0];
  const styleButton = screen.getByRole('button', {
    name: new RegExp(`^${style.name}\\s*${style.size}px$`),
  }) as HTMLButtonElement;
  expect(styleButton.getAttribute('data-action-id')).toBe(
    'communication-studio.theme.text-style.apply'
  );
  expect(styleButton.disabled).toBe(false);
  await activate(styleButton);
  const node = io.editor.v3Value.nodes.find((node: any) => node.id === id);
  expect(node.typography.textStyleId).toBe(style.id);
  expect(node.typography.fontSize).toBe(style.size);
  expect(
    node.content.every((paragraph: any) =>
      paragraph.children.every(
        (run: any) => run.textStyleId === style.id && run.fontSize === style.size
      )
    )
  ).toBe(true);
  expect(document.activeElement).toBe(styleButton);
  const before = structuredClone(io.editor.v3Value);
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  expect(select.disabled).toBe(true);
  for (const mode of ['dark', 'light'])
    expect((screen.getByRole('button', { name: mode }) as HTMLButtonElement).disabled).toBe(true);
  expect(styleButton.disabled).toBe(true);
  await userEvent.keyboard(' ');
  expect(io.editor.v3Value).toEqual(before);
});

async function emptyFixture() {
  useCanonicalDocument();
  const projectId = `empty-${crypto.randomUUID()}`;
  const original = structuredClone(io.editor.v3Value);
  const frame = original.nodes.find((node: any) => node.type === 'frame');
  const payload = createStudioV3ClipboardPayload({
    projectId,
    selectedNodeIds: [frame.id],
    document: original,
  });
  if (!payload) throw new Error('Missing frame clipboard fixture');
  io.editor.transactV3((document: typeof original) =>
    Object.assign(
      document,
      applyStudioCommandV3(document, { type: 'deleteNodes', nodeIds: [frame.id] })
    )
  );
  io.editor.canUndo = true;
  await show({ projectId, groupId: null, open: vi.fn() });
  expect(screen.getByRole('status').textContent).toBe('The canvas is empty.');
  return { projectId, payload };
}

it.each(['actor', 'procedure'] as const)(
  'disables empty-canvas history and clipboard actions when %s editing rights are absent',
  async reason => {
    if (reason === 'actor') io.editor.canEdit = false;
    else io.procedureEditingAllowed = false;
    await emptyFixture();
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Paste' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    const before = structuredClone(io.editor.v3Value);
    await userEvent.keyboard('{Control>}z{/Control}{Control>}v{/Control}');
    expect(io.editor.undo).not.toHaveBeenCalled();
    expect(io.editor.v3Value).toEqual(before);
  }
);

it('activates empty-canvas undo through native focus and disables it when no history remains', async () => {
  await emptyFixture();
  const undo = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
  expect(undo.getAttribute('data-action-id')).toBe(
    'communication-studio.empty-canvas.history.undo'
  );
  expect(undo.disabled).toBe(false);
  await activate(undo);
  expect(io.editor.undo).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(undo);
  await act(async () => {
    io.editor.canUndo = false;
    notifyAll();
  });
  expect(undo.disabled).toBe(true);
});

it('pastes an actual frame and deliverable once from a pending browser clipboard read while retaining keyboard focus', async () => {
  const { payload } = await emptyFixture();
  let resolve: (value: string) => void = () => {
    throw new Error('Missing clipboard read');
  };
  const read = vi.spyOn(navigator.clipboard, 'readText').mockReturnValueOnce(
    new Promise<string>(done => {
      resolve = done;
    })
  );
  const paste = screen.getByRole('button', { name: 'Paste' });
  expect(paste.getAttribute('data-action-id')).toBe(
    'communication-studio.empty-canvas.clipboard.paste'
  );
  await activate(paste);
  expect(paste.getAttribute('aria-busy')).toBe('true');
  expect(paste.getAttribute('aria-disabled')).toBe('true');
  expect(document.activeElement).toBe(paste);
  await userEvent.keyboard('{Enter}{Control>}v{/Control}');
  expect(read).toHaveBeenCalledOnce();
  await act(async () => resolve(JSON.stringify(payload)));
  await screen.findByTestId('canvas', {}, { timeout: 10000 });
  const restored = io.editor.v3Value;
  expect(restored.nodes).toHaveLength(payload.nodes.length);
  const frame = restored.nodes.find((node: any) => node.type === 'frame');
  expect(frame.id).not.toBe(payload.rootNodeIds[0]);
  expect(restored.deliverables[0]).toMatchObject({
    ...payload.deliverables[0].deliverable,
    frameIds: [frame.id],
  });
  expect(io.canvasProps.selected).toContain(frame.id);
});

it('keeps empty-canvas paste available after denied clipboard access and a foreign project then accepts a native keyboard retry', async () => {
  const { payload } = await emptyFixture();
  const read = vi
    .spyOn(navigator.clipboard, 'readText')
    .mockRejectedValueOnce(new Error('Clipboard permission denied'))
    .mockResolvedValueOnce(JSON.stringify({ ...payload, projectId: 'another-project' }))
    .mockResolvedValueOnce(JSON.stringify(payload));
  const paste = screen.getByRole('button', { name: 'Paste' }) as HTMLButtonElement;
  await activate(paste);
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe('The Studio clipboard is empty.')
  );
  expect(paste.disabled).toBe(false);
  expect(document.activeElement).toBe(paste);
  await userEvent.keyboard('{Enter}');
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe(
      'Elements can only be pasted within the same Studio project.'
    )
  );
  expect(io.editor.v3Value.nodes).toHaveLength(0);
  expect(paste.getAttribute('aria-busy')).toBe('false');
  await userEvent.keyboard('{Enter}');
  await screen.findByTestId('canvas', {}, { timeout: 10000 });
  expect(read).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(io.editor.v3Value.nodes).toHaveLength(payload.nodes.length);
});

function librarySet(name: string) {
  return {
    id: crypto.randomUUID(),
    name,
    scope: 'group',
    revisionId: crypto.randomUUID(),
    version: 2,
    width: 120,
    height: 80,
    updatedAt: Date.now(),
  };
}

async function elementsPanel() {
  render(
    <nav
      data-navigation-type="secondary"
      style={{ position: 'fixed', right: 0, top: 50, width: 48, height: 500 }}
    >
      <button
        data-navigation-item-id="studio-elements"
        onClick={() =>
          openStudioPanel({
            panelKey: 'elements',
            origin: 'secondary-navigation',
            navigationItemId: 'studio-elements',
          })
        }
      >
        Open elements panel
      </button>
    </nav>
  );
  await activate(screen.getByRole('button', { name: 'Open elements panel' }));
  return within(await screen.findByRole('dialog', { name: 'elements' }));
}

it('filters real Elements rows case-insensitively with native search keyboard focus and shows empty results', async () => {
  const set = librarySet('Native element');
  io.request.mockImplementation(async (op: string) => (op === 'elementSets' ? [set] : []));
  await mount();
  const panel = await elementsPanel();
  const search = panel.getByRole('searchbox', { name: 'searchElements' });
  expect(search.getAttribute('data-action-id')).toBe(
    'communication-studio.elements.library.search'
  );
  expect(panel.getByText(set.name)).toBeTruthy();
  await userEvent.fill(search, ' missing ');
  await waitFor(() => expect(panel.queryByText(set.name)).toBeNull());
  expect(panel.getByText('noElementsFound')).toBeTruthy();
  expect(document.activeElement).toBe(search);
  await userEvent.fill(search, ' NATIVE ');
  await waitFor(() => expect(panel.getByText(set.name)).toBeTruthy());
  expect(document.activeElement).toBe(search);
  await userEvent.keyboard('{Control>}a{/Control}{Backspace}');
  await waitFor(() => expect((search as HTMLInputElement).value).toBe(''));
  expect(panel.getByText(set.name)).toBeTruthy();
});

it('saves selected canonical elements through the native library button and disables missing selection and revoked rights', async () => {
  const commit = vi.spyOn(io.editor, 'commit');
  let complete: () => void = () => {
    throw new Error('Missing save request');
  };
  io.request.mockImplementation(async (op: string) => {
    if (op === 'elementSetCreate')
      await new Promise<void>(resolve => {
        complete = resolve;
      });
    return [];
  });
  await mount();
  const emptyPanel = await elementsPanel();
  expect(
    (emptyPanel.getByRole('button', { name: 'saveSelectionToElements' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  await userEvent.keyboard('{Escape}');
  const id = await selectText();
  await activate(screen.getByRole('button', { name: 'Open elements panel' }));
  const panel = within(await screen.findByRole('dialog', { name: 'elements' }));
  const save = panel.getByRole('button', { name: 'saveSelectionToElements' }) as HTMLButtonElement;
  expect(save.getAttribute('data-action-id')).toBe('communication-studio.elements.selection.save');
  expect(save.disabled).toBe(false);
  await activate(save);
  await waitFor(() =>
    expect(io.request).toHaveBeenCalledWith('elementSetCreate', {
      projectId: 'project',
      groupId: 'group',
      selectedIds: [id],
    })
  );
  expect(commit).toHaveBeenCalledOnce();
  expect(save.disabled).toBe(true);
  await userEvent.keyboard('{Enter}');
  expect(io.request.mock.calls.filter(([op]) => op === 'elementSetCreate')).toHaveLength(1);
  await act(async () => complete());
  await waitFor(() => expect(save.disabled).toBe(false));
  await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  expect(save.disabled).toBe(true);
  const calls = io.request.mock.calls.filter(([op]) => op === 'elementSetCreate').length;
  await userEvent.keyboard(' ');
  expect(io.request.mock.calls.filter(([op]) => op === 'elementSetCreate')).toHaveLength(calls);
});

it('renames a library set from its natively focused action while rejecting cancelled and whitespace prompts and disabling revoked rights', async () => {
  const set = librarySet('Original element');
  io.request.mockImplementation(async (op: string, payload: any) => {
    if (op === 'elementSetRename') set.name = payload.name;
    return op === 'elementSets' ? [set] : [];
  });
  const prompt = vi
    .spyOn(window, 'prompt')
    .mockReturnValueOnce(null)
    .mockReturnValueOnce('   ')
    .mockReturnValueOnce('Renamed native element');
  await mount();
  const panel = await elementsPanel();
  const rename = panel.getByRole('button', { name: `rename: ${set.name}` }) as HTMLButtonElement;
  expect(rename.getAttribute('data-action-id')).toBe('communication-studio.elements.set.rename');
  await activate(rename);
  expect(document.activeElement).toBe(rename);
  await userEvent.keyboard(' ');
  expect(prompt).toHaveBeenCalledTimes(2);
  expect(io.request.mock.calls.some(([op]) => op === 'elementSetRename')).toBe(false);
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(panel.getByText('Renamed native element')).toBeTruthy());
  expect(io.request).toHaveBeenCalledWith('elementSetRename', {
    setId: set.id,
    name: 'Renamed native element',
  });
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  expect(rename.disabled).toBe(true);
});

it('archives a set through native keyboard activation and keeps its row available for retry after an API failure', async () => {
  const set = librarySet('Archived element');
  let archived = false;
  let attempts = 0;
  io.request.mockImplementation(async (op: string) => {
    if (op === 'elementSetArchive') {
      attempts += 1;
      if (attempts === 1) throw new Error('Archive temporarily unavailable');
      archived = true;
    }
    return op === 'elementSets' && !archived ? [set] : [];
  });
  await mount();
  const panel = await elementsPanel();
  const archive = panel.getByRole('button', { name: `delete: ${set.name}` }) as HTMLButtonElement;
  expect(archive.getAttribute('data-action-id')).toBe('communication-studio.elements.set.archive');
  await activate(archive);
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Archive temporarily unavailable')
  );
  expect(panel.getByText(set.name)).toBeTruthy();
  expect(archive.disabled).toBe(false);
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  expect(archive.disabled).toBe(true);
  await act(async () => {
    io.editor.canEdit = true;
    notifyAll();
  });
  await activate(archive);
  await waitFor(() => expect(panel.queryByText(set.name)).toBeNull());
  expect(panel.getByText('noElements')).toBeTruthy();
  expect(attempts).toBe(2);
  expect(io.request).toHaveBeenCalledWith('elementSetArchive', { setId: set.id });
});

it('publishes the selected linked instance from its native library action and clears local edits only after successful retry', async () => {
  const commit = vi.spyOn(io.editor, 'commit');
  await mount();
  const id = await selectText();
  const sourceId = crypto.randomUUID();
  const instance = {
    id: crypto.randomUUID(),
    setId: crypto.randomUUID(),
    revisionId: crypto.randomUUID(),
    sourceToInstance: { [sourceId]: id },
    localOverrides: { [id]: ['transform.x'] },
    localDeletions: [crypto.randomUUID()],
    detachedNodes: [],
  };
  await act(async () =>
    io.editor.transactV3((document: any) => document.componentInstances.push(instance))
  );
  const revisionId = crypto.randomUUID();
  let attempts = 0;
  io.request.mockImplementation(async (op: string) => {
    if (op === 'elementSetPublish') {
      if (++attempts === 1) throw new Error('Publish temporarily unavailable');
      return { revisionId };
    }
    return [];
  });
  const panel = await elementsPanel();
  const publish = panel.getByRole('button', { name: 'publishElementChanges' }) as HTMLButtonElement;
  expect(publish.getAttribute('data-action-id')).toBe(
    'communication-studio.elements.instance.publish'
  );
  await activate(publish);
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Publish temporarily unavailable')
  );
  expect(io.editor.v3Value.componentInstances[0]).toEqual(instance);
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  expect(publish.disabled).toBe(true);
  await act(async () => {
    io.editor.canEdit = true;
    notifyAll();
  });
  await activate(publish);
  await waitFor(() => expect(io.editor.v3Value.componentInstances[0].revisionId).toBe(revisionId));
  expect(io.editor.v3Value.componentInstances[0].localOverrides).toEqual({});
  expect(io.editor.v3Value.componentInstances[0].localDeletions).toEqual([]);
  expect(commit).toHaveBeenCalledTimes(2);
  expect(io.request).toHaveBeenCalledWith('elementSetPublish', {
    projectId: 'project',
    instanceId: instance.id,
  });
});

it('saves the project template through its native menu and keeps retry and read-only states visible', async () => {
  const commit = vi.spyOn(io.editor, 'commit');
  let attempts = 0;
  io.request.mockImplementation(async (op: string) => {
    if (op === 'template' && ++attempts === 1) throw new Error('Template temporarily unavailable');
    return [];
  });
  await mount();
  let opened = await menu('project');
  const save = opened.menu.getByRole('menuitem', { name: 'saveTemplate' });
  expect(save.getAttribute('data-action-id')).toBe('communication-studio.project.template.save');
  await activate(save);
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Template temporarily unavailable')
  );
  await waitFor(() => expect(document.activeElement).toBe(opened.trigger));
  opened = await menu('project');
  await activate(opened.menu.getByRole('menuitem', { name: 'saveTemplate' }));
  await waitFor(() => expect(attempts).toBe(2));
  expect(io.request).toHaveBeenCalledWith('template', { id: 'project', value: true });
  expect(commit).toHaveBeenCalledTimes(2);
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  opened = await menu('project');
  expect(
    opened.menu.getByRole('menuitem', { name: 'saveTemplate' }).hasAttribute('data-disabled')
  ).toBe(true);
  await userEvent.keyboard('{Escape}');
  expect(document.activeElement).toBe(opened.trigger);
});

it('opens the actual clone dialog from the native project menu and submits the confirmed revision before navigating', async () => {
  io.realClone = true;
  const commit = vi.spyOn(io.editor, 'commit');
  io.request.mockImplementation(async (op: string) =>
    op === 'duplicate' ? { id: 'cloned-project' } : []
  );
  const router = await editorRouter();
  const opened = await menu('project');
  const item = opened.menu.getByRole('menuitem', { name: 'duplicateProject' });
  expect(item.getAttribute('data-action-id')).toBe('communication-studio.project.clone.open');
  await activate(item);
  const dialog = await screen.findByRole('dialog', { name: 'cloneProject' });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  await activate(within(dialog).getByRole('button', { name: 'cloneProject' }));
  await screen.findByText('Studio destination opened');
  expect(router.state.location.pathname).toBe('/studio/cloned-project');
  expect(commit).toHaveBeenCalledOnce();
  expect(io.request).toHaveBeenCalledWith('duplicate', {
    id: 'project',
    groupId: null,
    visibility: 'private',
  });
  expect(screen.queryByRole('dialog', { name: 'cloneProject' })).toBeNull();
});

it('opens the actual visibility dialog through the native project menu and retains its failed update for keyboard retry', async () => {
  let attempts = 0;
  io.request.mockImplementation(async (op: string) => {
    if (op === 'visibility' && ++attempts === 1)
      throw new Error('Visibility temporarily unavailable');
    return [];
  });
  await mount();
  const opened = await menu('project');
  const item = opened.menu.getByRole('menuitem', { name: 'pages.create.common.visibility' });
  expect(item.getAttribute('data-action-id')).toBe('communication-studio.project.visibility.open');
  await activate(item);
  const dialog = await screen.findByRole('dialog', { name: 'pages.create.common.visibility' });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  const submit = within(dialog).getByRole('button', { name: 'common.actions.save' });
  await activate(submit);
  await waitFor(() =>
    expect(within(dialog).getByRole('alert').textContent).toBe('Visibility temporarily unavailable')
  );
  await activate(submit);
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'pages.create.common.visibility' })).toBeNull()
  );
  expect(io.request).toHaveBeenCalledWith('visibility', { id: 'project', visibility: 'private' });
  expect(attempts).toBe(2);
});

it('opens the actual preview from its focused native toolbar button and disables preview when every frame is hidden', async () => {
  io.realPreview = true;
  await mount();
  const preview = screen.getByRole('button', { name: 'preview' }) as HTMLButtonElement;
  expect(preview.getAttribute('data-action-id')).toBe('communication-studio.preview.open');
  await activate(preview);
  const dialog = await screen.findByRole('dialog', { name: 'previewTitle' });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'previewTitle' })).toBeNull());
  expect(document.activeElement).toBe(preview);
  await act(async () =>
    io.editor.transactV3((document: any) =>
      document.nodes.forEach((node: any) => {
        if (node.type === 'frame') node.visible = false;
      })
    )
  );
  expect(
    (
      document.querySelector(
        '[data-action-id="communication-studio.preview.open"]'
      ) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  expect(
    screen.getByRole('button', { name: 'noVisibleFrames' }).getAttribute('aria-disabled')
  ).toBe('true');
});

it('opens shared collaboration tools from native comments activation and restores the comments button after Escape', async () => {
  await mount();
  const comments = screen.getByRole('button', { name: 'comments' });
  expect(comments.getAttribute('data-action-id')).toBe(
    'communication-studio.collaboration.comments.open'
  );
  await activate(comments);
  const dialog = await screen.findByRole('dialog', { name: 'collaboration' });
  expect(within(dialog).getByRole('region', { name: 'Shared procedure tools' })).toBeTruthy();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(document.activeElement).toBe(comments));
  expect(screen.queryByRole('dialog', { name: 'collaboration' })).toBeNull();
});

it('opens sharing through the native header button with the correct group link and restores focus after dismissal', async () => {
  await mount();
  const share = screen.getByRole('button', { name: 'Share' });
  expect(share.getAttribute('data-action-id')).toBe('editor.shell.share.open');
  await activate(share);
  const menu = await screen.findByRole('menu');
  expect((within(menu).getByRole('textbox') as HTMLInputElement).value).toBe(
    window.location.origin + '/group/group/studio/project'
  );
  expect(within(menu).getAllByRole('menuitem')).toHaveLength(8);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(document.activeElement).toBe(share));
  expect(screen.queryByRole('menu')).toBeNull();
});

it('opens the native upload chooser once from the toolbar and uploads a real file while disabling busy and revoked rights', async () => {
  await mount();
  const upload = screen.getByRole('button', { name: 'upload' }) as HTMLButtonElement;
  const input = document.querySelector<HTMLInputElement>(
    'input[type="file"][aria-label="upload"]'
  )!;
  const chooser = vi.spyOn(input, 'click');
  expect(upload.getAttribute('data-action-id')).toBe('communication-studio.assets.upload.open');
  await activate(upload);
  expect(chooser).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(upload);
  const file = new File(['native-image'], 'native.png', { type: 'image/png' });
  const assetId = crypto.randomUUID();
  let complete: (asset: { id: string; mime: string }) => void = () => {
    throw new Error('Missing upload');
  };
  io.upload.mockReturnValueOnce(
    new Promise(resolve => {
      complete = resolve;
    })
  );
  await page.elementLocator(input).upload(file);
  await waitFor(() => expect(io.upload).toHaveBeenCalledOnce());
  expect(io.upload.mock.calls[0][0]).toBe('project');
  expect(io.upload.mock.calls[0][1].name).toBe('native.png');
  await waitFor(() =>
    expect(
      (
        document.querySelector(
          '[data-action-id="communication-studio.assets.upload.open"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  );
  expect(input.value).toBe('');
  await act(async () => complete({ id: assetId, mime: 'image/png' }));
  await waitFor(() =>
    expect(
      (
        document.querySelector(
          '[data-action-id="communication-studio.assets.upload.open"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
  expect(
    io.editor.v3Value.nodes.some((node: any) => node.type === 'media' && node.assetId === assetId)
  ).toBe(true);
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  expect(
    (
      document.querySelector(
        '[data-action-id="communication-studio.assets.upload.open"]'
      ) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  expect(input.disabled).toBe(true);
});

it('toggles actual text marks from the native canvas context actions and exposes image availability through its disabled action', async () => {
  io.renderContextToolbar = true;
  const assetId = crypto.randomUUID();
  const image = element('image', { assetId });
  ydoc.pages[0].elements.push(image);
  await mount();
  const id = await selectText();
  let context = within(screen.getByRole('region', { name: 'elementActions' }));
  for (const mark of ['bold', 'italic', 'underline'] as const) {
    const original = current(id)[mark];
    const control = context.getByRole('button', { name: mark });
    expect(control.getAttribute('data-action-id')).toBe(
      'communication-studio.context.action.activate'
    );
    expect(control.getAttribute('data-context-action')).toBe(mark);
    await activate(control);
    expect(current(id)[mark]).toBe(!original);
    expect(control.getAttribute('aria-pressed')).toBe(String(!original));
    expect(document.activeElement).toBe(control);
    await userEvent.keyboard(' ');
    expect(current(id)[mark]).toBe(original);
  }
  await userEvent.click(screen.getByRole('button', { name: `Select image ${image.id}` }));
  context = within(screen.getByRole('region', { name: 'elementActions' }));
  expect((context.getByRole('button', { name: 'editImage' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  await activate(context.getByRole('button', { name: 'resizeImage' }));
  expect(io.canvasExecute).toHaveBeenCalledWith({ type: 'crop', action: 'start' });
  await act(async () => {
    io.editor.canEdit = false;
    notifyAll();
  });
  expect(screen.queryByRole('region', { name: 'elementActions' })).toBeNull();
});

it.each([null, 'group'])(
  'navigates to the %s project list through a focused native link while exposing the destination loading state',
  async groupId => {
    let finish: () => void = () => {
      throw new Error('Missing destination loader');
    };
    const loader = vi.fn(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        })
    );
    const router = await editorRouter(groupId, loader);
    const link = screen.getByRole('link', { name: 'projects' });
    const path = groupId ? '/group/group/studio' : '/studio';
    expect(link.getAttribute('data-action-id')).toBe('communication-studio.project.list.navigate');
    expect(link.getAttribute('href')).toBe(path);
    await activate(link);
    await screen.findByRole('status', { name: '' });
    expect(screen.getByRole('status').textContent).toBe('Loading destination');
    expect(loader).toHaveBeenCalledOnce();
    await act(async () => finish());
    await screen.findByText('Studio destination opened');
    expect(router.state.location.pathname).toBe(path);
  }
);

it.each([null, 'group'])(
  'shows a destination access failure after native %s project-list navigation',
  async groupId => {
    const router = await editorRouter(groupId, async () => {
      throw new Error('Access denied');
    });
    await activate(screen.getByRole('link', { name: 'projects' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toBe('Destination access failed');
    expect(router.state.location.pathname).toBe(groupId ? '/group/group/studio' : '/studio');
  }
);

it.each(['/studio', '/group/group/studio', '/group/group/settings?tab=themes'])(
  'resolves the direct Studio destination deep link %s through the actual router',
  async initial => {
    const router = await editorRouter('group', async () => undefined, initial);
    expect(screen.getByText('Studio destination opened')).toBeTruthy();
    expect(router.state.location.pathname + router.state.location.searchStr).toBe(initial);
  }
);

it('opens group theme settings from its focused native link with the correct query while exposing destination loading and access errors', async () => {
  let finish: () => void = () => {
    throw new Error('Missing settings loader');
  };
  let reject = false;
  const router = await editorRouter('group', async () => {
    if (reject) throw new Error('Theme management denied');
    await new Promise<void>(resolve => {
      finish = resolve;
    });
  });
  render(
    <nav
      data-navigation-type="secondary"
      style={{ position: 'fixed', right: 0, top: 50, width: 48, height: 500 }}
    >
      <button
        data-navigation-item-id="theme"
        onClick={() =>
          openStudioPanel({
            panelKey: 'theme',
            origin: 'secondary-navigation',
            navigationItemId: 'theme',
          })
        }
      >
        Open theme settings panel
      </button>
    </nav>
  );
  await activate(screen.getByRole('button', { name: 'Open theme settings panel' }));
  const link = screen.getByRole('link', { name: 'editThemes' });
  expect(link.getAttribute('data-action-id')).toBe('communication-studio.theme.settings.navigate');
  expect(link.getAttribute('href')).toBe('/group/group/settings?tab=themes');
  await activate(link);
  await screen.findByText('Loading destination');
  await act(async () => finish());
  await screen.findByText('Studio destination opened');
  expect(router.state.location.pathname).toBe('/group/group/settings');
  expect(router.state.location.search).toEqual({ tab: 'themes' });
  reject = true;
  await act(async () => {
    await router.navigate({ to: '/editor' as never });
  });
  await screen.findByTestId('canvas', {}, { timeout: 10000 });
  await activate(screen.getByRole('button', { name: 'Open theme settings panel' }));
  await activate(screen.getByRole('link', { name: 'editThemes' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toBe('Destination access failed');
});
