import { createRef, type ComponentProps } from 'react';
import Konva from 'konva';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import {
  mediaNodeSchema,
  studioDocumentV3Schema,
  type StudioDocumentV3,
} from '../../logic/document-v3';
import KonvaStudioCanvas, {
  type StudioCanvasHandle,
  type StudioCanvasState,
} from '../KonvaStudioCanvas';

async function mount(
  options: {
    document?: StudioDocumentV3;
    selected?: string[];
    editable?: boolean;
    assets?: { id: string; url: string; mime: string; name: string }[];
    context?: boolean;
    fit?: 'contain';
    canvasProps?: Partial<ComponentProps<typeof KonvaStudioCanvas>>;
  } = {}
) {
  const document = studioDocumentV3Schema.parse(
    options.document ?? createStudioTemplateDocumentV5('single', 'Canvas boundaries', defaultBrand)
  );
  const frame = document.nodes.find(node => node.type === 'frame');
  const ref = createRef<StudioCanvasHandle>();
  const select = vi.fn();
  const changes = vi.fn();
  const state: { current: StudioCanvasState | null } = { current: null };
  const canvas = (overrides: Partial<ComponentProps<typeof KonvaStudioCanvas>> = {}) => (
    <div style={{ width: 900, height: 650 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={document}
        activeFrameId={frame?.id ?? crypto.randomUUID()}
        assets={options.assets ?? []}
        selected={options.selected ?? []}
        selectExact={select}
        applyCanvasChanges={changes}
        editable={options.editable ?? true}
        guides={false}
        fit={options.fit}
        contextToolbar={options.context ? <button>Context action</button> : undefined}
        onCanvasStateChange={current => {
          state.current = current;
        }}
        {...options.canvasProps}
        {...overrides}
      />
    </div>
  );
  const view = render(canvas());
  const host = screen.getByTestId('studio-canvas');
  await waitFor(() => expect(host.querySelector('.konvajs-content canvas')).toBeTruthy());
  await waitFor(() => expect(host.getBoundingClientRect().width).toBe(900));
  await waitFor(() => expect(state.current?.viewBounds).not.toBeNull());
  const rerender = (overrides: Partial<ComponentProps<typeof KonvaStudioCanvas>>) =>
    view.rerender(canvas(overrides));
  return { document, frame, ref, select, changes, state, view, host, rerender };
}

it.each(['add', 'remove', 'update'] as const)(
  'renders and selects a selected %s proposal for a mirrored nested ghost',
  async tone => {
    const document = createStudioTemplateDocumentV5('single', 'Ghost boundaries', defaultBrand);
    const frame = document.nodes.find(node => node.type === 'frame')!;
    const shape = document.nodes.find(node => node.type === 'shape')!;
    document.nodes = [frame];
    const sourceDocument = structuredClone(document);
    const nested = structuredClone(frame);
    nested.id = crypto.randomUUID();
    nested.parentFrameId = frame.id;
    nested.clipContent = false;
    nested.transform = { ...nested.transform, x: 80, y: 80, width: 250, height: 200 };
    const ghost = structuredClone(shape);
    ghost.id = crypto.randomUUID();
    ghost.parentFrameId = nested.id;
    ghost.transform = {
      ...ghost.transform,
      x: 20,
      y: 20,
      width: 100,
      height: 80,
      flipX: true,
      flipY: true,
    };
    sourceDocument.nodes.push(nested, ghost);
    studioDocumentV3Schema.parse(sourceDocument);
    const proposalId = crypto.randomUUID();
    const annotationId = crypto.randomUUID();
    const selected = vi.fn();
    const { host } = await mount({
      document,
      canvasProps: {
        changeRequestMarkers: [
          {
            id: annotationId,
            nodeId: ghost.id,
            proposalId,
            sourceDocument,
            tone,
            label: 'Nested proposal',
            selected: true,
          },
        ],
        onChangeRequestSelect: selected,
      },
    });
    const outline = await screen.findByTestId(`studio-change-outline-${annotationId}`);
    expect(outline.getAttribute('data-change-request-selected')).toBe('true');
    expect(outline.getAttribute('data-change-request-ghost')).toBe('true');
    expect(screen.queryByTestId(`studio-change-strike-${annotationId}`) !== null).toBe(
      tone === 'remove'
    );
    const stage = Konva.stages.find(item => host.contains(item.container()))!;
    await waitFor(() =>
      expect(stage.find('Group').some(group => group.opacity() === 0.45)).toBe(true)
    );
    await userEvent.click(screen.getByRole('button', { name: 'Nested proposal' }));
    expect(selected).toHaveBeenCalledExactlyOnceWith(proposalId);
  }
);

it('renders unclipped nested frames and master contents with inherited text fonts', async () => {
  const document = createStudioTemplateDocumentV5('single', 'Unclipped frames', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const text = document.nodes.find(node => node.type === 'richText')!;
  frame.clipContent = false;
  const nested = structuredClone(frame);
  nested.id = crypto.randomUUID();
  nested.parentFrameId = frame.id;
  nested.transform = {
    ...nested.transform,
    x: 70,
    y: 70,
    width: 200,
    height: 180,
    flipX: true,
    flipY: true,
  };
  text.parentFrameId = nested.id;
  text.transform = { ...text.transform, x: 30, y: 30, width: 250, height: 80 };
  text.content = [
    {
      id: crypto.randomUUID(),
      type: 'p',
      children: [{ id: crypto.randomUUID(), text: 'Inherited font outside a frame' }],
    },
  ];
  const master = structuredClone(frame);
  master.id = crypto.randomUUID();
  const masterNested = structuredClone(nested);
  masterNested.id = crypto.randomUUID();
  masterNested.parentFrameId = master.id;
  const masterText = structuredClone(text);
  masterText.id = crypto.randomUUID();
  masterText.parentFrameId = masterNested.id;
  document.nodes = [frame, nested, text, master, masterNested, masterText];
  document.masterLayout = {
    ...document.masterLayout,
    frameId: master.id,
    placements: { [masterNested.id]: 'background' },
  };
  const { host } = await mount({ document });
  const stage = Konva.stages.find(item => host.contains(item.container()))!;
  const renderedFrame = stage.findOne<Konva.Group>(`#${nested.id}`)!;
  expect(renderedFrame.scaleX()).toBe(-1);
  expect(renderedFrame.scaleY()).toBe(-1);
  expect(renderedFrame.findOne('Shape')).toBeTruthy();
  expect(
    renderedFrame
      .getChildren()
      .filter(child => child instanceof Konva.Group)
      .every(child => child.getAttr('clipWidth') === undefined)
  ).toBe(true);
  expect(stage.find('Shape').length).toBeGreaterThanOrEqual(2);
});

it('rejects late focus after the canvas unmounts and still calculates finite scene coordinates', async () => {
  const { frame, ref, view } = await mount();
  const handle = ref.current!;
  view.unmount();
  expect(ref.current).toBeNull();
  await expect(handle.execute({ type: 'focus', nodeId: frame!.id })).rejects.toThrow(
    'Canvas unavailable'
  );
  const point = handle.scenePoint(123, 456);
  expect(Number.isFinite(point.x)).toBe(true);
  expect(Number.isFinite(point.y)).toBe(true);
});

it('rejects an in-flight focus when the canvas is disconnected before its layout settles', async () => {
  const { frame, ref, view } = await mount();
  const pending = ref.current!.execute({ type: 'focus', nodeId: frame!.id });
  const result = expect(pending).rejects.toThrow('Canvas unavailable');
  view.unmount();
  await result;
});

it('lets the latest focus request supersede an earlier request without changing its selection', async () => {
  const { document, frame, ref, select } = await mount();
  const text = document.nodes.find(node => node.type === 'richText')!;
  await act(async () => {
    const first = ref.current!.execute({ type: 'focus', nodeId: frame!.id });
    const latest = ref.current!.execute({ type: 'focus', nodeId: text.id });
    await Promise.all([first, latest]);
  });
  expect(select.mock.calls.map(([ids]) => ids)).toEqual([[frame!.id], [text.id]]);
  expect(select).toHaveBeenLastCalledWith([text.id]);
});

it.each(['readonly', 'selection', 'replaced'] as const)(
  'keeps pending text editing closed after a %s collaboration update',
  async update => {
    const document = createStudioTemplateDocumentV5('single', 'Pending text', defaultBrand);
    const text = document.nodes.find(node => node.type === 'richText')!;
    const shape = document.nodes.find(node => node.type === 'shape')!;
    document.nodes = document.nodes.filter(node => node.type === 'frame' || node.id === text.id);
    const { host, select, rerender } = await mount({ document });
    const stage = Konva.stages.find(item => host.contains(item.container()))!;
    const surface = [...host.querySelectorAll('canvas')].at(-1)!;
    const node = stage.findOne(`#${text.id}`)!;
    const point = node.getAbsoluteTransform().point({ x: 10, y: 10 });
    await waitFor(() => expect(stage.getIntersection(point)?.getParent()).toBe(node));
    const surfaceBounds = surface.getBoundingClientRect();
    await userEvent.click(surface, {
      position: {
        x: (point.x * surfaceBounds.width) / stage.width(),
        y: (point.y * surfaceBounds.height) / stage.height(),
      },
    } as never);
    await waitFor(() => expect(select).toHaveBeenCalledWith([text.id]));
    expect(screen.queryByTestId('studio-inline-text-layer')).toBeNull();
    const next = structuredClone(document);
    if (update === 'replaced') {
      next.nodes = next.nodes.filter(candidate => candidate.id !== text.id);
      const replacement = structuredClone(shape);
      replacement.id = text.id;
      next.nodes.push(replacement);
    }
    rerender({
      document: next,
      selected: update === 'selection' ? [] : [text.id],
      editable: update !== 'readonly',
    });
    expect(screen.queryByTestId('studio-inline-text-layer')).toBeNull();
  }
);

it('keeps empty-document zoom, search, clipboard and crop commands safe without invoking missing callbacks', async () => {
  const document = createStudioTemplateDocumentV5('single', 'Empty canvas', defaultBrand);
  document.nodes = [];
  document.deliverables = [];
  const { ref, select, state } = await mount({ document });
  const before = state.current!.zoom;
  for (const mode of ['selection', 'all'] as const)
    await act(() => ref.current!.execute({ type: 'zoom', mode }));
  expect(state.current!.zoom).toBe(before);
  await act(() => ref.current!.execute({ type: 'search', query: 'Missing target' }));
  for (const action of ['copy', 'cut', 'paste'] as const)
    await act(() => ref.current!.execute({ type: 'clipboard', action }));
  for (const action of ['start', 'apply', 'cancel', 'reset'] as const)
    await act(() => ref.current!.execute({ type: 'crop', action }));
  expect(select).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('searches actual text content and zooms out through the public canvas commands', async () => {
  const document = createStudioTemplateDocumentV5('single', 'Canvas commands', defaultBrand);
  const text = document.nodes.find(node => node.type === 'richText')!;
  text.name = 'Unrelated name';
  if (text.type !== 'richText') throw new Error('Expected canonical rich text');
  const leaf = text.content[0].children[0];
  if (!('text' in leaf)) throw new Error('Expected template text leaf');
  leaf.text = 'Unique searchable phrase';
  const { ref, state, select } = await mount({ document });
  await act(() => ref.current!.execute({ type: 'search', query: 'searchable phrase' }));
  expect(select).toHaveBeenLastCalledWith([text.id]);
  await act(() => ref.current!.execute({ type: 'search', query: 'never matches any node' }));
  expect(select).toHaveBeenCalledTimes(1);
  await act(() => ref.current!.execute({ type: 'zoom', mode: 'reset' }));
  await act(() => ref.current!.execute({ type: 'zoom', mode: 'out' }));
  expect(state.current!.zoom).toBeCloseTo(1 / 1.2);
});

it.each(['mouse', 'touch'] as const)(
  'opens rich text after a native %s double activation and a committed selection',
  async input => {
    const document = createStudioTemplateDocumentV5('single', 'Double activation', defaultBrand);
    const text = document.nodes.find(node => node.type === 'richText')!;
    document.nodes = document.nodes.filter(node => node.type === 'frame' || node.id === text.id);
    const { host, select, rerender } = await mount({ document });
    const stage = Konva.stages.find(item => host.contains(item.container()))!;
    const group = stage.findOne<Konva.Group>(`#${text.id}`)!;
    const point = group.getAbsoluteTransform().point({ x: 10, y: 10 });
    await waitFor(() => expect(stage.getIntersection(point)?.getParent()).toBe(group));
    const surface = [...host.querySelectorAll('canvas')].at(-1)!;
    const bounds = surface.getBoundingClientRect();
    const x = (point.x * bounds.width) / stage.width();
    const y = (point.y * bounds.height) / stage.height();
    if (input === 'mouse') {
      await userEvent.dblClick(surface, { position: { x, y } } as never);
    } else {
      for (const identifier of [1, 2]) {
        const finger = new Touch({
          identifier,
          target: surface,
          clientX: bounds.left + x,
          clientY: bounds.top + y,
        });
        fireEvent(
          surface,
          new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [finger],
            targetTouches: [finger],
            changedTouches: [finger],
          })
        );
        fireEvent(
          surface,
          new TouchEvent('touchend', {
            bubbles: true,
            cancelable: true,
            touches: [],
            targetTouches: [],
            changedTouches: [finger],
          })
        );
      }
    }
    expect(select).toHaveBeenLastCalledWith([text.id]);
    rerender({ selected: [text.id] });
    expect(await screen.findByTestId('studio-inline-text-layer')).toBeTruthy();
  }
);

it('ends a space-pan gesture on key release and preserves its resulting view', async () => {
  const { host, ref, changes, select } = await mount();
  host.focus();
  await userEvent.keyboard('[Space>]');
  fireEvent.keyDown(host, { key: ' ', code: 'Space', repeat: true });
  const surface = [...host.querySelectorAll('canvas')].at(-1)!;
  const bounds = surface.getBoundingClientRect();
  const pointer = (type: string, x: number) =>
    fireEvent(
      surface,
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 71,
        pointerType: 'mouse',
        button: 0,
        clientX: bounds.left + x,
        clientY: bounds.top + 10,
      })
    );
  await act(() => pointer('pointerdown', 10));
  await act(() => pointer('pointermove', 50));
  const before = ref.current!.scenePoint(bounds.left, bounds.top);
  await userEvent.keyboard('[/Space]');
  await act(() => pointer('pointermove', 100));
  expect(ref.current!.scenePoint(bounds.left, bounds.top)).toEqual(before);
  expect(changes).not.toHaveBeenCalled();
  expect(select).not.toHaveBeenCalled();
});

it('ignores touch pointer input during a native pinch and clears selection after an outside touch release', async () => {
  const { host, select, changes } = await mount();
  const surface = [...host.querySelectorAll('canvas')].at(-1)!;
  const bounds = surface.getBoundingClientRect();
  const fingers = [100, 200].map(
    clientX =>
      new Touch({
        identifier: clientX,
        target: surface,
        clientX: bounds.left + clientX,
        clientY: bounds.top + 30,
      })
  );
  fireEvent(
    surface,
    new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: fingers,
      targetTouches: fingers,
      changedTouches: fingers,
    })
  );
  const pointer = (type: string) =>
    fireEvent(
      surface,
      new PointerEvent(type, {
        bubbles: true,
        pointerType: 'touch',
        pointerId: 57,
        clientX: bounds.left + 10,
        clientY: bounds.top + 10,
      })
    );
  pointer('pointerdown');
  pointer('pointermove');
  pointer('pointerup');
  expect(select).not.toHaveBeenCalled();
  expect(changes).not.toHaveBeenCalled();
  fireEvent(
    surface,
    new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: fingers,
    })
  );
  await new Promise(resolve => setTimeout(resolve, 400));
  pointer('pointerup');
  expect(select).toHaveBeenLastCalledWith([]);
});

