import { createRef, useState } from 'react';
import Konva from 'konva';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { defaultBrand, element } from '../../logic/document';
import { createStudioNodeFromElement } from '../../logic/create-studio-node';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { moveByWorldDelta } from '../../logic/selection-geometry';
import type { StudioNode } from '../../logic/document-v3';
import type { StudioChangeRequestAnnotation } from '../../logic/change-request-annotations';
import KonvaStudioCanvas, { type StudioCanvasHandle } from '../KonvaStudioCanvas';

afterEach(() => {
  vi.restoreAllMocks();
  useLanguageStore.setState({ language: 'en' });
});

function fixture() {
  const studio = createStudioTemplateDocumentV5(
    'single',
    'Native presentation',
    defaultBrand,
    1,
    'blank'
  );
  const frame = studio.nodes.find(node => node.type === 'frame')!;
  frame.transform = {
    x: 0,
    y: 0,
    width: 640,
    height: 400,
    rotation: 0,
    flipX: false,
    flipY: false,
  };
  frame.style.fill = '#ffffff';
  const shape = createStudioNodeFromElement(
    element('rect', { x: 30, y: 30, width: 100, height: 80, fill: '#ff0000' }),
    frame.id,
    0
  );
  studio.nodes.push(shape);
  return { studio, frame, shape };
}

function stage() {
  const host = screen.getByTestId('studio-canvas');
  const value = Konva.stages.find(item => host.contains(item.container()));
  if (!value) throw new Error('Expected a real Konva stage');
  return value;
}

function mountInspector(customLabels = false) {
  const { studio, frame, shape } = fixture();
  const select = vi.fn();
  const view = render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[shape.id]}
        editable
        inspector={<input aria-label="Property value" defaultValue="kept" />}
        inspectorLabels={
          customLabels
            ? {
                title: 'Properties',
                move: 'Move properties',
                collapse: 'Collapse properties',
                expand: 'Expand properties',
              }
            : undefined
        }
        selectExact={select}
      />
    </div>
  );
  return { view, select };
}

it('collapses and restores the native inspector with keyboard activation and retained focus', async () => {
  mountInspector(true);
  const panel = screen.getByRole('complementary', { name: 'Properties' });
  const toggle = screen.getByRole('button', { name: 'Collapse properties' });
  expect(panel.getAttribute('data-collapsed')).toBe('false');
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  toggle.focus();
  await userEvent.keyboard('{Enter}');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(panel.getAttribute('data-collapsed')).toBe('true');
  expect(screen.queryByRole('textbox', { name: 'Property value' })).toBeNull();
  expect(document.activeElement).toBe(toggle);
  expect(toggle.getAttribute('aria-label')).toBe('Expand properties');
  await userEvent.keyboard(' ');
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect((screen.getByRole('textbox', { name: 'Property value' }) as HTMLInputElement).value).toBe(
    'kept'
  );
  expect(document.activeElement).toBe(toggle);
});

it('moves the inspector with native arrow keys and clamps movement to the viewport', async () => {
  const { select } = mountInspector();
  const panel = screen.getByRole('complementary', { name: 'Element properties' });
  const handle = screen.getByRole('button', { name: 'Move properties' });
  await waitFor(() => expect(stage().width()).toBe(700));
  const initialX = parseFloat(panel.style.left);
  const initialY = parseFloat(panel.style.top);
  handle.focus();
  await userEvent.keyboard('{ArrowRight}{ArrowDown}');
  expect(parseFloat(panel.style.left)).toBe(initialX + 10);
  expect(parseFloat(panel.style.top)).toBe(initialY + 10);
  await userEvent.keyboard('{Shift>}{ArrowLeft}{ArrowUp}{/Shift}');
  expect(parseFloat(panel.style.left)).toBe(Math.max(0, initialX - 10));
  expect(parseFloat(panel.style.top)).toBe(Math.max(0, initialY - 10));
  await userEvent.keyboard('{Enter} {Escape}');
  expect(document.activeElement).toBe(handle);
  expect(select).not.toHaveBeenCalled();
  const verticalSteps = Math.ceil(stage().height() / 20) + 1;
  const horizontalSteps = Math.ceil((stage().width() - panel.offsetWidth) / 20) + 1;
  await userEvent.keyboard(
    `{Shift>}{ArrowDown>${verticalSteps}/}{ArrowRight>${horizontalSteps}/}{/Shift}`
  );
  expect(panel.getAttribute('data-expand-direction')).toBe('up');
  expect(parseFloat(panel.style.top)).toBe(stage().height() - 44);
  expect(parseFloat(panel.style.left)).toBe(700 - panel.offsetWidth);
  await userEvent.keyboard(
    `{Shift>}{ArrowUp>${verticalSteps}/}{ArrowLeft>${horizontalSteps}/}{/Shift}`
  );
  expect(panel.style.top).toBe('0px');
  expect(panel.style.left).toBe('0px');
  expect(panel.getAttribute('data-expand-direction')).toBe('down');
});

it('updates native inspector labels after a language change while retaining keyboard focus and panel state', async () => {
  mountInspector();
  const panel = screen.getByRole('complementary', { name: 'Element properties' });
  const toggle = screen.getByRole('button', { name: 'Collapse properties' });
  toggle.focus();
  await userEvent.keyboard('{Enter}');
  expect(panel.getAttribute('data-collapsed')).toBe('true');
  await act(async () => {
    useLanguageStore.setState({ language: 'de' });
  });
  expect(screen.getByRole('complementary', { name: 'Elementeigenschaften' })).toBe(panel);
  expect(screen.getByRole('button', { name: 'Eigenschaften aufklappen' })).toBe(toggle);
  expect(screen.getByRole('button', { name: 'Eigenschaften verschieben' })).toBeTruthy();
  expect(document.activeElement).toBe(toggle);
  await userEvent.keyboard(' ');
  expect(panel.getAttribute('data-collapsed')).toBe('false');
  expect(screen.getByRole('button', { name: 'Eigenschaften einklappen' })).toBe(toggle);
  expect(document.activeElement).toBe(toggle);
  await act(async () => {
    useLanguageStore.setState({ language: 'en' });
  });
  expect(screen.getByRole('button', { name: 'Collapse properties' })).toBe(toggle);
});

it('drags the inspector using a real pointer and retains its selection', async () => {
  const { select } = mountInspector();
  const panel = screen.getByRole('complementary', { name: 'Element properties' });
  const handle = screen.getByRole('button', { name: 'Move properties' });
  const initialX = parseFloat(panel.style.left);
  const initialY = parseFloat(panel.style.top);
  await userEvent.dragAndDrop(handle, screen.getByTestId('studio-canvas'), {
    sourcePosition: { x: 30, y: 15 },
    targetPosition: { x: 120, y: 180 },
  } as never);
  expect(
    parseFloat(panel.style.left) !== initialX || parseFloat(panel.style.top) !== initialY
  ).toBe(true);
  const end = { left: panel.style.left, top: panel.style.top };
  fireEvent.pointerMove(window, { pointerId: 1, clientX: 500, clientY: 500 });
  expect({ left: panel.style.left, top: panel.style.top }).toEqual(end);
  expect(select).not.toHaveBeenCalled();
});

