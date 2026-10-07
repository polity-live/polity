import { io, notifyAll, show, useCanonicalDocument, ydoc } from './StudioWorkspace.fixture';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { element } from '../../logic/document';
import {
  createStudioV3ClipboardPayload,
  stringifyStudioClipboard,
} from '../../logic/studio-clipboard';
import type { StudioDocumentV3, StudioNode, StudioPlateElement } from '../../logic/document-v3';
import { applyStudioCommandV3 } from '../../logic/commands-v3';
import { StudioInlineTextEditor } from '../StudioInlineTextEditor';
import { StudioWorkspace } from '../StudioWorkspace';
import { openStudioPanel } from '../../logic/panel-events';
import { createElementSetSnapshot } from '../../logic/element-library';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) =>
      key === 'features.studio.pixelUnit' ? 'px' : key.replace('features.studio.', ''),
  }),
}));

async function mount() {
  useCanonicalDocument();
  const view = await show();
  await screen.findByTestId('canvas', {}, { timeout: 10000 });
  return view;
}
function canonical(): StudioDocumentV3 {
  return io.editor.v3Value;
}
function node(id: string): StudioNode {
  const result = canonical().nodes.find(candidate => candidate.id === id);
  if (!result) throw new Error(`Missing node ${id}`);
  return result;
}
function frame() {
  return canonical().nodes.find(candidate => candidate.type === 'frame')!;
}
async function select(id: string) {
  await act(() => io.canvasProps.selectExact([id]));
  await waitFor(() => expect(io.canvasProps.selected).toEqual([id]));
}
async function activate(control: HTMLElement) {
  control.focus();
  await userEvent.keyboard('{Enter}');
}
async function menu(label: string) {
  const trigger = screen
    .getAllByRole('button', { name: label })
    .find(button => button.getAttribute('aria-haspopup') === 'menu');
  if (!trigger) throw Error(`Missing menu ${label}`);
  await activate(trigger);
  return within(await screen.findByRole('menu'));
}