it.each(['root', 'hidden follower'] as const)(
  'drags a real selected shape with a %s without changing unrendered siblings',
  async mode => {
    const document = createStudioTemplateDocumentV5('single', 'Drag boundaries', defaultBrand);
    const shape = document.nodes.find(node => node.type === 'shape')!;
    shape.parentFrameId = null;
    Object.assign(shape.transform, { x: 1200, y: 100, width: 100, height: 80 });
    const follower = structuredClone(shape);
    follower.id = crypto.randomUUID();
    follower.transform.x += 180;
    follower.visible = mode !== 'hidden follower';
    document.nodes.push(follower);
    const { host, changes } = await mount({ document, selected: [shape.id, follower.id] });
    const stage = Konva.stages.find(item => host.contains(item.container()))!;
    const group = stage.findOne<Konva.Group>(`#${shape.id}`)!;
    const point = group.getAbsoluteTransform().point({ x: 30, y: 30 });
    await waitFor(() => expect(stage.getIntersection(point)?.getParent()).toBe(group));
    const surface = [...host.querySelectorAll('canvas')].at(-1)!;
    const bounds = surface.getBoundingClientRect();
    const x = (point.x * bounds.width) / stage.width();
    const y = (point.y * bounds.height) / stage.height();
    await userEvent.dragAndDrop(surface, surface, {
      sourcePosition: { x, y },
      targetPosition: { x: x + 30, y: y + 20 },
    } as never);
    expect(changes).toHaveBeenCalledTimes(1);
    const moves = changes.mock.calls[0][0];
    expect(moves.map((item: { nodeId: string }) => item.nodeId).sort()).toEqual(
      [shape.id, follower.id].sort()
    );
    expect(moves[0].transform.dx).toBeGreaterThan(0);
    expect(follower.transform.x).toBe(1380);
    expect(group.position()).toEqual({ x: 1250, y: 140 });
  }
);