it('ignores secondary inspector drags and cancels interrupted pointer movement', async () => {
  mountInspector();
  const panel = screen.getByRole('complementary', { name: 'Element properties' });
  const handle = screen.getByRole('button', { name: 'Move properties' });
  await waitFor(() => expect(stage().width()).toBe(700));
  const initial = { left: panel.style.left, top: panel.style.top };
  fireEvent.pointerDown(handle, { button: 2, pointerId: 9, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(window, { pointerId: 9, clientX: 100, clientY: 100 });
  expect({ left: panel.style.left, top: panel.style.top }).toEqual(initial);
  fireEvent.pointerDown(handle, { button: 0, pointerId: 9, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(window, { pointerId: 10, clientX: 100, clientY: 100 });
  expect({ left: panel.style.left, top: panel.style.top }).toEqual(initial);
  fireEvent.pointerCancel(window, { pointerId: 9 });
  fireEvent.pointerMove(window, { pointerId: 9, clientX: 100, clientY: 100 });
  expect({ left: panel.style.left, top: panel.style.top }).toEqual(initial);
  fireEvent.pointerDown(handle, { button: 0, pointerId: 9, clientX: 10, clientY: 10 });
  fireEvent.blur(window);
  fireEvent.pointerMove(window, { pointerId: 9, clientX: 100, clientY: 100 });
  expect({ left: panel.style.left, top: panel.style.top }).toEqual(initial);
});

it('renders every geometric shape with real Konva primitives and painted pixels', async () => {
  const { studio, frame, shape } = fixture();
  if (shape.type !== 'shape') throw new Error('Expected a shape');
  const kinds = ['ellipse', 'diamond', 'line', 'arrow', 'rounded-rectangle', 'rectangle'] as const;
  const nodes = kinds.map((kind, index) => ({
    ...structuredClone(shape),
    id: crypto.randomUUID(),
    shape: kind,
    transform: { ...shape.transform, x: 20 + index * 100, y: 60, width: 70, height: 70 },
    style: {
      ...shape.style,
      fill: kind === 'line' || kind === 'arrow' ? null : '#ff0000',
      stroke: index % 2 ? '#0000ff' : null,
      strokeWidth: 3,
      strokeStyle: index % 3 === 0 ? 'dashed' : index % 3 === 1 ? 'dotted' : 'solid',
    } as StudioNode['style'],
  }));
  studio.nodes = [frame, ...nodes];
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        fit="contain"
      />
    </div>
  );
  await waitFor(() =>
    expect(stage().findOne<Konva.Group>(`#${nodes[0].id}`)?.findOne('Ellipse')).toBeTruthy()
  );
  expect(stage().findOne<Konva.Group>(`#${nodes[1].id}`)?.findOne('Line')?.getAttr('closed')).toBe(
    true
  );
  expect(stage().findOne<Konva.Group>(`#${nodes[2].id}`)?.findOne('Shape')?.getAttr('stroke')).toBe(
    '#12362D'
  );
  expect(stage().findOne<Konva.Group>(`#${nodes[3].id}`)?.findOne('Shape')?.getAttr('stroke')).toBe(
    '#0000ff'
  );
  expect(
    stage().findOne<Konva.Group>(`#${nodes[4].id}`)?.findOne('Rect')?.getAttr('cornerRadius')
  ).toBe(12);
  await waitFor(() => {
    const canvas = stage().toCanvas();
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    expect(
      [...pixels].filter(
        (value, index) =>
          index % 4 === 0 && value > 200 && pixels[index + 1] < 20 && pixels[index + 2] < 20
      ).length
    ).toBeGreaterThan(100);
  });
});

it('paints drawing, table, chart, embed and missing-media nodes on the real canvas', async () => {
  const { studio, frame, shape } = fixture();
  const drawing: StudioNode = {
    ...shape,
    id: crypto.randomUUID(),
    type: 'drawing',
    tool: 'pen',
    points: [
      [0, 0],
      [60, 60],
      [80, 10],
    ],
    style: { ...shape.style, stroke: null, strokeWidth: 0 },
  };
  const table = createStudioNodeFromElement(
    element('table', { x: 140, y: 30, width: 140, height: 120 }),
    frame.id,
    1
  );
  const chart = createStudioNodeFromElement(
    element('chart', { x: 300, y: 30, width: 140, height: 120 }),
    frame.id,
    2
  );
  const embed: StudioNode = {
    ...shape,
    id: crypto.randomUUID(),
    type: 'embed',
    provider: 'code',
    value: 'example',
    transform: { ...shape.transform, y: 200 },
    style: { ...shape.style, fill: null },
  };
  const media = createStudioNodeFromElement(
    element('image', { assetId: crypto.randomUUID(), x: 180, y: 200, width: 100, height: 80 }),
    frame.id,
    4
  );
  studio.nodes = [frame, drawing, table, chart, embed, media];
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable
        fit="contain"
      />
    </div>
  );
  await waitFor(() =>
    expect(stage().findOne<Konva.Group>(`#${drawing.id}`)?.findOne('Line')).toBeTruthy()
  );
  expect(
    stage().findOne<Konva.Group>(`#${drawing.id}`)?.findOne('Line')?.getAttr('strokeWidth')
  ).toBe(2);
  expect(stage().findOne<Konva.Group>(`#${embed.id}`)?.findOne('Rect')?.getAttr('fill')).toBe(
    '#EEEEEE'
  );
  expect(stage().findOne<Konva.Group>(`#${media.id}`)?.findOne('Rect')?.getAttr('fill')).toBe(
    '#D9D7D0'
  );
  for (const node of [table, chart]) {
    const shape = stage().findOne<Konva.Group>(`#${node.id}`)?.findOne('Shape');
    expect(shape).toBeTruthy();
    const bounds = shape!.getClientRect();
    await waitFor(() =>
      expect(
        stage()
          .getIntersection({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 })
          ?.getParent()
          ?.id()
      ).toBe(node.id)
    );
  }
});

it('searches nested rich text and selects its matching node', async () => {
  const { studio, frame } = fixture();
  const text = createStudioNodeFromElement(
    element('text', { text: 'placeholder', x: 80, y: 100, width: 160, height: 80 }),
    frame.id,
    1
  );
  if (text.type !== 'richText') throw new Error('Expected rich text');
  text.content = [
    {
      id: crypto.randomUUID(),
      type: 'p',
      children: [
        {
          id: crypto.randomUUID(),
          type: 'a',
          url: 'https://example.com',
          children: [{ id: crypto.randomUUID(), text: 'Nested needle', fontFamily: 'Inter' }],
        },
      ],
    },
  ];
  studio.nodes.push(text);
  const select = vi.fn();
  const ref = createRef<StudioCanvasHandle>();
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        selectExact={select}
        editable={false}
      />
    </div>
  );
  await waitFor(() => expect(stage().width()).toBe(700));
  await act(async () => {
    await ref.current!.execute({ type: 'search', query: 'needle' });
  });
  expect(select).toHaveBeenCalledWith([text.id]);
  const bounds = stage().findOne<Konva.Group>(`#${text.id}`)!.getClientRect();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(stage().width());
  await act(async () => {
    await ref.current!.execute({ type: 'search', query: 'unmatched' });
  });
  expect(select).toHaveBeenCalledTimes(1);
});

it('draws only peers on the active frame and uses readable fallback identity colors', async () => {
  const { studio, frame } = fixture();
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        peers={[
          { cursor: { pageId: frame.id, x: 150, y: 100 }, user: { name: 'Ada', color: '#ff0000' } },
          { cursor: { pageId: frame.id, x: 200, y: 100 } },
          {
            cursor: { pageId: crypto.randomUUID(), x: 300, y: 100 },
            user: { name: 'Other frame' },
          },
          { user: { name: 'No cursor' } },
        ]}
      />
    </div>
  );
  await waitFor(() =>
    expect(
      stage()
        .find('Text')
        .some(node => node.getAttr('text') === 'Ada')
    ).toBe(true)
  );
  expect(
    stage()
      .find('Text')
      .some(node => node.getAttr('text') === 'Other frame')
  ).toBe(false);
  expect(
    stage()
      .find('Text')
      .some(node => node.getAttr('text') === 'No cursor')
  ).toBe(false);
  expect(
    stage()
      .find('Ellipse')
      .map(node => node.getAttr('fill'))
  ).toContain('#B88A3B');
});