it.each(['frame', 'text', 'draw', 'laser', 'rectangle', 'arrow', 'ellipse'] as const)(
  'persists the real canvas %s creation event as a validated canonical node with local geometry',
  async tool => {
    await mount();
    const parent = frame();
    const start = { x: parent.transform.x + 60, y: parent.transform.y + 70 };
    const end = { x: start.x - 20, y: start.y + 30 };
    let id = '';
    await act(() => {
      id = io.canvasProps.onCreateNode(tool, start, end, true, [
        [start.x, start.y],
        [end.x, end.y],
      ]);
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const created = node(id);
    expect(created.parentFrameId).toBe(tool === 'frame' ? null : parent.id);
    expect(created.transform).toMatchObject({
      x: tool === 'frame' ? start.x - 20 : 40,
      y: tool === 'frame' ? start.y : 70,
      rotation: 0,
    });
    if (tool === 'frame') {
      expect(created.transform).toMatchObject({ width: 200, height: 200 });
    } else if (tool === 'text') {
      expect(created.type).toBe('richText');
      expect(created.transform).toMatchObject({ width: 700, height: 180 });
      if (created.type === 'richText')
        expect(created.content[0].children[0]).toMatchObject({ text: '' });
    } else if (tool === 'draw' || tool === 'laser') {
      expect(created).toMatchObject({
        type: 'drawing',
        tool: tool === 'laser' ? 'laser' : 'pen',
        points: [
          [20, 0],
          [0, 30],
        ],
      });
    } else {
      expect(created).toMatchObject({
        type: 'shape',
        shape: tool === 'rectangle' ? 'rounded-rectangle' : tool,
        endArrowhead: tool === 'arrow' ? 'arrow' : 'none',
      });
    }
    expect(created.style).toMatchObject({ cornerRadius: tool === 'frame' ? 0 : 24, opacity: 1 });
  }
);

it('creates unrounded shapes outside frames and refuses late creation after access is revoked', async () => {
  await mount();
  let id = '';
  await act(() => {
    id = io.canvasProps.onCreateNode(
      'rectangle',
      { x: -400, y: -400 },
      { x: -420, y: -450 },
      false
    );
  });
  expect(node(id)).toMatchObject({
    parentFrameId: null,
    type: 'shape',
    shape: 'rectangle',
    style: { cornerRadius: 0 },
  });
  const before = structuredClone(canonical());
  await act(() => {
    io.editor.canEdit = false;
    notifyAll();
  });
  expect(io.canvasProps.onCreateNode('text', { x: 0, y: 0 }, { x: 30, y: 30 }, false)).toBeNull();
  expect(canonical()).toEqual(before);
});

it('persists nested rich text and empty text while ignoring delayed edits for deleted and non-text nodes', async () => {
  await mount();
  const text = canonical().nodes.find(candidate => candidate.type === 'richText')!;
  const content: StudioPlateElement[] = [
    {
      id: crypto.randomUUID(),
      type: 'p',
      children: [
        { id: crypto.randomUUID(), text: 'Before ' },
        {
          id: crypto.randomUUID(),
          type: 'a',
          url: 'https://example.org',
          children: [{ id: crypto.randomUUID(), text: 'link' }],
        },
        { id: crypto.randomUUID(), text: ' after' },
      ],
    },
  ];
  await act(() => io.canvasProps.onTextChange(text.id, content));
  expect(node(text.id)).toMatchObject({ content });
  const empty: StudioPlateElement[] = [
    { id: crypto.randomUUID(), type: 'p', children: [{ id: crypto.randomUUID(), text: '' }] },
  ];
  await act(() => io.canvasProps.onTextChange(text.id, empty));
  expect(node(text.id)).toMatchObject({ name: 'Text', content: empty });
  const onChange = io.canvasProps.onTextChange;
  await act(() => io.canvasProps.onDeleteNodes([text.id]));
  const before = structuredClone(canonical());
  await act(() => {
    onChange(text.id, content);
    onChange(frame().id, content);
    io.canvasProps.onDeleteNodes([]);
    io.canvasProps.applyCanvasChanges([]);
  });
  expect(canonical()).toEqual(before);
});

it('moves frames and their children once, applies real resize constraints, and ignores locked or deleted drag targets', async () => {
  await mount();
  const root = frame();
  const text = canonical().nodes.find(candidate => candidate.type === 'richText')!;
  const original = structuredClone(text.transform);
  const shape = canonical().nodes.find(candidate => candidate.type === 'shape')!;
  await act(() =>
    io.editor.transactV3((document: StudioDocumentV3) => {
      document.nodes.find(candidate => candidate.id === shape.id)!.locked = true;
    })
  );
  await act(() =>
    io.canvasProps.applyCanvasChanges([
      {
        nodeId: root.id,
        transform: {
          dx: 30,
          dy: 40,
          width: root.transform.width + 100,
          height: root.transform.height + 100,
          rotation: 0,
        },
      },
      { nodeId: text.id, transform: { dx: 30, dy: 40, width: 1, height: 1, rotation: 45 } },
      { nodeId: shape.id, transform: { dx: 500, dy: 500, width: 1, height: 1, rotation: 0 } },
      {
        nodeId: crypto.randomUUID(),
        transform: { dx: 1, dy: 1, width: 1, height: 1, rotation: 0 },
      },
    ])
  );
  expect(node(root.id).transform).toMatchObject({
    x: root.transform.x + 30,
    y: root.transform.y + 40,
    width: root.transform.width + 100,
    height: root.transform.height + 100,
  });
  expect(node(text.id).transform).toEqual(original);
  expect(node(shape.id).transform).toEqual(shape.transform);
  await act(() =>
    io.canvasProps.applyCanvasChanges([
      {
        nodeId: text.id,
        transform: {
          dx: -20,
          dy: 15,
          width: 4,
          height: 4,
          rotation: 15,
          flipX: true,
          flipY: false,
        },
      },
    ])
  );
  expect(node(text.id).transform).toMatchObject({
    x: original.x - 20,
    y: original.y + 15,
    width: 4,
    height: 4,
    rotation: 15,
    flipX: true,
    flipY: false,
  });
});

it('clears frame theme bindings only for changed paint fields and removes an override when paint is reset', async () => {
  await mount();
  const id = frame().id;
  await act(() =>
    io.editor.transactV3((document: StudioDocumentV3) => {
      const target = document.nodes.find(candidate => candidate.id === id)!;
      target.style.fillBinding = 'primary';
      target.style.strokeBinding = 'foreground';
      if (target.type === 'frame') target.overrides = ['style.fill'];
    })
  );
  await act(() => io.canvasProps.applyCanvasChanges([{ nodeId: id, style: { fill: '#123456' } }]));
  expect(node(id).style).toMatchObject({
    fill: '#123456',
    fillBinding: null,
    strokeBinding: 'foreground',
  });
  await act(() =>
    io.canvasProps.applyCanvasChanges([{ nodeId: id, style: { fill: null, stroke: '#654321' } }])
  );
  expect(node(id)).toMatchObject({
    style: { fill: null, stroke: '#654321', strokeBinding: null },
    overrides: ['style.stroke'],
  });
});

it.each(['readable', 'denied'] as const)(
  'copies, pastes and cuts through %s browser clipboard access using real project serialization',
  async access => {
    await mount();
    const text = canonical().nodes.find(candidate => candidate.type === 'richText')!;
    await select(text.id);
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    if (access === 'denied') write.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    else write.mockResolvedValue(undefined);
    await act(() => io.canvasProps.onClipboard('copy'));
    expect(write).toHaveBeenCalledOnce();
    const read = vi.spyOn(navigator.clipboard, 'readText');
    if (access === 'denied') read.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    else read.mockResolvedValue(write.mock.calls[0][0]);
    const previous = canonical().nodes.length;
    await act(() => io.canvasProps.onClipboard('paste'));
    expect(canonical().nodes).toHaveLength(previous + 1);
    const pastedId = io.canvasProps.selected[0];
    expect(pastedId).not.toBe(text.id);
    expect(node(pastedId)).toMatchObject({ type: 'richText' });
    await act(() => io.canvasProps.onClipboard('cut'));
    expect(canonical().nodes.some(candidate => candidate.id === pastedId)).toBe(false);
    expect(io.canvasProps.selected).toEqual([]);
    const before = structuredClone(canonical());
    await act(() => io.canvasProps.onClipboard('copy'));
    expect(canonical()).toEqual(before);
  }
);

it('rejects a foreign project clipboard payload without changing the document or its selection', async () => {
  await mount();
  const text = canonical().nodes.find(candidate => candidate.type === 'richText')!;
  await select(text.id);
  const before = structuredClone(canonical());
  const payload = createStudioV3ClipboardPayload({
    projectId: 'another-project',
    selectedNodeIds: [text.id],
    document: canonical(),
  });
  if (!payload) throw Error('Missing clipboard fixture');
  vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue(stringifyStudioClipboard(payload));
  await expect(io.canvasProps.onClipboard('paste')).rejects.toThrow(
    'Studio clipboard belongs to another project'
  );
  expect(canonical()).toEqual(before);
  expect(io.canvasProps.selected).toEqual([text.id]);
});

it('preserves native text focus on pointer formatting controls and persists all text marks', async () => {
  await mount();
  const text = canonical().nodes.find(candidate => candidate.type === 'richText')!;
  await select(text.id);
  const input = within(screen.getByRole('region', { name: 'properties' })).getByRole('textbox', {
    name: 'text',
  });
  await userEvent.click(input);
  const controls = [
    ...document.querySelectorAll<HTMLElement>(
      '[data-action-id="communication-studio.text.toolbar.toggle-mark"], [data-action-id="communication-studio.text.mark-code.apply"], [data-action-id="communication-studio.text.mark-highlight.apply"]'
    ),
  ];
  expect(controls).toHaveLength(6);
  for (const control of controls) {
    expect(fireEvent.mouseDown(control)).toBe(false);
    expect(document.activeElement).toBe(input);
    await userEvent.click(control);
  }
  const changed = node(text.id);
  if (changed.type !== 'richText') throw Error('Expected text');
  expect(changed.content[0].children[0]).toMatchObject({
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
    code: true,
    highlight: true,
  });
});

it('keeps retry and both conflict-resolution failures visible without an unhandled rejection', async () => {
  useCanonicalDocument();
  io.editor.status = 'error';
  io.editor.error = 'Connection failed';
  io.editor.retry = vi.fn().mockRejectedValue(new Error('Retry failed'));
  io.editor.conflicts = [
    { path: ['title'], base: 'Original', local: 'Local title', remote: 'Remote title' },
  ];
  io.editor.resolveConflicts = vi.fn().mockRejectedValue(new Error('Conflict save failed'));
  await show();
  await screen.findByTestId('canvas', {}, { timeout: 10000 });
  await activate(screen.getByRole('button', { name: 'retry' }));
  await activate(screen.getByRole('button', { name: 'keepRemote' }));
  await activate(screen.getByRole('button', { name: 'keepLocal' }));
  expect(io.editor.retry).toHaveBeenCalledOnce();
  expect(io.editor.resolveConflicts.mock.calls).toEqual([[false], [true]]);
  expect(screen.getByText('Connection failed')).toBeTruthy();
  expect(screen.getByText('title')).toBeTruthy();
});

it('changes video animation and mute state through native inspector controls', async () => {
  const video = element('video', { assetId: crypto.randomUUID() });
  ydoc.pages[0].elements.push(video);
  await mount();
  await select(video.id);
  const inspector = within(screen.getByRole('region', { name: 'properties' }));
  const animation = inspector.getByRole('combobox', { name: 'animation' }) as HTMLSelectElement;
  animation.focus();
  await userEvent.keyboard('{End}{Enter}');
  expect(node(video.id).animation).toBe('fade');
  const mute = inspector.getByRole('checkbox', { name: 'muted' });
  const original = node(video.id);
  if (original.type !== 'media') throw Error('Expected media');
  await userEvent.click(mute);
  expect(node(video.id)).toMatchObject({ muted: !original.muted });
});

it('edits table cells through the native inspector and writes the resulting canonical table', async () => {
  const table = element('table');
  ydoc.pages[0].elements.push(table);
  await mount();
  await select(table.id);
  const inspector = within(screen.getByRole('region', { name: 'properties' }));
  await userEvent.fill(inspector.getByRole('textbox', { name: 'cell 1, 1' }), 'Native cell edit');
  const changed = node(table.id);
  if (changed.type !== 'table') throw Error('Expected table');
  expect(changed.data.rows[0].cells[0].text).toBe('Native cell edit');
  expect(changed.data.rows.length).toBe(table.table?.rows.length);
});

it.each(['missing', 'available'] as const)(
  'opens and closes the image editor only with an %s asset URL',
  async availability => {
    const assetId = crypto.randomUUID();
    const image = element('image', { assetId });
    ydoc.pages[0].elements.push(image);
    if (availability === 'available')
      io.editor.assets = [{ id: assetId, url: 'https://example.org/image.png', mime: 'image/png' }];
    await mount();
    await select(image.id);
    await activate(
      within(screen.getByRole('region', { name: 'properties' })).getByRole('button', {
        name: 'editImage',
      })
    );
    if (availability === 'missing') {
      expect(screen.queryByRole('button', { name: 'Close image' })).toBeNull();
      return;
    }
    await activate(screen.getByRole('button', { name: 'Keep image open' }));
    expect(screen.getByRole('button', { name: 'Close image' })).toBeTruthy();
    await activate(screen.getByRole('button', { name: 'Close image' }));
    expect(screen.queryByRole('button', { name: 'Close image' })).toBeNull();
  }
);

it('activates every drawing tool and zoom action through native keyboard menu selection', async () => {
  await mount();
  for (const [label, action, tool] of [
    ['frame', 'freeFrame', 'frame'],
    ['shapes', 'rectangle', 'rectangle'],
    ['shapes', 'ellipse', 'ellipse'],
    ['shapes', 'diamond', 'diamond'],
    ['shapes', 'roundedRectangle', 'rectangle'],
    ['line', 'arrow', 'arrow'],
    ['line', 'line', 'line'],
    ['draw', 'draw', 'draw'],
    ['draw', 'eraser', 'eraser'],
    ['draw', 'laser', 'laser'],
  ]) {
    const popup = await menu(label);
    await activate(popup.getByRole('menuitem', { name: action }));
    expect(io.canvasExecute).toHaveBeenLastCalledWith({
      type: 'setTool',
      tool,
      locked: false,
      ...(action === 'roundedRectangle' ? { rounded: true } : {}),
    });
  }
  for (const [action, mode] of [
    ['+', 'in'],
    ['−', 'out'],
    ['100 %', 'reset'],
    ['fitSelection', 'selection'],
    ['fitAll', 'all'],
  ]) {
    const popup = await menu('zoom 100%');
    await activate(popup.getByRole('menuitem', { name: action }));
    expect(io.canvasExecute).toHaveBeenLastCalledWith({ type: 'zoom', mode });
  }
});

it('formats the actual selected Plate editor text through Studio marks, alignment, lists, links and theme style actions', async () => {
  await mount();
  const text = canonical().nodes.find(candidate => candidate.type === 'richText')!;
  if (text.type !== 'richText') throw Error('Expected text');
  await select(text.id);
  const content: StudioPlateElement[] = [
    { id: crypto.randomUUID(), type: 'p', children: [{ id: crypto.randomUUID(), text: 'Alpha' }] },
  ];
  await act(() => io.canvasProps.onTextChange(text.id, content));
  const editor = render(
    <StudioInlineTextEditor
      node={node(text.id) as typeof text}
      register={io.canvasProps.registerTextEditor}
      onChange={content => io.canvasProps.onTextChange(text.id, content)}
    />
  );
  const editable = within(editor.container).getByRole('textbox');
  await userEvent.click(editable);
  await userEvent.keyboard('{Home}{Shift>}{End}{/Shift}');
  await waitFor(() => expect(window.getSelection()?.toString()).toBe('Alpha'));
  const bold = document.querySelector<HTMLElement>(
    '[data-action-id="communication-studio.text.toolbar.toggle-mark"]'
  )!;
  await userEvent.click(bold);
  await waitFor(() =>
    expect(node(text.id)).toMatchObject({
      content: [{ children: [{ text: 'Alpha', bold: true }] }],
    })
  );
  const alignment = await menu('alignment');
  await activate(alignment.getByRole('menuitemradio', { name: 'center' }));
  await waitFor(() => expect(node(text.id)).toMatchObject({ content: [{ align: 'center' }] }));
  for (const [action, list] of [
    ['bulletList', 'bullet'],
    ['numberedList', 'number'],
  ]) {
    const popup = await menu('text');
    await activate(popup.getByRole('menuitem', { name: action }));
    await waitFor(() => expect(node(text.id)).toMatchObject({ content: [{ list }] }));
  }
  const popup = await menu('text');
  await activate(popup.getByRole('menuitem', { name: 'link' }));
  await userEvent.fill(
    screen.getByRole('textbox', { name: 'link' }),
    'https://example.org/selected-text'
  );
  await userEvent.keyboard('{Enter}');
  await waitFor(() =>
    expect(node(text.id)).toMatchObject({
      content: [{ url: 'https://example.org/selected-text' }],
    })
  );
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
        Open selected text style
      </button>
    </nav>
  );
  await activate(screen.getByRole('button', { name: 'Open selected text style' }));
  const style = canonical().theme.textStyles[0];
  const button = screen.getByRole('button', {
    name: new RegExp(`^${style.name}\\s*${style.size}px$`),
  });
  await activate(button);
  await waitFor(() =>
    expect(node(text.id)).toMatchObject({
      content: [
        { align: style.align, children: [{ textStyleId: style.id, fontSize: style.size }] },
      ],
    })
  );
  editor.unmount();
});

it('reorders a complete group through actual canvas context buttons and preserves text focus on its formatting action', async () => {
  io.renderContextToolbar = true;
  await mount();
  const members = canonical()
    .nodes.filter(candidate => candidate.type !== 'frame')
    .slice(0, 2);
  const groupId = crypto.randomUUID();
  await act(() =>
    io.editor.transactV3((document: StudioDocumentV3) =>
      Object.assign(
        document,
        applyStudioCommandV3(document, {
          type: 'groupNodes',
          nodeIds: members.map(member => member.id),
          groupId,
          depth: 0,
        })
      )
    )
  );
  await act(() => io.canvasProps.selectExact(members.map(member => member.id)));
  const context = within(screen.getByRole('region', { name: 'elementActions' }));
  for (const action of ['front', 'forward', 'backward', 'back'])
    await activate(context.getByRole('button', { name: action }));
  expect(
    canonical()
      .nodes.filter(candidate => members.some(member => member.id === candidate.id))
      .every(candidate => candidate.groupIds[0] === groupId)
  ).toBe(true);
  const grouping = await menu('groupElements');
  await activate(grouping.getByRole('menuitem', { name: 'ungroup' }));
  expect(
    canonical()
      .nodes.filter(candidate => members.some(member => member.id === candidate.id))
      .every(candidate => candidate.groupIds.length === 0)
  ).toBe(true);
  const text = canonical().nodes.find(candidate => candidate.type === 'richText')!;
  await select(text.id);
  const input = within(screen.getByRole('region', { name: 'properties' })).getByRole('textbox', {
    name: 'text',
  });
  input.focus();
  const bold = within(screen.getByRole('region', { name: 'elementActions' })).getByRole('button', {
    name: 'bold',
  });
  expect(fireEvent.mouseDown(bold)).toBe(false);
  expect(document.activeElement).toBe(input);
});

it('resets the previous project selection when the existing editor switches project identity', async () => {
  const view = await mount();
  const text = canonical().nodes.find(candidate => candidate.type === 'richText')!;
  await select(text.id);
  view.rerender(<StudioWorkspace projectId="another-project" groupId="group" open={vi.fn()} />);
  await waitFor(() => expect(io.canvasProps.selected).toEqual([]));
});

it('commits full-source and partial media crops and ignores locked, removed and cancelled crop targets', async () => {
  const media = element('image', { assetId: crypto.randomUUID() });
  ydoc.pages[0].elements.push(media);
  await mount();
  const original = node(media.id);
  const full = { x: 0, y: 0, width: 100, height: 100, naturalWidth: 100, naturalHeight: 100 };
  await act(() =>
    io.canvasProps.onCropCommit(media.id, {
      frame: original.transform,
      crop: full,
      fit: 'contain',
      focus: { x: 0.5, y: 0.5 },
    })
  );
  expect(node(media.id)).toMatchObject({ crop: null, fit: 'contain' });
  for (const crop of [
    { ...full, y: 10, height: 90 },
    { ...full, width: 90 },
    { ...full, height: 90 },
  ]) {
    await act(() =>
      io.canvasProps.onCropCommit(media.id, {
        frame: original.transform,
        crop,
        fit: 'cover',
        focus: { x: 0.2, y: 0.8 },
      })
    );
    expect(node(media.id)).toMatchObject({ crop, focus: { x: 0.2, y: 0.8 } });
  }
  await act(() =>
    io.canvasProps.applyCanvasChanges([
      {
        nodeId: media.id,
        transform: {
          dx: 5,
          dy: 5,
          width: 200,
          height: 200,
          rotation: 0,
          flipX: false,
          flipY: false,
          crop: null,
        },
      },
    ])
  );
  expect(node(media.id)).toMatchObject({ crop: null, transform: { width: 200, height: 200 } });
  await act(() =>
    io.editor.transactV3((document: StudioDocumentV3) => {
      document.nodes.find(candidate => candidate.id === media.id)!.locked = true;
    })
  );
  const before = structuredClone(canonical());
  await act(() => {
    io.canvasProps.onCropCommit(media.id, {
      frame: original.transform,
      crop: full,
      fit: 'cover',
      focus: { x: 0, y: 0 },
    });
    io.canvasProps.onCropCommit(crypto.randomUUID(), null);
    io.canvasProps.onCropCommit(frame().id, {
      frame: original.transform,
      crop: full,
      fit: 'cover',
      focus: { x: 0, y: 0 },
    });
  });
  expect(canonical()).toEqual(before);
});

it.each(['saved', 'failed'] as const)(
  'saves a canvas drag to the real Elements navigation drop target with a %s response',
  async outcome => {
    io.request.mockImplementation(async (op: string) => {
      if (op === 'elementSetCreate' && outcome === 'failed') throw Error('Element save denied');
      return [];
    });
    const view = await mount();
    const text = canonical().nodes.find(candidate => candidate.type === 'richText')!;
    render(
      <nav
        data-navigation-type="secondary"
        style={{ position: 'fixed', right: 0, top: 50, width: 60, height: 500 }}
      >
        <button data-navigation-item-id="studio-elements" style={{ width: 60, height: 60 }}>
          Elements drop target
        </button>
      </nav>
    );
    const target = screen.getByRole('button', { name: 'Elements drop target' });
    const box = target.getBoundingClientRect();
    const x = box.left + 20,
      y = box.top + 20;
    await act(() => io.canvasProps.onNodeDragMove(text.id, [text.id], x, y));
    expect(target.getAttribute('data-studio-drop-active')).toBe('true');
    expect(io.canvasProps.onNodeDragEnd(text.id, [text.id], x, y)).toBe(true);
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith(
        'elementSetCreate',
        expect.objectContaining({ projectId: 'project', selectedIds: [text.id] })
      )
    );
    expect(target.hasAttribute('data-studio-drop-active')).toBe(false);
    if (outcome === 'failed') await screen.findByText('Element save denied');
    else await screen.findByText('saveSelectionToElements');
    await act(() => io.canvasProps.onNodeDragMove(text.id, [text.id], x, y));
    view.unmount();
    expect(target.hasAttribute('data-studio-drop-active')).toBe(false);
  }
);

