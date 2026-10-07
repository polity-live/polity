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
  host.focus();
  await userEvent.keyboard('{Enter}');
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
});

it('ignores ordinary drag data when no element-set drop handler is installed', async () => {
  const { host } = await mount();
  const data = new DataTransfer();
  data.setData('text/plain', 'Unrelated text');
  expect(fireEvent.dragOver(host, { dataTransfer: data })).toBe(true);
  expect(fireEvent.drop(host, { dataTransfer: data, clientX: 120, clientY: 180 })).toBe(true);
});

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