async function recordedVideo() {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 90;
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => chunks.push(event.data);
  const done = new Promise<Blob>(resolve => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
  });
  recorder.start();
  for (let i = 0; i < 15; i++) {
    canvas.getContext('2d')!.fillStyle = '#ff0000';
    canvas.getContext('2d')!.fillRect(0, 0, 160, 90);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  recorder.stop();
  const blob = await done;
  stream.getTracks().forEach(track => track.stop());
  return URL.createObjectURL(blob);
}

it('decodes and crops a native recorded video, redraws after seeking and releases media on unmount', async () => {
  const url = await recordedVideo();
  const videos: HTMLVideoElement[] = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(
    (...args: Parameters<typeof document.createElement>) => {
      const node = create(...args);
      if (node instanceof HTMLVideoElement) videos.push(node);
      return node;
    }
  );
  const { studio, frame } = fixture();
  const id = crypto.randomUUID();
  const media = createStudioNodeFromElement(
    element('video', { assetId: id, x: 40, y: 50, width: 160, height: 90 }),
    frame.id,
    1
  );
  studio.nodes.push(media);
  const ref = createRef<StudioCanvasHandle>();
  const commit = vi.fn();
  const view = render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[{ id, name: 'red.webm', mime: 'video/webm', url }]}
        selected={[media.id]}
        editable
        onCropCommit={commit}
        fit="contain"
      />
    </div>
  );
  try {
    await waitFor(() =>
      expect(stage().findOne<Konva.Group>(`#${media.id}`)?.findOne('Image')).toBeTruthy()
    );
    const video = videos.find(item => item.preload === 'auto')!;
    expect(video.videoWidth).toBe(160);
    expect(video.videoHeight).toBe(90);
    expect(video.muted).toBe(true);
    expect(video.crossOrigin).toBe('anonymous');
    const seeked = new Promise<void>(resolve =>
      video.addEventListener('seeked', () => resolve(), { once: true })
    );
    video.currentTime = 0.05;
    await seeked;
    const canvas = stage().toCanvas();
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    expect(
      [...pixels].some(
        (value, index) =>
          index % 4 === 0 && value > 200 && pixels[index + 1] < 30 && pixels[index + 2] < 30
      )
    ).toBe(true);
    await act(async () => {
      await ref.current!.execute({ type: 'crop', action: 'start' });
    });
    await screen.findByRole('toolbar', { name: 'Crop' });
    screen.getByRole('button', { name: 'Apply' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(commit).toHaveBeenCalledWith(
      media.id,
      expect.objectContaining({
        crop: expect.objectContaining({ naturalWidth: 160, naturalHeight: 90 }),
      })
    );
    const group = stage().findOne<Konva.Group>(`#${media.id}`)!;
    const point = canvasPoint(group, { x: 80, y: 45 });
    await waitFor(() =>
      expect(
        stage()
          .getIntersection(group.getAbsoluteTransform().point({ x: 80, y: 45 }))
          ?.findAncestor(`#${media.id}`)
      ).toBe(group)
    );
    await userEvent.dblClick(point.surface, { position: { x: point.x, y: point.y } } as never);
    await screen.findByRole('toolbar', { name: 'Crop' });
    screen.getByRole('button', { name: 'Cancel' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('toolbar', { name: 'Crop' })).toBeNull();
    expect(commit).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(video.getAttribute('src')).toBeNull();
    expect(video.paused).toBe(true);
    expect(video.onloadeddata).toBeNull();
    expect(video.onseeked).toBeNull();
    video.dispatchEvent(new Event('loadeddata'));
    video.dispatchEvent(new Event('seeked'));
  } finally {
    view.unmount();
    URL.revokeObjectURL(url);
  }
});

it('reports missing assets and native image and video decoding failures without committing a crop', async () => {
  const { studio, frame } = fixture();
  const id = crypto.randomUUID();
  const media = createStudioNodeFromElement(
    element('image', { assetId: id, x: 40, y: 50, width: 100, height: 90 }),
    frame.id,
    1
  );
  studio.nodes.push(media);
  const ref = createRef<StudioCanvasHandle>();
  const commit = vi.fn();
  const props = {
    ref,
    document: studio,
    activeFrameId: frame.id,
    selected: [media.id],
    editable: true,
    onCropCommit: commit,
  };
  const wrap = (
    assets: { id: string; name: string; mime: string; url: string }[],
    labels = false
  ) => (
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        {...props}
        assets={assets}
        cropLabels={
          labels
            ? {
                crop: 'Crop custom',
                apply: 'Apply custom',
                cancel: 'Cancel custom',
                reset: 'Reset custom',
                zoom: 'Zoom custom',
                loading: 'Loading custom',
                failed: 'Failed custom',
              }
            : undefined
        }
      />
    </div>
  );
  const view = render(wrap([]));
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Media could not be loaded.');
  const invalid = { id, name: 'broken', mime: 'image/svg+xml', url: 'data:image/svg+xml,invalid' };
  view.rerender(wrap([invalid]));
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Media could not be loaded.');
  if (media.type !== 'media') throw new Error('Expected media');
  media.mediaType = 'video';
  view.rerender(wrap([{ ...invalid, mime: 'video/webm', url: 'data:video/webm,invalid' }], true));
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Failed custom');
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByRole('toolbar', { name: 'Crop custom' })).toBeNull();
  expect(commit).not.toHaveBeenCalled();
});

it('rejects crop commands for readonly, locked, nonvisual and missing selections', async () => {
  const { studio, frame, shape } = fixture();
  const media = createStudioNodeFromElement(
    element('image', { assetId: crypto.randomUUID(), x: 40, y: 50, width: 100, height: 90 }),
    frame.id,
    1
  );
  if (media.type !== 'media') throw new Error('Expected media');
  studio.nodes.push(media);
  const ref = createRef<StudioCanvasHandle>();
  const commit = vi.fn();
  const wrap = (selected: string[], editable = true) => (
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        selected={selected}
        editable={editable}
        onCropCommit={commit}
        assets={[]}
      />
    </div>
  );
  const view = render(wrap([media.id], false));
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  media.locked = true;
  view.rerender(wrap([media.id]));
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  media.locked = false;
  media.mediaType = 'audio';
  view.rerender(wrap([media.id]));
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  for (const selected of [[shape.id], [crypto.randomUUID()], [], [shape.id, media.id]]) {
    view.rerender(wrap(selected));
    await act(async () => {
      await ref.current!.execute({ type: 'crop', action: 'start' });
    });
  }
  for (const action of ['reset', 'apply', 'cancel'] as const) {
    await act(async () => {
      await ref.current!.execute({ type: 'crop', action });
    });
  }
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('toolbar', { name: 'Crop' })).toBeNull();
  expect(commit).not.toHaveBeenCalled();
});