it('ignores unavailable and out-of-bounds element drag targets and instantiates only an available library set', async () => {
  useCanonicalDocument();
  const source = canonical().nodes.find(candidate => candidate.type === 'richText')!;
  const setId = crypto.randomUUID(),
    revision = crypto.randomUUID();
  const snapshot = createElementSetSnapshot(canonical(), [source.id]);
  const item = {
    id: setId,
    name: 'Available set',
    scope: 'group',
    revisionId: revision,
    version: 1,
    width: snapshot.width,
    height: snapshot.height,
    updatedAt: 0,
  };
  io.request.mockImplementation(async (op: string) =>
    op === 'elementSets'
      ? [item]
      : op === 'elementSetInstantiate'
        ? { setId, revisionId: revision, snapshot, assetIds: {} }
        : []
  );
  await show();
  await screen.findByTestId('canvas', {}, { timeout: 10000 });
  await waitFor(() => expect(io.request).toHaveBeenCalledWith('elementSets', { groupId: 'group' }));
  render(
    <button
      data-studio-elements-drop-zone
      style={{ position: 'fixed', right: 0, top: 0, width: 60, height: 60 }}
    >
      Library target
    </button>
  );
  const target = screen.getByRole('button', { name: 'Library target' });
  await act(() => io.canvasProps.onNodeDragMove(source.id, [source.id], -100, -100));
  expect(target.hasAttribute('data-studio-drop-active')).toBe(false);
  expect(io.canvasProps.onNodeDragEnd(source.id, [frame().id], 10, 10)).toBe(false);
  await act(() => io.canvasProps.onElementSetDrop(crypto.randomUUID(), { x: 100, y: 100 }));
  expect(io.request.mock.calls.filter(([op]) => op === 'elementSetInstantiate')).toHaveLength(0);
  await act(() =>
    io.canvasProps.onElementSetDrop(setId, { x: 100, y: 100, targetFrameId: frame().id })
  );
  await waitFor(() =>
    expect(canonical().componentInstances.some(instance => instance.setId === setId)).toBe(true)
  );
  const before = structuredClone(canonical());
  await act(() => {
    io.editor.canEdit = false;
    notifyAll();
  });
  await act(() => io.canvasProps.onElementSetDrop(setId, { x: 200, y: 200 }));
  expect(canonical()).toEqual(before);
});

