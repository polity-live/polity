/* @vitest-environment jsdom */
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFrameNode,
  createStudioDocumentV3,
  drawingNodeSchema,
  embedNodeSchema,
  mediaNodeSchema,
} from '../../logic/document-v3';
import { StudioLayersPanel } from '../StudioLayersPanel';
import { createStudioNodeFromElement } from '../../logic/create-studio-node';
import { element } from '../../logic/document';

afterEach(cleanup);

afterEach(() => vi.useRealTimers());

function setup() {
  const document = createStudioDocumentV3('Campaign');
  document.nodes.push(
    createFrameNode('square', { name: 'First' }),
    createFrameNode('square', { name: 'Second', zIndex: 1 })
  );
  const props = {
    document,
    selectedNodeIds: [] as string[],
    disabled: false,
    tr: (key: string) => key,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onSetVisibility: vi.fn(),
    onSetLocked: vi.fn(),
    onMove: vi.fn(),
  };
  const view = render(<StudioLayersPanel {...props} />);
  return { props, ...view };
}

const nameInput = () =>
  screen.getByRole('textbox', { name: 'layerName: First' }) as HTMLInputElement;
const start = () => fireEvent.click(screen.getByRole('button', { name: 'rename: First' }));

describe('Studio layer renaming', () => {
  it('selects the layer, focuses and selects its name, and commits once on Enter plus blur', () => {
    const { props } = setup();
    fireEvent.doubleClick(screen.getByRole('button', { name: 'First' }));
    const input = nameInput();
    expect(props.onSelect).toHaveBeenCalledWith(
      props.document.nodes[0],
      props.document.nodes[0].id
    );
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5]);
    expect(input.closest('[role="treeitem"]')?.getAttribute('draggable')).toBe('false');
    fireEvent.change(input, { target: { value: '  Renamed frame  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(props.onRename.mock.calls).toEqual([[props.document.nodes[0].id, 'Renamed frame']]);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'rename: First' }));
  });

  it('commits on blur and allows an existing layer name', () => {
    const { props } = setup();
    start();
    fireEvent.change(nameInput(), { target: { value: 'Second' } });
    fireEvent.blur(nameInput());
    expect(props.onRename).toHaveBeenCalledWith(props.document.nodes[0].id, 'Second');
  });

  it.each(['Escape', 'unchanged', 'empty-blur'])(
    'does not commit %s and restores the name button',
    reason => {
      const { props } = setup();
      start();
      const input = nameInput();
      fireEvent.change(input, {
        target: {
          value: reason === 'unchanged' ? ' First ' : reason === 'Escape' ? 'Discard' : '   ',
        },
      });
      if (reason === 'empty-blur') fireEvent.blur(input);
      else fireEvent.keyDown(input, { key: reason === 'Escape' ? 'Escape' : 'Enter' });
      expect(props.onRename).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.getByRole('button', { name: 'First' })).toBeTruthy();
    }
  );

  it('shows an accessible validation error and accepts a corrected name', () => {
    const { props } = setup();
    start();
    fireEvent.change(nameInput(), { target: { value: '   ' } });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe('layerNameRequired');
    expect(nameInput().getAttribute('aria-invalid')).toBe('true');
    expect(nameInput().getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect(props.onRename).not.toHaveBeenCalled();
    fireEvent.change(nameInput(), { target: { value: 'Valid' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith(props.document.nodes[0].id, 'Valid');
  });

  it.each([200, 201])('enforces the name limit for %i characters', length => {
    const { props } = setup();
    start();
    expect(nameInput().maxLength).toBe(200);
    fireEvent.change(nameInput(), { target: { value: 'x'.repeat(length) } });
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledTimes(length === 200 ? 1 : 0);
    if (length === 201) expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('ignores Enter during IME composition', () => {
    const { props } = setup();
    start();
    fireEvent.change(nameInput(), { target: { value: '新しい名前' } });
    fireEvent.keyDown(nameInput(), { key: 'Enter', isComposing: true });
    expect(props.onRename).not.toHaveBeenCalled();
    expect(nameInput()).toBeTruthy();
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledOnce();
  });

  it('keeps only one editor when switching layers', () => {
    const { props } = setup();
    start();
    fireEvent.change(nameInput(), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'rename: Second' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'layerName: Second' })).toBe(document.activeElement);
    expect(props.onRename).toHaveBeenCalledWith(props.document.nodes[0].id, 'Updated');
  });

  it.each(['locked', 'read-only'])('prevents renaming a %s layer', mode => {
    const { props, rerender } = setup();
    const next = structuredClone(props.document);
    next.nodes[0].locked = mode === 'locked';
    rerender(<StudioLayersPanel {...props} document={next} disabled={mode === 'read-only'} />);
    expect(
      (screen.getByRole('button', { name: 'rename: First' }) as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.doubleClick(screen.getByRole('button', { name: 'First' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it.each(['deleted', 'locked', 'read-only', 'renamed'])(
    'discards the draft when the layer is %s during editing',
    mode => {
      const { props, rerender } = setup();
      start();
      const input = nameInput();
      fireEvent.change(input, { target: { value: 'Local draft' } });
      const next = structuredClone(props.document);
      if (mode === 'deleted') next.nodes.shift();
      if (mode === 'locked') next.nodes[0].locked = true;
      if (mode === 'renamed') next.nodes[0].name = 'Remote name';
      rerender(<StudioLayersPanel {...props} document={next} disabled={mode === 'read-only'} />);
      fireEvent.blur(input);
      expect(props.onRename).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).toBeNull();
      if (mode === 'renamed') {
        expect(screen.getByRole('status').textContent).toBe('layerRenamedElsewhere');
        expect(screen.getByRole('button', { name: 'Remote name' })).toBeTruthy();
      }
    }
  );

  it('retains the draft across unrelated document updates and preserves row actions', () => {
    const { props, rerender } = setup();
    start();
    fireEvent.change(nameInput(), { target: { value: 'New name' } });
    const next = structuredClone(props.document);
    next.nodes[1].name = 'Other change';
    rerender(<StudioLayersPanel {...props} document={next} />);
    expect(nameInput().value).toBe('New name');
    fireEvent.keyDown(nameInput(), { key: 'Enter' });
    next.nodes[0].name = 'New name';
    rerender(<StudioLayersPanel {...props} document={structuredClone(next)} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'New name' } });
    const row = screen.getByRole('treeitem');
    expect(row.getAttribute('data-studio-layer-id')).toBe(props.document.nodes[0].id);
    fireEvent.click(within(row).getByRole('button', { name: 'hide: New name' }));
    fireEvent.click(within(row).getByRole('button', { name: 'lock: New name' }));
    expect(props.onSetVisibility).toHaveBeenCalledWith(next.nodes[0], false);
    expect(props.onSetLocked).toHaveBeenCalledWith(next.nodes[0], true);
  });
});

it('searches layers, selects a row and clears the search with native keyboard focus', async () => {
  const user = userEvent.setup();
  const { props, rerender } = setup();
  const search = screen.getByRole<HTMLInputElement>('searchbox', { name: 'searchLayers' });
  search.focus();
  expect(document.activeElement).toBe(search);
  await user.type(search, 'second');
  expect(screen.getAllByRole('treeitem')).toHaveLength(1);
  const name = screen.getByRole<HTMLButtonElement>('button', { name: 'Second' });
  name.focus();
  await user.keyboard('{Enter}');
  expect(props.onSelect).toHaveBeenCalledExactlyOnceWith(
    props.document.nodes[1],
    props.document.nodes[1].id
  );
  expect(document.activeElement).toBe(name);
  rerender(<StudioLayersPanel {...props} selectedNodeIds={[props.document.nodes[1].id]} />);
  expect(
    screen.getByRole('treeitem', { selected: true }).getAttribute('data-studio-layer-id')
  ).toBe(props.document.nodes[1].id);
  search.focus();
  await user.clear(search);
  expect(screen.getAllByRole('treeitem')).toHaveLength(2);
  await user.type(search, 'no matching layer');
  expect(screen.queryAllByRole('treeitem')).toHaveLength(0);
  expect(screen.getByRole('status').textContent).toBe('noLayers');
});

it('renames a layer using keyboard entry, selects its old name and returns focus after committing', async () => {
  const user = userEvent.setup();
  const { props } = setup();
  const button = screen.getByRole<HTMLButtonElement>('button', { name: 'rename: First' });
  button.focus();
  await user.keyboard('{Enter}');
  const input = nameInput();
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5]);
  await user.keyboard('Keyboard frame{Enter}');
  expect(props.onRename).toHaveBeenCalledExactlyOnceWith(
    props.document.nodes[0].id,
    'Keyboard frame'
  );
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(document.activeElement).toBe(button);
});

it.each(['visibility', 'lock'] as const)(
  'toggles layer %s in both directions with keyboard and retains focus',
  async mode => {
    const user = userEvent.setup();
    const { props, rerender } = setup();
    const node = props.document.nodes[0];
    const button = screen.getByRole<HTMLButtonElement>('button', {
      name: `${mode === 'visibility' ? 'hide' : 'lock'}: First`,
    });
    const callback = mode === 'visibility' ? props.onSetVisibility : props.onSetLocked;
    button.focus();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await user.keyboard(' ');
    expect(callback).toHaveBeenCalledExactlyOnceWith(node, mode !== 'visibility');
    const next = structuredClone(props.document);
    if (mode === 'visibility') next.nodes[0].visible = false;
    else next.nodes[0].locked = true;
    rerender(<StudioLayersPanel {...props} document={next} />);
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    callback.mockClear();
    await user.keyboard('{Enter}');
    expect(callback).toHaveBeenCalledExactlyOnceWith(next.nodes[0], mode === 'visibility');
    if (mode === 'visibility') next.nodes[0].visible = true;
    else next.nodes[0].locked = false;
    rerender(<StudioLayersPanel {...props} document={structuredClone(next)} />);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(button);
  }
);

it.each(['locked', 'read-only'] as const)(
  'disables write controls for %s layers while keeping selection accessible',
  async mode => {
    const user = userEvent.setup();
    const { props, rerender } = setup();
    const next = structuredClone(props.document);
    next.nodes[0].locked = mode === 'locked';
    rerender(<StudioLayersPanel {...props} document={next} disabled={mode === 'read-only'} />);
    for (const action of ['rename', 'hide', ...(mode === 'read-only' ? ['lock'] : [])]) {
      const button = screen.getByRole<HTMLButtonElement>('button', { name: `${action}: First` });
      expect(button.disabled).toBe(true);
      await user.click(button);
    }
    expect(props.onRename).not.toHaveBeenCalled();
    expect(props.onSetVisibility).not.toHaveBeenCalled();
    expect(props.onSetLocked).not.toHaveBeenCalled();
    const select = screen.getByRole<HTMLButtonElement>('button', { name: 'First' });
    select.focus();
    await user.keyboard('{Enter}');
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith(next.nodes[0], next.nodes[0].id);
    expect(document.activeElement).toBe(select);
  }
);

function dragEvent(
  type: 'dragStart' | 'dragOver' | 'dragLeave' | 'drop' | 'dragEnd',
  row: HTMLElement,
  dataTransfer: any,
  clientY?: number,
  relatedTarget?: HTMLElement
) {
  const event = createEvent[type](row, { dataTransfer, bubbles: true, cancelable: true });
  if (clientY !== undefined) Object.defineProperty(event, 'clientY', { value: clientY });
  if (relatedTarget !== undefined)
    Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
  fireEvent(row, event);
  return event;
}

it.each(['before', 'after', 'inside'] as const)(
  'moves a layer %s using its actual drag payload and clears the drop preview',
  position => {
    const { props, rerender } = setup();
    const document = structuredClone(props.document);
    const child = createStudioNodeFromElement(element('rect'), document.nodes[0].id, 0);
    child.name = 'Child';
    document.nodes.push(child);
    rerender(<StudioLayersPanel {...props} document={document} />);
    const source = screen
      .getAllByRole('treeitem')
      .find(
        row =>
          row.getAttribute('data-studio-layer-id') ===
          (position === 'inside' ? child.id : document.nodes[0].id)
      )!;
    const target = screen
      .getAllByRole('treeitem')
      .find(row => row.getAttribute('data-studio-layer-id') === document.nodes[1].id)!;
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 100 } as DOMRect);
    let payload = '';
    const transfer = {
      setData: vi.fn((_type, value) => {
        payload = value;
      }),
      getData: vi.fn(() => payload),
      effectAllowed: '',
      dropEffect: '',
    };
    dragEvent('dragStart', source, transfer);
    expect(payload).toBe(position === 'inside' ? child.id : document.nodes[0].id);
    const y = position === 'before' ? 10 : position === 'after' ? 90 : 50;
    dragEvent('dragOver', target, transfer, y);
    dragEvent('dragOver', target, transfer, y);
    expect(target.getAttribute('data-drop-position')).toBe(position);
    dragEvent(
      'dragLeave',
      target,
      transfer,
      y,
      within(target).getByRole('button', { name: 'Second' })
    );
    expect(target.getAttribute('data-drop-position')).toBe(position);
    dragEvent('drop', target, transfer, y);
    expect(props.onMove).toHaveBeenCalledExactlyOnceWith(payload, document.nodes[1].id, position);
    expect(target.getAttribute('data-drop-position')).toBeNull();
    dragEvent('dragEnd', source, transfer);
  }
);

it('expires a remote rename notice and cancels its timer on unmount', async () => {
  vi.useFakeTimers();
  const { props, rerender, unmount } = setup();
  start();
  const next = structuredClone(props.document);
  next.nodes[0].name = 'Remote';
  rerender(<StudioLayersPanel {...props} document={next} />);
  expect(screen.getByRole('status').textContent).toBe('layerRenamedElsewhere');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(screen.queryByRole('status')).toBeNull();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('renders every semantic layer type with its corresponding icon and supports an empty document', () => {
  const { props, rerender } = setup();
  const document = structuredClone(props.document);
  const frame = document.nodes[0];
  document.nodes.push(
    ...(['text', 'image', 'video', 'table', 'chart'] as const).map((type, index) =>
      createStudioNodeFromElement(
        element(type, { assetId: crypto.randomUUID() }),
        frame.id,
        index + 1
      )
    )
  );
  document.nodes.push(
    drawingNodeSchema.parse({
      ...createFrameNode('square'),
      parentFrameId: frame.id,
      type: 'drawing',
      points: [],
    }),
    embedNodeSchema.parse({
      ...createFrameNode('square'),
      parentFrameId: frame.id,
      type: 'embed',
      provider: 'supported',
      value: 'https://example.org',
    }),
    ...(['audio', 'file'] as const).map(mediaType =>
      mediaNodeSchema.parse({
        ...createFrameNode('square'),
        parentFrameId: frame.id,
        type: 'media',
        mediaType,
        assetId: crypto.randomUUID(),
      })
    )
  );
  rerender(<StudioLayersPanel {...props} document={document} />);
  expect(screen.getAllByRole('treeitem')).toHaveLength(11);
  const frameRow = screen
    .getAllByRole('treeitem')
    .find(row => row.getAttribute('data-studio-layer-id') === frame.id)!;
  expect(frameRow.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getAllByRole('treeitem').some(row => row.getAttribute('aria-level') === '2')).toBe(
    true
  );
  rerender(<StudioLayersPanel {...props} document={createStudioDocumentV3('Empty')} />);
  expect(screen.queryAllByRole('treeitem')).toHaveLength(0);
  expect(screen.getByRole('status').textContent).toBe('noLayers');
});

it.each(['read-only', 'locked', 'editing'] as const)(
  'rejects drag starts for %s layers without providing a move payload',
  mode => {
    const { props, rerender } = setup();
    const document = structuredClone(props.document);
    document.nodes[0].locked = mode === 'locked';
    rerender(<StudioLayersPanel {...props} document={document} disabled={mode === 'read-only'} />);
    if (mode === 'editing') start();
    const row = screen
      .getAllByRole('treeitem')
      .find(item => item.getAttribute('data-studio-layer-id') === document.nodes[0].id)!;
    const transfer = { setData: vi.fn(), getData: vi.fn(() => ''), effectAllowed: '' };
    const event = dragEvent('dragStart', row, transfer);
    expect(event.defaultPrevented).toBe(true);
    expect(transfer.setData).not.toHaveBeenCalled();
    expect(row.getAttribute('draggable')).toBe('false');
    expect(props.onMove).not.toHaveBeenCalled();
  }
);

it.each([
  'read-only',
  'editing-target',
  'editing-source',
  'missing-source',
  'empty-payload',
  'self-target',
] as const)('rejects a %s drop while retaining document order', mode => {
  const { props, rerender } = setup();
  const source = props.document.nodes[0];
  const target = props.document.nodes[1];
  if (mode === 'read-only') rerender(<StudioLayersPanel {...props} disabled />);
  if (mode === 'editing-target')
    fireEvent.click(screen.getByRole('button', { name: 'rename: Second' }));
  if (mode === 'editing-source') start();
  const row = screen
    .getAllByRole('treeitem')
    .find(item => item.getAttribute('data-studio-layer-id') === target.id)!;
  const payload =
    mode === 'missing-source'
      ? crypto.randomUUID()
      : mode === 'empty-payload'
        ? ''
        : mode === 'self-target'
          ? target.id
          : source.id;
  const transfer = { getData: vi.fn(() => payload), dropEffect: '' };
  dragEvent('dragOver', row, transfer);
  expect(row.getAttribute('data-drop-position')).toBeNull();
  dragEvent('drop', row, transfer);
  expect(props.onMove).not.toHaveBeenCalled();
});

it('accepts a transferred external layer payload with unknown pointer coordinates and clears previews when leaving a target', () => {
  const { props } = setup();
  const [source, target] = props.document.nodes;
  const rows = screen.getAllByRole('treeitem');
  const row = rows.find(item => item.getAttribute('data-studio-layer-id') === target.id)!;
  const otherRow = rows.find(item => item !== row)!;
  const transfer = { getData: vi.fn(() => source.id), dropEffect: '' };
  dragEvent('dragOver', row, transfer);
  expect(row.getAttribute('data-drop-position')).toBe('after');
  dragEvent('dragLeave', otherRow, transfer);
  expect(row.getAttribute('data-drop-position')).toBe('after');
  dragEvent('dragLeave', row, transfer);
  expect(row.getAttribute('data-drop-position')).toBeNull();
  dragEvent('drop', row, transfer);
  expect(props.onMove).toHaveBeenCalledExactlyOnceWith(source.id, target.id, 'after');
});