it('composites nested master layouts in front and behind each destination frame', async () => {
  const { studio, frame, shape } = fixture();
  const master = {
    ...structuredClone(frame),
    id: crypto.randomUUID(),
    name: 'Master',
    transform: { ...frame.transform, x: 800 },
  };
  const back = {
    ...structuredClone(shape),
    id: crypto.randomUUID(),
    parentFrameId: master.id,
    transform: { ...shape.transform, x: 200, y: 180 },
    style: { ...shape.style, fill: '#0000ff' },
  };
  const nested = {
    ...structuredClone(frame),
    id: crypto.randomUUID(),
    parentFrameId: master.id,
    name: 'Nested master',
    clipContent: false,
    transform: {
      ...frame.transform,
      x: 20,
      y: 20,
      width: 100,
      height: 100,
      flipX: true,
      flipY: true,
    },
    style: { ...frame.style, fill: null },
  };
  const front = {
    ...structuredClone(shape),
    id: crypto.randomUUID(),
    parentFrameId: nested.id,
    transform: {
      ...shape.transform,
      x: 20,
      y: 20,
      width: 60,
      height: 60,
      flipX: true,
      flipY: true,
    },
    style: { ...shape.style, fill: '#00ff00' },
  };
  studio.nodes.push(master, back, nested, front);
  studio.masterLayout = { frameId: master.id, placements: { [back.id]: 'background' } };
  studio.frameDefaults.background = '#ffff00';
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        fit="contain"
      />
    </div>
  );
  await waitFor(() =>
    expect(
      stage()
        .find('Rect')
        .some(node => node.getAttr('fill') === '#00ff00')
    ).toBe(true)
  );
  const green = stage()
    .find('Rect')
    .find(node => node.getAttr('fill') === '#00ff00')!;
  expect(green.getParent()!.scaleX()).toBe(-1);
  expect(green.getParent()!.scaleY()).toBe(-1);
  const blue = stage()
    .find('Rect')
    .find(node => node.getAttr('fill') === '#0000ff')!;
  expect(blue.getParent()!.getParent()!.listening()).toBe(false);
  const nestedFrame = stage()
    .find('Rect')
    .find(node => node.getAttr('fill') === '#ffff00')!;
  expect(nestedFrame).toBeTruthy();
  await waitFor(() => {
    const image = stage().toCanvas();
    const pixels = image.getContext('2d')!.getImageData(0, 0, image.width, image.height).data;
    expect(
      [...pixels].some(
        (value, index) =>
          index % 4 === 1 && value > 200 && pixels[index - 1] < 30 && pixels[index + 1] < 30
      )
    ).toBe(true);
  });
});

function canvasPoint(node: Konva.Node, local: { x: number; y: number }) {
  const point = node.getAbsoluteTransform().point(local);
  const surface = [...stage().container().querySelectorAll('canvas')].at(-1)!;
  const bounds = surface.getBoundingClientRect();
  return {
    surface,
    x: (point.x * bounds.width) / stage().width(),
    y: (point.y * bounds.height) / stage().height(),
  };
}

it.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])(
  'resizes selected nodes with native handles without changing orientation (mirrorX=%s, mirrorY=%s)',
  async (mirrorX, mirrorY) => {
    const { studio, frame, shape } = fixture();
    frame.transform.rotation = 12;
    shape.transform.flipX = mirrorX;
    shape.transform.flipY = mirrorY;
    const changes = vi.fn();
    function Harness() {
      const [document, setDocument] = useState(studio);
      return (
        <div style={{ width: 700, height: 500 }}>
          <KonvaStudioCanvas
            document={document}
            activeFrameId={frame.id}
            assets={[]}
            selected={[shape.id]}
            applyCanvasChanges={updates => {
              changes(updates);
              setDocument(previous => {
                const next = structuredClone(previous);
                for (const update of updates) {
                  const node = next.nodes.find(item => item.id === update.nodeId)!;
                  const transform = update.transform!;
                  moveByWorldDelta(next, node, { x: transform.dx, y: transform.dy });
                  node.transform = {
                    ...node.transform,
                    width: transform.width,
                    height: transform.height,
                    rotation: transform.rotation,
                    flipX: transform.flipX,
                    flipY: transform.flipY,
                  };
                }
                return next;
              });
            }}
            editable
            fit="contain"
          />
        </div>
      );
    }
    render(<Harness />);
    await waitFor(() =>
      expect(stage().findOne<Konva.Transformer>('Transformer')?.nodes()).toHaveLength(1)
    );
    const transformer = stage().findOne<Konva.Transformer>('Transformer')!;
    const anchor = transformer.findOne('.bottom-right')!;
    const rendered = stage().findOne(`#${shape.id}`)!;
    let preview: ReturnType<Konva.Node['getClientRect']> | null = null;
    rendered.on('transform', () => {
      preview = rendered.getClientRect({ skipStroke: true });
    });
    await waitFor(() => expect(anchor.isVisible()).toBe(true));
    await waitFor(() => {
      const position = anchor
        .getAbsoluteTransform()
        .point({ x: anchor.width() / 2, y: anchor.height() / 2 });
      expect(stage().getIntersection(position)).toBe(anchor);
    });
    const point = canvasPoint(anchor, { x: anchor.width() / 2, y: anchor.height() / 2 });
    await userEvent.dragAndDrop(point.surface, point.surface, {
      sourcePosition: { x: point.x, y: point.y },
      targetPosition: { x: point.x + 35, y: point.y + 25 },
    } as never);
    expect(changes).toHaveBeenCalledTimes(1);
    const change = changes.mock.calls[0][0][0];
    expect(change.nodeId).toBe(shape.id);
    // A mirror may decompose into a half-turn and a different scale sign.
    // Compare the orientation rather than depending on its decomposition.
    const radians = (change.transform.rotation * Math.PI) / 180;
    expect(Math.cos(radians) * (change.transform.flipX ? -1 : 1)).toBeCloseTo(mirrorX ? -1 : 1);
    expect(Math.cos(radians) * (change.transform.flipY ? -1 : 1)).toBeCloseTo(mirrorY ? -1 : 1);
    expect(change.transform.width).not.toBe(shape.transform.width);
    expect(change.transform.height).not.toBe(shape.transform.height);
    expect(Number.isFinite(change.transform.dx)).toBe(true);
    expect(Number.isFinite(change.transform.dy)).toBe(true);
    expect(stage().findOne(`#${shape.id}`)!.scale()).toEqual({
      x: change.transform.flipX ? -1 : 1,
      y: change.transform.flipY ? -1 : 1,
    });
    expect(preview).not.toBeNull();
    const final = rendered.getClientRect({ skipStroke: true });
    for (const key of ['x', 'y', 'width', 'height'] as const)
      expect(final[key]).toBeCloseTo(preview![key], 4);
  }
);