it('clears context bounds and avoids fitting a selected node that has been removed from the canonical document', async () => {
  const missing = crypto.randomUUID();
  const { ref, state, select } = await mount({ selected: [missing], context: true });
  const before = state.current!.zoom;
  await act(() => ref.current!.execute({ type: 'zoom', mode: 'selection' }));
  expect(state.current!.zoom).toBe(before);
  await act(() => ref.current!.execute({ type: 'crop', action: 'start' }));
  expect(screen.queryByRole('button', { name: 'Context action' })).toBeNull();
  expect(select).not.toHaveBeenCalled();
});

it.each(['image', 'video'] as const)(
  'shows a safe crop error for an unresolved %s asset and leaves the document unchanged',
  async mediaType => {
    const document = createStudioTemplateDocumentV5('single', 'Unresolved asset', defaultBrand);
    const source = document.nodes.find(node => node.type === 'shape')!;
    const media = mediaNodeSchema.parse({
      ...source,
      type: 'media',
      mediaType,
      assetId: crypto.randomUUID(),
    });
    document.nodes = document.nodes.filter(node => node.id !== source.id);
    document.nodes.push(media);
    const before = structuredClone(document);
    const { ref, changes } = await mount({ document, selected: [media.id] });
    await act(() => ref.current!.execute({ type: 'crop', action: 'start' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Media could not be loaded.');
    expect(document).toEqual(before);
    expect(changes).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  }
);

it.each(['readonly', 'locked', 'audio', 'file'] as const)(
  'refuses crop for a %s media selection before fetching metadata',
  async restriction => {
    const document = createStudioTemplateDocumentV5('single', 'Crop access', defaultBrand);
    const source = document.nodes.find(node => node.type === 'shape')!;
    const media = mediaNodeSchema.parse({
      ...source,
      type: 'media',
      mediaType: restriction === 'audio' || restriction === 'file' ? restriction : 'image',
      locked: restriction === 'locked',
      assetId: crypto.randomUUID(),
    });
    document.nodes = document.nodes.filter(node => node.id !== source.id);
    document.nodes.push(media);
    const { ref, changes } = await mount({
      document,
      selected: [media.id],
      editable: restriction !== 'readonly',
    });
    await act(() => ref.current!.execute({ type: 'crop', action: 'start' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(changes).not.toHaveBeenCalled();
  }
);

it('reports image and video metadata load failures through the actual browser media elements', async () => {
  for (const mediaType of ['image', 'video'] as const) {
    const document = createStudioTemplateDocumentV5('single', 'Broken media', defaultBrand);
    const source = document.nodes.find(node => node.type === 'shape')!;
    const media = mediaNodeSchema.parse({
      ...source,
      type: 'media',
      mediaType,
      assetId: crypto.randomUUID(),
    });
    document.nodes = document.nodes.filter(node => node.id !== source.id);
    document.nodes.push(media);
    const { ref, view } = await mount({
      document,
      selected: [media.id],
      assets: [
        {
          id: media.assetId,
          url: mediaType === 'image' ? 'data:image/png;base64,AAAA' : 'data:video/mp4;base64,AAAA',
          mime: mediaType === 'image' ? 'image/png' : 'video/mp4',
          name: 'Broken asset',
        },
      ],
    });
    await act(() => ref.current!.execute({ type: 'crop', action: 'start' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Media could not be loaded.');
    view.unmount();
  }
});

it('opens real image crop controls with default labels and cancels and applies them through canvas keyboard capture', async () => {
  const document = createStudioTemplateDocumentV5('single', 'Crop keyboard', defaultBrand);
  const source = document.nodes.find(node => node.type === 'shape')!;
  const media = mediaNodeSchema.parse({
    ...source,
    type: 'media',
    mediaType: 'image',
    assetId: crypto.randomUUID(),
  });
  document.nodes = document.nodes.filter(node => node.id !== source.id);
  document.nodes.push(media);
  const { ref, host } = await mount({
    document,
    selected: [media.id],
    assets: [
      {
        id: media.assetId,
        url:
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="red"/></svg>'
          ),
        mime: 'image/png',
        name: 'Test image',
      },
    ],
  });
  host.tabIndex = 0;
  await act(() => ref.current!.execute({ type: 'crop', action: 'start' }));
  await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByRole('slider', { name: 'Zoom' })).toBeTruthy();
  host.focus();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  await act(() => ref.current!.execute({ type: 'crop', action: 'start' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  await act(() => ref.current!.execute({ type: 'crop', action: 'start' }));
  host.focus();
  await userEvent.keyboard('{Enter}');
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
});

it.each(['left', 'right', 'top', 'bottom', 'corner', 'outside'] as const)(
  'handles a native crop drag beginning near the %s frame boundary',
  async edge => {
    const document = createStudioTemplateDocumentV5('single', 'Crop edges', defaultBrand);
    const source = document.nodes.find(node => node.type === 'shape')!;
    const media = mediaNodeSchema.parse({
      ...source,
      type: 'media',
      mediaType: 'image',
      assetId: crypto.randomUUID(),
      transform: { ...source.transform, x: 80, y: 80, width: 300, height: 240 },
    });
    document.nodes = document.nodes.filter(node => node.type === 'frame');
    document.nodes.push(media);
    const commit = vi.fn();
    const { host, ref } = await mount({
      document,
      selected: [media.id],
      canvasProps: { onCropCommit: commit },
      assets: [
        {
          id: media.assetId,
          url:
            'data:image/svg+xml,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="red"/></svg>'
            ),
          mime: 'image/png',
          name: 'Crop image',
        },
      ],
    });
    await act(() => ref.current!.execute({ type: 'crop', action: 'start' }));
    const stage = Konva.stages.find(item => host.contains(item.container()))!;
    const group = stage.findOne<Konva.Group>(`#${media.id}`)!;
    const local =
      edge === 'left'
        ? { x: -4, y: 80 }
        : edge === 'right'
          ? { x: 301, y: 80 }
          : edge === 'top'
            ? { x: 120, y: -4 }
            : edge === 'bottom'
              ? { x: 120, y: 244 }
              : edge === 'corner'
                ? { x: 10 / group.getAbsoluteScale().x, y: 10 / group.getAbsoluteScale().y }
                : { x: 360, y: 80 };
    const point = group.getAbsoluteTransform().point(local);
    const surface = [...host.querySelectorAll('canvas')].at(-1)!;
    const bounds = surface.getBoundingClientRect();
    const x = (point.x * bounds.width) / stage.width(),
      y = (point.y * bounds.height) / stage.height();
    expect(globalThis.document.elementFromPoint(bounds.left + x, bounds.top + y)).toBeInstanceOf(
      HTMLCanvasElement
    );
    await userEvent.dragAndDrop(surface, surface, {
      sourcePosition: { x, y },
      targetPosition: {
        x: x + (edge === 'right' ? -20 : 20),
        y: y + (edge === 'bottom' ? -20 : 20),
      },
    } as never);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(commit).toHaveBeenCalledOnce();
    const state = commit.mock.calls[0][1];
    expect(commit.mock.calls[0][0]).toBe(media.id);
    if (edge === 'outside') expect(state.frame).toEqual(media.transform);
    else if (edge === 'corner') {
      expect(state.frame.width).not.toBe(media.transform.width);
      expect(state.frame.height).not.toBe(media.transform.height);
    } else if (edge === 'left' || edge === 'right')
      expect(state.frame.width).not.toBe(media.transform.width);
    else expect(state.frame.height).not.toBe(240);
    expect(document.nodes.find(node => node.id === media.id)?.transform).toEqual(media.transform);
  }
);

it.each(['lost button', 'retained button'] as const)(
  'ends a middle-button pan after a native %s transition',
  async mode => {
    const { host, state, changes, select } = await mount();
    const surface = [...host.querySelectorAll('canvas')].at(-1)!;
    const bounds = surface.getBoundingClientRect();
    const pointer = (type: string, buttons: number, x: number, button = 1) =>
      fireEvent(
        surface,
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerType: 'mouse',
          pointerId: 63,
          button,
          buttons,
          clientX: bounds.left + x,
          clientY: bounds.top + 30,
        })
      );
    pointer('pointerdown', 4, 30);
    const before = state.current!.viewBounds;
    if (mode === 'retained button') {
      pointer('pointerup', 4, 30, 0);
      pointer('pointermove', 4, 60);
      await waitFor(() => expect(state.current!.viewBounds).not.toEqual(before));
      pointer('pointerup', 0, 60);
    } else pointer('pointermove', 0, 60);
    const stopped = state.current!.viewBounds;
    pointer('pointermove', 4, 90);
    expect(state.current!.viewBounds).toEqual(stopped);
    expect(changes).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    const content = host.querySelector('.konvajs-content')!;
    expect(
      fireEvent(content, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }))
    ).toBe(false);
  }
);

it('ignores ordinary drag data when no element-set drop handler is installed', async () => {
  const { host } = await mount();
  const data = new DataTransfer();
  data.setData('text/plain', 'Unrelated text');
  expect(fireEvent.dragOver(host, { dataTransfer: data })).toBe(true);
  expect(fireEvent.drop(host, { dataTransfer: data, clientX: 120, clientY: 180 })).toBe(true);
});

it.each(['readonly', 'locked', 'pan'] as const)(
  'keeps native double activation from editing text in %s mode',
  async mode => {
    const document = createStudioTemplateDocumentV5('single', 'Read-only activation', defaultBrand);
    const text = document.nodes.find(node => node.type === 'richText')!;
    text.locked = mode === 'locked';
    document.nodes = document.nodes.filter(node => node.type === 'frame' || node.id === text.id);
    const { host, changes } = await mount({
      document,
      selected: [text.id],
      editable: mode !== 'readonly',
    });
    const stage = Konva.stages.find(item => host.contains(item.container()))!;
    const group = stage.findOne<Konva.Group>(`#${text.id}`)!;
    const point = group.getAbsoluteTransform().point({ x: 30, y: 30 });
    const surface = [...host.querySelectorAll('canvas')].at(-1)!;
    const bounds = surface.getBoundingClientRect();
    if (mode === 'pan') {
      host.focus();
      await userEvent.keyboard('[Space>]');
    }
    await userEvent.dblClick(surface, {
      position: {
        x: (point.x * bounds.width) / stage.width(),
        y: (point.y * bounds.height) / stage.height(),
      },
    } as never);
    expect(screen.queryByTestId('studio-inline-text-layer')).toBeNull();
    expect(changes).not.toHaveBeenCalled();
    if (mode === 'pan') await userEvent.keyboard('[/Space]');
  }
);

it.each(['readonly', 'contain'] as const)(
  'keeps the viewport fixed on wheel input in %s mode',
  async mode => {
    const { host, state } = await mount({
      editable: mode !== 'readonly',
      fit: mode === 'contain' ? 'contain' : undefined,
    });
    const before = structuredClone(state.current);
    const stage = Konva.stages.find(item => host.contains(item.container()))!;
    await act(() => stage.fire('wheel', { evt: new WheelEvent('wheel', { deltaY: 120 }) }));
    expect(state.current).toEqual(before);
  }
);

it.each([WheelEvent.DOM_DELTA_LINE, WheelEvent.DOM_DELTA_PAGE])(
  'normalizes wheel scrolling in delta mode %s without changing zoom',
  async deltaMode => {
    const { host, state } = await mount();
    const before = structuredClone(state.current!);
    const stage = Konva.stages.find(item => host.contains(item.container()))!;
    const factor = deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : stage.height();
    await act(() =>
      stage.fire('wheel', { evt: new WheelEvent('wheel', { deltaMode, deltaX: 2, deltaY: 3 }) })
    );
    expect(state.current!.zoom).toBe(before.zoom);
    expect(state.current!.viewBounds!.left).toBeCloseTo(
      before.viewBounds!.left + (2 * factor) / before.zoom
    );
    expect(state.current!.viewBounds!.top).toBeCloseTo(
      before.viewBounds!.top + (3 * factor) / before.zoom
    );
  }
);

it('does not scroll the canvas when wheel input targets an editable property field', async () => {
  const document = createStudioTemplateDocumentV5('single', 'Property wheel', defaultBrand);
  const node = document.nodes.find(item => item.type === 'shape')!;
  const { host, state } = await mount({
    document,
    selected: [node.id],
    canvasProps: { inspector: <input aria-label="Canvas property" /> },
  });
  const stage = Konva.stages.find(item => host.contains(item.container()))!;
  const before = structuredClone(state.current);
  const event = new WheelEvent('wheel', { deltaY: 120 });
  // The native DOM event retains its actual editable target at the Konva input boundary.
  const input = screen.getByRole('textbox', { name: 'Canvas property' });
  input.dispatchEvent(event);
  await act(() => stage.fire('wheel', { evt: event }));
  expect(state.current).toEqual(before);
});

it.each(['selection', 'readonly', 'deleted'] as const)(
  'closes the actual inline editor after its %s state changes',
  async change => {
    const document = createStudioTemplateDocumentV5('single', 'Text access', defaultBrand);
    const text = document.nodes.find(node => node.type === 'richText')!;
    text.transform.flipX = true;
    text.transform.flipY = true;
    const { host, rerender } = await mount({ document, selected: [text.id] });
    host.tabIndex = 0;
    host.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByTestId('studio-inline-text-layer')).toBeTruthy();
    const next = structuredClone(document);
    if (change === 'deleted') next.nodes = next.nodes.filter(node => node.id !== text.id);
    rerender({
      document: next,
      selected: change === 'selection' ? [] : [text.id],
      editable: change !== 'readonly',
    });
    await waitFor(() => expect(screen.queryByTestId('studio-inline-text-layer')).toBeNull());
  }
);

it('hands valid element-set drag data to the external drop boundary with finite scene coordinates', async () => {
  const drop = vi.fn();
  const { host } = await mount({ canvasProps: { onElementSetDrop: drop } });
  const data = new DataTransfer();
  const id = crypto.randomUUID();
  data.setData('application/x-polity-element-set', id);
  fireEvent(
    host,
    new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: data,
      clientX: 120,
      clientY: 180,
    })
  );
  expect(drop).toHaveBeenCalledWith(
    id,
    expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
  );
});

it.each(['draw', 'laser'] as const)(
  'previews a real %s gesture and passes its sampled points to the creation boundary',
  async tool => {
    const create = vi.fn(() => null);
    const { host, ref } = await mount({ canvasProps: { onCreateNode: create, guides: true } });
    const stage = Konva.stages.find(item => host.contains(item.container()))!;
    const surface = host.querySelector('canvas')!;
    await act(() => ref.current!.execute({ type: 'setTool', tool }));
    const pointer = (type: string, clientX: number, clientY: number) =>
      fireEvent(
        surface,
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 19,
          pointerType: 'mouse',
          button: 0,
          clientX,
          clientY,
        })
      );
    const bounds = surface.getBoundingClientRect();
    await act(() => pointer('pointerdown', bounds.left + 120, bounds.top + 180));
    await act(() => pointer('pointermove', bounds.left + 180, bounds.top + 220));
    const preview = stage
      .find<Konva.Line>('Line')
      .find(item => item.getAttr('listening') === false && item.getAttr('strokeWidth') === 3);
    expect(preview).toBeTruthy();
    expect(preview!.getAttr('stroke')).toBe(tool === 'laser' ? '#F16A4A' : '#12362D');
    expect(preview!.points().length).toBeGreaterThanOrEqual(4);
    await act(() => pointer('pointerup', bounds.left + 180, bounds.top + 220));
    expect(create).toHaveBeenCalledWith(
      tool,
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      false,
      expect.any(Array)
    );
  }
);

it.each(['selection', 'readonly'] as const)(
  'abandons an active crop when %s access changes before applying',
  async change => {
    const document = createStudioTemplateDocumentV5('single', 'Crop revoked', defaultBrand);
    const source = document.nodes.find(node => node.type === 'shape')!;
    const media = mediaNodeSchema.parse({
      ...source,
      type: 'media',
      mediaType: 'image',
      assetId: crypto.randomUUID(),
    });
    document.nodes = document.nodes.filter(node => node.id !== source.id);
    document.nodes.push(media);
    const { ref, rerender, changes } = await mount({
      document,
      selected: [media.id],
      assets: [
        {
          id: media.assetId,
          name: 'Actual SVG',
          mime: 'image/svg+xml',
          url:
            'data:image/svg+xml,' +
            encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"/>'),
        },
      ],
    });
    await act(() => ref.current!.execute({ type: 'crop', action: 'start' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
    rerender({
      editable: change !== 'readonly',
      selected: change === 'selection' ? [] : [media.id],
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull());
    await act(() => ref.current!.execute({ type: 'crop', action: 'apply' }));
    expect(changes).not.toHaveBeenCalled();
  }
);