it('routes native canvas keyboard duplicate, history, formatting, movement and deletion commands while guarding unrelated editing controls', async () => {
  await mount();
  const text = canonical().nodes.find(candidate => candidate.type === 'richText')!;
  await select(text.id);
  const canvas = screen.getByTestId('canvas');
  canvas.tabIndex = 0;
  canvas.focus();
  expect(document.activeElement).toBe(canvas);
  const keys: KeyboardEvent[] = [];
  const capture = (event: KeyboardEvent) => keys.push(event);
  window.addEventListener('keydown', capture);
  const before = canonical().nodes.length;
  await userEvent.keyboard('{Control>}d{/Control}');
  window.removeEventListener('keydown', capture);
  expect(
    keys.map(event => ({ key: event.key, ctrl: event.ctrlKey, target: event.target === canvas }))
  ).toContainEqual({ key: 'd', ctrl: true, target: true });
  expect(canonical().nodes.length).toBe(before + 1);
  for (const key of ['b', 'i', 'u']) await userEvent.keyboard(`{Control>}${key}{/Control}`);
  expect(node(text.id)).toMatchObject({
    content: [{ children: [{ bold: true, italic: true, underline: true }] }],
  });
  await userEvent.keyboard('{Control>}z{/Control}');
  expect(io.editor.undo).toHaveBeenCalledOnce();
  await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
  expect(io.editor.redo).toHaveBeenCalledOnce();
  const original = node(text.id).transform;
  await userEvent.keyboard('{ArrowDown}{Shift>}{ArrowLeft}{/Shift}');
  expect(node(text.id).transform).toMatchObject({ x: original.x - 10, y: original.y + 1 });
  await userEvent.keyboard('{Delete}');
  expect(canonical().nodes.some(candidate => candidate.id === text.id)).toBe(false);
  const unchanged = structuredClone(canonical());
  await userEvent.keyboard('{Escape}{Control>}b{/Control}{ArrowUp}{Delete}');
  expect(canonical()).toEqual(unchanged);
});