it('resizes root nodes without a parent transform and stops toolbar pointer events from selecting the canvas', async () => {
  const { studio, frame, shape } = fixture();
  shape.parentFrameId = null;
  shape.transform = { ...shape.transform, x: 750, y: 100 };
  const changes = vi.fn();
  const select = vi.fn();
  const clicked = vi.fn();
  render(
    <div style={{ width: 1000, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[shape.id]}
        applyCanvasChanges={changes}
        selectExact={select}
        editable
        contextToolbar={<button onClick={clicked}>Context action</button>}
        contextToolbarLabel="Selection actions"
      />
    </div>
  );
  const toolbar = await screen.findByRole('toolbar', { name: 'Selection actions' });
  await waitFor(() => expect(stage().width()).toBe(1000));
  expect(toolbar.style.left).not.toBe('');
  await userEvent.click(screen.getByRole('button', { name: 'Context action' }));
  expect(clicked).toHaveBeenCalledTimes(1);
  expect(select).not.toHaveBeenCalled();
  const transformer = stage().findOne<Konva.Transformer>('Transformer')!;
  await waitFor(() => expect(transformer.nodes()).toHaveLength(1));
  const anchor = transformer.findOne('.middle-right')!;
  await waitFor(() => expect(anchor.isVisible()).toBe(true));
  await waitFor(() => {
    const position = anchor
      .getAbsoluteTransform()
      .point({ x: anchor.width() / 2, y: anchor.height() / 2 });
    expect(stage().getIntersection(position)).toBe(anchor);
  });
  const point = canvasPoint(anchor, { x: anchor.width() / 2, y: anchor.height() / 2 });
  await userEvent.dragAndDrop(point.surface, point.surface, {
    sourcePosition: { x: point.x, y: point.y },
    targetPosition: { x: point.x + 30, y: point.y },
  } as never);
  expect(changes).toHaveBeenCalledTimes(1);
  expect(changes.mock.calls[0][0][0]).toEqual(
    expect.objectContaining({
      nodeId: shape.id,
      transform: expect.objectContaining({ flipX: false, flipY: false }),
    })
  );
});

it('keeps foreground master content above the live inline text editor', async () => {
  const { studio, frame, shape } = fixture();
  const text = createStudioNodeFromElement(
    element('text', { text: 'Native text', x: 180, y: 130, width: 200, height: 100 }),
    frame.id,
    2
  );
  const master = {
    ...structuredClone(frame),
    id: crypto.randomUUID(),
    name: 'Master',
    transform: { ...frame.transform, x: 800 },
  };
  const nested = {
    ...structuredClone(frame),
    id: crypto.randomUUID(),
    parentFrameId: master.id,
    name: 'Clipped master',
    clipContent: true,
    transform: { ...frame.transform, x: 20, y: 20, width: 120, height: 100 },
    style: { ...frame.style, fill: null },
  };
  const front = {
    ...structuredClone(shape),
    id: crypto.randomUUID(),
    parentFrameId: nested.id,
    style: { ...shape.style, fill: '#00ff00' },
  };
  studio.nodes.push(text, master, nested, front);
  studio.masterLayout = { frameId: master.id, placements: {} };
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[text.id]}
        editable
        fit="contain"
      />
    </div>
  );
  await waitFor(() => expect(stage().findOne(`#${text.id}`)).toBeTruthy());
  screen.getByTestId('studio-canvas').focus();
  await userEvent.keyboard('{Enter}');
  const editor = await screen.findByLabelText('Text');
  expect(document.activeElement).toBe(editor);
  const green = stage()
    .find('Rect')
    .find(node => node.getAttr('fill') === '#00ff00')!;
  expect(green.getLayer()!.getZIndex()).toBe(1);
  const clip = green.getParent()!.getParent()!;
  expect(clip.getAttr('clipWidth')).toBe(120);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByLabelText('Text')).toBeNull());
  expect(
    stage()
      .find('Rect')
      .find(node => node.getAttr('fill') === '#00ff00')!
      .getLayer()!
      .getZIndex()
  ).toBe(0);
});

it('resizes media crops with every native edge and corner handle', async () => {
  const { studio, frame } = fixture();
  const assetId = crypto.randomUUID();
  const media = createStudioNodeFromElement(
    element('image', { assetId, x: 120, y: 110, width: 160, height: 100 }),
    frame.id,
    1
  );
  studio.nodes.push(media);
  const url = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="red"/></svg>')}`;
  for (const [x, y] of [
    [0, 0],
    [80, 0],
    [160, 0],
    [160, 50],
    [160, 100],
    [80, 100],
    [0, 100],
    [0, 50],
  ]) {
    const ref = createRef<StudioCanvasHandle>();
    const commit = vi.fn();
    const view = render(
      <div style={{ width: 700, height: 500 }}>
        <KonvaStudioCanvas
          ref={ref}
          document={studio}
          activeFrameId={frame.id}
          assets={[{ id: assetId, name: 'red.svg', mime: 'image/svg+xml', url }]}
          selected={[media.id]}
          editable
          fit="contain"
          onCropCommit={commit}
        />
      </div>
    );
    await act(async () => {
      await ref.current!.execute({ type: 'crop', action: 'start' });
    });
    await screen.findByRole('toolbar', { name: 'Crop' });
    const group = stage().findOne<Konva.Group>(`#${media.id}`)!;
    const handles = group
      .find('Rect')
      .filter(node => node.getAttr('fill') === '#ffffff' && node.getAttr('stroke') === '#6856c8');
    expect(handles).toHaveLength(8);
    const handle = handles.find(
      node =>
        Math.abs(node.x() + node.width() / 2 - x) < 0.1 &&
        Math.abs(node.y() + node.height() / 2 - y) < 0.1
    )!;
    await waitFor(() =>
      expect(
        stage().getIntersection(
          handle.getAbsoluteTransform().point({ x: handle.width() / 2, y: handle.height() / 2 })
        )
      ).toBe(handle)
    );
    const point = canvasPoint(handle, { x: handle.width() / 2, y: handle.height() / 2 });
    await userEvent.dragAndDrop(point.surface, point.surface, {
      sourcePosition: { x: point.x, y: point.y },
      targetPosition: {
        x: point.x + (x === 0 ? 10 : x === 160 ? -10 : 0),
        y: point.y + (y === 0 ? 10 : y === 100 ? -10 : 0),
      },
    } as never);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(commit).toHaveBeenCalledTimes(1);
    const result = commit.mock.calls[0][1];
    if (x !== 80) expect(result.frame.width).toBeLessThan(160);
    if (y !== 50) expect(result.frame.height).toBeLessThan(100);
    expect(result.crop).toEqual(expect.objectContaining({ naturalWidth: 320, naturalHeight: 200 }));
    view.unmount();
  }
});

it('ignores touch zoom on text fields, handles cancelled fingers and resumes pointer selection after the touch cooldown', async () => {
  const { studio, frame, shape } = fixture();
  const ref = createRef<StudioCanvasHandle>();
  const select = vi.fn();
  const view = render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable
        selectExact={select}
      />
    </div>
  );
  await waitFor(() => expect(stage().width()).toBe(700));
  const content = stage().container().querySelector('.konvajs-content')!;
  const surface = [...content.querySelectorAll('canvas')].at(-1)!;
  const input = document.createElement('input');
  content.append(input);
  const fingers = [
    new Touch({ identifier: 1, target: surface, clientX: 100, clientY: 100 }),
    new Touch({ identifier: 2, target: surface, clientX: 200, clientY: 100 }),
  ];
  const send = (target: Element, type: string, touches: Touch[]) =>
    target.dispatchEvent(
      new TouchEvent(type, {
        touches,
        targetTouches: touches,
        changedTouches: fingers,
        bubbles: true,
        cancelable: true,
      })
    );
  const initial = stage().scaleX();
  send(input, 'touchstart', fingers);
  send(surface, 'touchmove', fingers);
  expect(stage().scaleX()).toBe(initial);
  send(surface, 'touchstart', [fingers[0]]);
  send(surface, 'touchend', []);
  expect(send(surface, 'touchstart', fingers)).toBe(false);
  expect(send(surface, 'touchend', fingers)).toBe(false);
  expect(send(surface, 'touchcancel', [fingers[0]])).toBe(false);
  expect(send(surface, 'touchmove', [fingers[0]])).toBe(true);
  send(surface, 'touchend', []);
  // A second gesture during the cooldown must replace its reset timer.
  expect(send(surface, 'touchstart', fingers)).toBe(false);
  send(surface, 'touchend', []);
  await new Promise<void>(resolve => setTimeout(resolve, 400));
  const group = stage().findOne(`#${shape.id}`)!;
  const point = canvasPoint(group, { x: 50, y: 40 });
  await userEvent.click(point.surface, { position: { x: point.x, y: point.y } } as never);
  expect(select).toHaveBeenCalledWith([shape.id]);
  expect(group.getAttr('data-action-id')).toBe('communication-studio.canvas.node.select');
  input.remove();
  send(surface, 'touchstart', fingers);
  send(surface, 'touchend', []);
  view.unmount();
});

it('cancels delayed native font loading when the rich text node unmounts', async () => {
  const { studio, frame } = fixture();
  const text = createStudioNodeFromElement(
    element('text', {
      text: 'Delayed fonts',
      font: 'Inter',
      x: 80,
      y: 100,
      width: 200,
      height: 80,
    }),
    frame.id,
    1
  );
  studio.nodes.push(text);
  const original = document.fonts.load.bind(document.fonts);
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const load = vi.spyOn(document.fonts, 'load').mockImplementation(async (...args) => {
    await gate;
    return original(...args);
  });
  const view = render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        fit="contain"
      />
    </div>
  );
  expect(load).toHaveBeenCalledWith(expect.stringContaining('400'));
  expect(load).toHaveBeenCalledWith(expect.stringContaining('700'));
  expect(load).toHaveBeenCalledWith(expect.stringContaining('italic'));
  view.unmount();
  await act(async () => {
    release();
    await Promise.all(load.mock.results.map(result => result.value));
  });
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  expect(Konva.stages.every(stage => !stage.container().isConnected)).toBe(true);
});

it('opens selected text and clears selections from the keyboard-focusable canvas', async () => {
  const { studio, frame, shape } = fixture();
  const text = createStudioNodeFromElement(
    element('text', { text: 'Keyboard text', x: 180, y: 130, width: 200, height: 100 }),
    frame.id,
    2
  );
  studio.nodes.push(text);
  function Harness() {
    const [selected, select] = useState([shape.id]);
    return (
      <div style={{ width: 700, height: 500 }}>
        <button onClick={() => select([text.id])}>Choose text</button>
        <KonvaStudioCanvas
          document={studio}
          activeFrameId={frame.id}
          assets={[]}
          selected={selected}
          selectExact={select}
          editable
          fit="contain"
        />
        <output data-testid="keyboard-selection">{selected.join(',')}</output>
      </div>
    );
  }
  render(<Harness />);
  const host = screen.getByTestId('studio-canvas');
  host.focus();
  expect(document.activeElement).toBe(host);
  expect(host.tabIndex).toBe(0);
  await userEvent.keyboard('{Escape}');
  expect(screen.getByTestId('keyboard-selection')).toHaveTextContent('');
  await userEvent.click(screen.getByRole('button', { name: 'Choose text' }));
  await userEvent.keyboard('{Tab}{Enter}');
  const editor = await screen.findByLabelText('Text');
  await waitFor(() => expect(document.activeElement).toBe(editor));
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByLabelText('Text')).toBeNull());
  expect(screen.getByTestId('keyboard-selection')).toHaveTextContent(text.id);
});

it('fails stale focus handles safely after unmount and still returns finite scene coordinates', async () => {
  const { studio, frame, shape } = fixture();
  const ref = createRef<StudioCanvasHandle>();
  const view = render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        fit="contain"
      />
    </div>
  );
  await waitFor(() => expect(stage().width()).toBe(700));
  const handle = ref.current!;
  view.unmount();
  await expect(handle.execute({ type: 'focus', nodeId: shape.id })).rejects.toThrow(
    'Canvas unavailable'
  );
  const point = handle.scenePoint(100000, 100000);
  expect(Number.isFinite(point.x)).toBe(true);
  expect(Number.isFinite(point.y)).toBe(true);
  expect(point.targetFrameId).toBeNull();
});

it('rejects focus when an overlay covers the entire canvas viewport', async () => {
  const { studio, frame, shape } = fixture();
  const ref = createRef<StudioCanvasHandle>();
  render(
    <div style={{ width: 700, height: 500, position: 'relative' }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        fit="contain"
      />
      <div data-canvas-focus-occluder style={{ position: 'absolute', inset: 0 }}>
        Covered
      </div>
    </div>
  );
  await expect(ref.current!.execute({ type: 'focus', nodeId: shape.id })).rejects.toThrow(
    'No free canvas area'
  );
});

it('shows an error for a decoded image without usable natural dimensions', async () => {
  const { studio, frame } = fixture();
  const id = crypto.randomUUID();
  const media = createStudioNodeFromElement(
    element('image', { assetId: id, x: 40, y: 50, width: 100, height: 90 }),
    frame.id,
    1
  );
  studio.nodes.push(media);
  const ref = createRef<StudioCanvasHandle>();
  const url = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"/>')}`;
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[{ id, name: 'empty.svg', mime: 'image/svg+xml', url }]}
        selected={[media.id]}
        editable
        fit="contain"
      />
    </div>
  );
  await act(async () => {
    await ref.current!.execute({ type: 'crop', action: 'start' });
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Media could not be loaded.');
  expect(screen.queryByRole('toolbar', { name: 'Crop' })).toBeNull();
});

it.each(['resize', 'drag'])(
  'cancels an active native %s when a second finger starts a canvas gesture',
  async mode => {
    const { studio, frame, shape } = fixture();
    shape.transform.flipX = true;
    shape.transform.flipY = true;
    const changes = vi.fn();
    const select = vi.fn();
    render(
      <div style={{ width: 700, height: 500 }}>
        <KonvaStudioCanvas
          document={studio}
          activeFrameId={frame.id}
          assets={[]}
          selected={[shape.id]}
          selectExact={select}
          applyCanvasChanges={changes}
          editable
        />
      </div>
    );
    const transformer = stage().findOne<Konva.Transformer>('Transformer')!;
    await waitFor(() => expect(transformer.nodes()).toHaveLength(1));
    const group = stage().findOne<Konva.Group>(`#${shape.id}`)!;
    const target = mode === 'resize' ? transformer.findOne('.bottom-right')! : group;
    const local =
      mode === 'resize' ? { x: target.width() / 2, y: target.height() / 2 } : { x: 50, y: 40 };
    await waitFor(() =>
      expect(stage().getIntersection(target.getAbsoluteTransform().point(local))).toBe(
        mode === 'resize' ? target : group.findOne('Rect')
      )
    );
    const point = canvasPoint(target, local);
    const rect = point.surface.getBoundingClientRect();
    const iframe = window.frameElement as HTMLElement | null;
    const offset = iframe?.getBoundingClientRect();
    const scaleX = iframe && offset ? offset.width / iframe.offsetWidth : 1;
    const scaleY = iframe && offset ? offset.height / iframe.offsetHeight : 1;
    const x = (rect.left + point.x) * scaleX + (offset?.left ?? 0);
    const y = (rect.top + point.y) * scaleY + (offset?.top ?? 0);
    const session = cdp();
    await session.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      buttons: 1,
    });
    try {
      await session.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: x + 30 * scaleX,
        y: y + 20 * scaleY,
        button: 'left',
        buttons: 1,
      });
      await waitFor(() =>
        expect(mode === 'resize' ? transformer.isTransforming() : group.isDragging()).toBe(true)
      );
      const fingers = [
        new Touch({
          identifier: 1,
          target: point.surface,
          clientX: rect.left + point.x,
          clientY: rect.top + point.y,
        }),
        new Touch({
          identifier: 2,
          target: point.surface,
          clientX: rect.left + point.x + 100,
          clientY: rect.top + point.y,
        }),
      ];
      point.surface.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: fingers,
          targetTouches: fingers,
          changedTouches: fingers,
          bubbles: true,
          cancelable: true,
        })
      );
      expect(transformer.isTransforming()).toBe(false);
      expect(group.isDragging()).toBe(false);
      expect(changes).not.toHaveBeenCalled();
      expect(group.position()).toEqual({
        x: shape.transform.x + shape.transform.width / 2,
        y: shape.transform.y + shape.transform.height / 2,
      });
      expect(group.scale()).toEqual({ x: -1, y: -1 });
      point.surface.dispatchEvent(
        new TouchEvent('touchend', {
          touches: [],
          changedTouches: fingers,
          bubbles: true,
          cancelable: true,
        })
      );
    } finally {
      await session.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        buttons: 0,
      });
    }
  }
);

it('delegates element-set drops only when editing and the supported payload are available', async () => {
  const { studio, frame } = fixture();
  const ref = createRef<StudioCanvasHandle>();
  const drop = vi.fn();
  const wrap = (editable: boolean, callback = true) => (
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={editable}
        onElementSetDrop={callback ? drop : undefined}
      />
    </div>
  );
  const view = render(wrap(true));
  const host = screen.getByTestId('studio-canvas');
  await waitFor(() => expect(stage().width()).toBe(700));
  const dataTransfer = new DataTransfer();
  dataTransfer.setData('application/x-polity-element-set', 'native-element-set');
  const rect = host.getBoundingClientRect();
  const point = { clientX: rect.left + 240, clientY: rect.top + 200 };
  const send = (type: string, dataTransfer: DataTransfer) =>
    host.dispatchEvent(
      new DragEvent(type, { dataTransfer, ...point, bubbles: true, cancelable: true })
    );
  expect(send('dragover', dataTransfer)).toBe(false);
  expect(send('drop', dataTransfer)).toBe(false);
  expect(drop).toHaveBeenCalledExactlyOnceWith(
    'native-element-set',
    ref.current!.scenePoint(point.clientX, point.clientY)
  );
  const unsupported = new DataTransfer();
  unsupported.setData('text/plain', 'native-element-set');
  expect(send('dragover', unsupported)).toBe(true);
  expect(send('drop', unsupported)).toBe(true);
  for (const options of [
    [false, true],
    [true, false],
  ]) {
    view.rerender(wrap(options[0], options[1]));
    expect(send('dragover', dataTransfer)).toBe(true);
    expect(send('drop', dataTransfer)).toBe(true);
  }
  expect(drop).toHaveBeenCalledTimes(1);
});

it('awaits clipboard commands and propagates failures while missing delegates remain safe', async () => {
  const { studio, frame } = fixture();
  const ref = createRef<StudioCanvasHandle>();
  let complete!: () => void;
  const gate = new Promise<void>(resolve => {
    complete = resolve;
  });
  const clipboard = vi
    .fn()
    .mockImplementationOnce(() => gate)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('Clipboard permission denied'));
  const wrap = (callback = true) => (
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable
        onClipboard={callback ? clipboard : undefined}
      />
    </div>
  );
  const view = render(wrap());
  let done = false;
  const copy = ref.current!.execute({ type: 'clipboard', action: 'copy' }).then(() => {
    done = true;
  });
  await Promise.resolve();
  expect(done).toBe(false);
  complete();
  await copy;
  expect(done).toBe(true);
  await ref.current!.execute({ type: 'clipboard', action: 'cut' });
  await expect(ref.current!.execute({ type: 'clipboard', action: 'paste' })).rejects.toThrow(
    'Clipboard permission denied'
  );
  expect(clipboard.mock.calls.map(([action]) => action)).toEqual(['copy', 'cut', 'paste']);
  view.rerender(wrap(false));
  await expect(
    ref.current!.execute({ type: 'clipboard', action: 'copy' })
  ).resolves.toBeUndefined();
});

it('preserves the view when zoom-to-selection has no selected targets', async () => {
  const { studio, frame } = fixture();
  const ref = createRef<StudioCanvasHandle>();
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable
      />
    </div>
  );
  await waitFor(() => expect(stage().width()).toBe(700));
  await act(async () => {
    await ref.current!.execute({ type: 'zoom', mode: 'reset' });
  });
  const original = stage().getAbsoluteTransform().getMatrix();
  await act(async () => {
    await ref.current!.execute({ type: 'zoom', mode: 'selection' });
  });
  expect(stage().getAbsoluteTransform().getMatrix()).toEqual(original);
});

it('renders text when the font loading API is unavailable', async () => {
  const { studio, frame } = fixture();
  const text = createStudioNodeFromElement(
    element('text', { text: 'Font fallback', x: 80, y: 100, width: 200, height: 80 }),
    frame.id,
    1
  );
  studio.nodes.push(text);
  vi.spyOn(document, 'fonts', 'get').mockReturnValue(undefined as unknown as FontFaceSet);
  const view = render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        fit="contain"
      />
    </div>
  );
  await waitFor(() =>
    expect(stage().findOne<Konva.Group>(`#${text.id}`)?.findOne('Shape')).toBeTruthy()
  );
  expect(stage().toCanvas().toDataURL()).toMatch(/^data:image\/png/);
  view.unmount();
});

it('opens media cropping on native double-click and pans its source inside the frame', async () => {
  const { studio, frame } = fixture();
  const assetId = crypto.randomUUID();
  const media = createStudioNodeFromElement(
    element('image', { assetId, x: 120, y: 110, width: 160, height: 100 }),
    frame.id,
    1
  );
  studio.nodes.push(media);
  const url = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="red"/></svg>')}`;
  const commit = vi.fn();
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[{ id: assetId, name: 'red.svg', mime: 'image/svg+xml', url }]}
        selected={[media.id]}
        editable
        fit="contain"
        onCropCommit={commit}
      />
    </div>
  );
  const group = stage().findOne<Konva.Group>(`#${media.id}`)!;
  await waitFor(() => expect(group.findOne('Image')).toBeTruthy());
  await waitFor(() => {
    expect(stage().width()).toBe(700);
    expect(stage().getIntersection(group.getAbsoluteTransform().point({ x: 80, y: 50 }))).toBe(
      group.findOne('Image')
    );
  });
  const point = canvasPoint(group, { x: 80, y: 50 });
  await userEvent.dblClick(point.surface, { position: { x: point.x, y: point.y } } as never);
  await screen.findByRole('toolbar', { name: 'Crop' });
  const slider = screen.getByRole<HTMLInputElement>('slider');
  slider.focus();
  await userEvent.keyboard('{End}');
  const cropX = Number(screen.getByRole('toolbar', { name: 'Crop' }).getAttribute('data-crop-x'));
  const overlay = group.find('Rect').find(node => node.getAttr('opacity') === 0.08)!;
  const observed = vi.fn();
  overlay.on('pointerdown', observed);
  await waitFor(() =>
    expect(stage().getIntersection(overlay.getAbsoluteTransform().point({ x: 80, y: 50 }))).toBe(
      overlay
    )
  );
  const drag = canvasPoint(overlay, { x: 80, y: 50 });
  await userEvent.dragAndDrop(drag.surface, drag.surface, {
    sourcePosition: { x: drag.x, y: drag.y },
    targetPosition: { x: drag.x + 10, y: drag.y + 5 },
  } as never);
  expect(observed).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(
      Number(screen.getByRole('toolbar', { name: 'Crop' }).getAttribute('data-crop-x'))
    ).not.toBe(cropX)
  );
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(commit).toHaveBeenCalledTimes(1);
});

it('filters missing, hidden, distant and other-frame proposal references while drawing neutral update ghosts', async () => {
  const { studio, frame, shape } = fixture();
  const source = structuredClone(studio);
  const ghost = {
    ...structuredClone(shape),
    id: crypto.randomUUID(),
    parentFrameId: crypto.randomUUID(),
    transform: { ...shape.transform, x: 220, y: 140, flipX: true, flipY: true },
  };
  source.nodes.push(ghost);
  const hidden = { ...structuredClone(shape), id: crypto.randomUUID(), visible: false };
  const distant = [
    [-10000, 0],
    [0, -10000],
    [10000, 0],
    [0, 10000],
  ].map(([x, y]) => ({
    ...structuredClone(shape),
    id: crypto.randomUUID(),
    transform: { ...shape.transform, x, y },
  }));
  source.nodes.push(hidden, ...distant);
  const marker = (nodeId: string, selected = false): StudioChangeRequestAnnotation => ({
    id: nodeId,
    proposalId: 'request-update',
    nodeId,
    selected,
    label: 'Neutral change',
    tone: 'update',
    sourceDocument: source,
  });
  const annotations = [
    marker(ghost.id),
    marker(hidden.id),
    marker(crypto.randomUUID()),
    ...distant.map(node => marker(node.id)),
  ];
  const selected = vi.fn();
  const view = render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable
        changeRequestMarkers={annotations}
        onChangeRequestSelect={selected}
      />
    </div>
  );
  const outline = await screen.findByTestId(`studio-change-outline-${ghost.id}`);
  expect(outline.dataset.changeRequestGhost).toBe('true');
  expect(outline.style.border).toContain('rgb(245, 158, 11)');
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Neutral change' })).toHaveLength(1)
  );
  const button = screen.getByRole('button', { name: 'Neutral change' });
  button.focus();
  await userEvent.keyboard('{Enter}');
  expect(selected).toHaveBeenCalledExactlyOnceWith('request-update');
  view.rerender(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable={false}
        fit="contain"
        changeRequestMarkers={annotations}
      />
    </div>
  );
  expect(screen.queryByTestId(`studio-change-outline-${ghost.id}`)).toBeNull();
});

function doubleTap(node: Konva.Node, local: { x: number; y: number }) {
  const point = canvasPoint(node, local);
  const rect = point.surface.getBoundingClientRect();
  for (const identifier of [1, 2]) {
    const touch = new Touch({
      identifier,
      target: point.surface,
      clientX: rect.left + point.x,
      clientY: rect.top + point.y,
    });
    point.surface.dispatchEvent(
      new TouchEvent('touchstart', {
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
        bubbles: true,
        cancelable: true,
      })
    );
    point.surface.dispatchEvent(
      new TouchEvent('touchend', {
        touches: [],
        targetTouches: [],
        changedTouches: [touch],
        bubbles: true,
        cancelable: true,
      })
    );
  }
}

it('opens text after a native double tap and keeps inline pointer selection inside the editor', async () => {
  const { studio, frame } = fixture();
  const text = createStudioNodeFromElement(
    element('text', { text: 'Double tap text', x: 180, y: 130, width: 200, height: 100 }),
    frame.id,
    2
  );
  studio.nodes.push(text);
  const select = vi.fn();
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[text.id]}
        selectExact={select}
        editable
        fit="contain"
      />
    </div>
  );
  const group = stage().findOne<Konva.Group>(`#${text.id}`)!;
  await waitFor(() =>
    expect(
      stage()
        .getIntersection(group.getAbsoluteTransform().point({ x: 80, y: 30 }))
        ?.getParent()
    ).toBe(group)
  );
  doubleTap(group, { x: 80, y: 30 });
  const editor = await screen.findByLabelText('Text');
  expect(select).toHaveBeenCalledWith([text.id]);
  select.mockClear();
  await userEvent.click(editor);
  expect(select).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(editor);
  await userEvent.keyboard('!');
  expect(editor).toHaveTextContent('!');
});

it('opens media cropping after a native double tap and cancels it with the canvas keyboard', async () => {
  const { studio, frame } = fixture();
  const assetId = crypto.randomUUID();
  const media = createStudioNodeFromElement(
    element('image', { assetId, x: 120, y: 110, width: 160, height: 100 }),
    frame.id,
    1
  );
  studio.nodes.push(media);
  const url = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="red"/></svg>')}`;
  const commit = vi.fn();
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={studio}
        activeFrameId={frame.id}
        assets={[{ id: assetId, name: 'red.svg', mime: 'image/svg+xml', url }]}
        selected={[media.id]}
        editable
        fit="contain"
        onCropCommit={commit}
      />
    </div>
  );
  const group = stage().findOne<Konva.Group>(`#${media.id}`)!;
  await waitFor(() => expect(group.findOne('Image')).toBeTruthy());
  await waitFor(() =>
    expect(
      stage()
        .getIntersection(group.getAbsoluteTransform().point({ x: 80, y: 50 }))
        ?.findAncestor(`#${media.id}`)
    ).toBe(group)
  );
  doubleTap(group, { x: 80, y: 50 });
  await screen.findByRole('toolbar', { name: 'Crop' });
  screen.getByTestId('studio-canvas').focus();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('toolbar', { name: 'Crop' })).toBeNull();
  expect(commit).not.toHaveBeenCalled();
});

it('erases a node with native pointer activation and tolerates a missing delete delegate', async () => {
  const { studio, frame, shape } = fixture();
  const ref = createRef<StudioCanvasHandle>();
  const remove = vi.fn();
  const wrap = (callback = true) => (
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={studio}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable
        fit="contain"
        onDeleteNodes={callback ? remove : undefined}
      />
    </div>
  );
  const view = render(wrap());
  await act(async () => {
    await ref.current!.execute({ type: 'setTool', tool: 'eraser' });
  });
  const node = stage().findOne<Konva.Group>(`#${shape.id}`)!;
  await waitFor(() =>
    expect(
      stage()
        .getIntersection(node.getAbsoluteTransform().point({ x: 50, y: 40 }))
        ?.getParent()
    ).toBe(node)
  );
  const point = canvasPoint(node, { x: 50, y: 40 });
  await userEvent.click(point.surface, { position: { x: point.x, y: point.y } } as never);
  expect(remove).toHaveBeenCalledExactlyOnceWith([shape.id]);
  view.rerender(wrap(false));
  await userEvent.click(point.surface, { position: { x: point.x, y: point.y } } as never);
  expect(remove).toHaveBeenCalledTimes(1);
});
