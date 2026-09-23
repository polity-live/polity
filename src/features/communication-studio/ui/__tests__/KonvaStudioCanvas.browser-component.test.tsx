import { useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defaultBrand } from '../../logic/document';
import { applyStudioCommandV3 } from '../../logic/commands-v3';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import { createElementSetSnapshot, instantiateElementSet } from '../../logic/element-library';
import { worldBounds, worldToLocalPoint } from '../../logic/selection-geometry';
import type { StudioDocumentV5 } from '../../logic/document-v3';
import KonvaStudioCanvas, { type StudioCanvasHandle } from '../KonvaStudioCanvas';
import { StudioLayersPanel } from '../StudioLayersPanel';
import { StudioPanel } from '../StudioPanel';
import { openStudioPanel } from '../../logic/panel-events';

function fixture() {
  const document = createStudioTemplateDocumentV5('single', 'Layered text', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const title = document.nodes.find(node => node.type === 'richText' && node.zIndex === 1)!;
  const source = document.nodes.find(node => node.type === 'shape')!;
  const occluder = structuredClone(source);
  occluder.id = crypto.randomUUID();
  occluder.name = 'Occluder';
  occluder.transform = {
    x: 250,
    y: 260,
    width: 260,
    height: 140,
    rotation: 0,
    flipX: false,
    flipY: false,
  };
  occluder.zIndex = 5;
  occluder.style.fill = '#FF0000';
  occluder.style.stroke = null;
  occluder.style.strokeWidth = 0;
  document.nodes.push(occluder);
  return { document, frame, title, occluder };
}

function pixel(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((clientX - rect.left) * canvas.width) / rect.width);
  const y = Math.floor(((clientY - rect.top) * canvas.height) / rect.height);
  return [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data];
}

it('selects a whole group from the canvas and toggles it as one selection with Shift', async () => {
  const { document, frame, title, occluder } = fixture();
  let canvasZoom = 1;
  const other = document.nodes.find(node => node.type === 'shape' && node.id !== occluder.id)!;
  const groupId = crypto.randomUUID();
  title.groupIds = [groupId];
  occluder.groupIds = [groupId];
  title.transform = { ...title.transform, x: 80, y: 80, width: 120, height: 60 };
  occluder.transform = { ...occluder.transform, x: 280, y: 80, width: 120, height: 60 };
  other.transform = { ...other.transform, x: 480, y: 80, width: 120, height: 60 };

  function Harness() {
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <div style={{ width: '100vw', height: '100vh' }}>
        <KonvaStudioCanvas
          document={document}
          activeFrameId={frame.id}
          fit="contain"
          assets={[]}
          selected={selected}
          selectExact={setSelected}
          editable
          guides={false}
          onCanvasStateChange={state => {
            canvasZoom = state.zoom;
          }}
        />
        <output data-testid="selected-ids">{selected.join(',')}</output>
      </div>
    );
  }

  render(<Harness />);
  const canvas = await screen.findByTestId('studio-canvas');
  await waitFor(() => expect(canvas.querySelector('.konvajs-content canvas')).toBeTruthy());
  const stage = canvas.querySelector<HTMLElement>('.konvajs-content')!;
  const frameBounds = worldBounds(document, frame);
  await waitFor(() => {
    const bounds = stage.getBoundingClientRect();
    expect(canvasZoom).toBeCloseTo(
      Math.min(
        4,
        (bounds.width - 64) / (frameBounds.right - frameBounds.left),
        (bounds.height - 64) / (frameBounds.bottom - frameBounds.top)
      ),
      3
    );
  });
  const surface = stage.querySelector<HTMLCanvasElement>('canvas')!;
  const click = (id: string, shiftKey = false) => {
    const node = document.nodes.find(candidate => candidate.id === id)!;
    const nodeBounds = worldBounds(document, node);
    const bounds = stage.getBoundingClientRect();
    const zoom = canvasZoom;
    const clientX =
      bounds.left +
      bounds.width / 2 +
      ((nodeBounds.left + nodeBounds.right) / 2 - (frameBounds.left + frameBounds.right) / 2) *
        zoom;
    const clientY =
      bounds.top +
      bounds.height / 2 +
      ((nodeBounds.top + nodeBounds.bottom) / 2 - (frameBounds.top + frameBounds.bottom) / 2) *
        zoom;
    fireEvent.mouseDown(surface, { clientX, clientY, shiftKey });
    fireEvent.mouseUp(surface, { clientX, clientY, shiftKey });
    fireEvent.click(surface, { clientX, clientY, shiftKey });
  };

  click(occluder.id);
  expect(screen.getByTestId('selected-ids').textContent?.split(',').sort()).toEqual(
    [title.id, occluder.id].sort()
  );
  click(other.id, true);
  expect(screen.getByTestId('selected-ids').textContent?.split(',').sort()).toEqual(
    [title.id, occluder.id, other.id].sort()
  );
  click(occluder.id, true);
  expect(screen.getByTestId('selected-ids')).toHaveTextContent(other.id);
});

it('focuses a new text node as soon as it reaches the canvas document', async () => {
  const { document: initial, frame, title } = fixture();
  const ref = { current: null as StudioCanvasHandle | null };
  const fresh = structuredClone(title);
  if (fresh.type !== 'richText') throw new Error('Expected a rich text fixture');
  fresh.id = crypto.randomUUID();
  fresh.content = [
    { id: crypto.randomUUID(), type: 'p', children: [{ id: crypto.randomUUID(), text: '' }] },
  ];
  fresh.transform = { ...fresh.transform, x: 100, y: 100 };
  function Harness() {
    const [document, setDocument] = useState(initial);
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <div style={{ width: 700, height: 500 }}>
        <KonvaStudioCanvas
          ref={ref}
          document={document}
          activeFrameId={frame.id}
          assets={[]}
          selected={selected}
          selectExact={setSelected}
          editable
          onCreateNode={() => {
            setDocument(current => ({ ...current, nodes: [...current.nodes, fresh] }));
            return fresh.id;
          }}
          onTextChange={(id, content) =>
            setDocument(current => ({
              ...current,
              nodes: current.nodes.map(node =>
                node.id === id && node.type === 'richText' ? { ...node, content } : node
              ),
            }))
          }
        />
      </div>
    );
  }
  render(<Harness />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  await act(async () => {
    await ref.current!.execute({ type: 'setTool', tool: 'text' });
  });
  const host = screen.getByTestId('studio-canvas');
  const surface = [...host.querySelectorAll<HTMLCanvasElement>('.konvajs-content canvas')].at(-1)!;
  await userEvent.dragAndDrop(surface, surface, {
    sourcePosition: { x: 140, y: 140 },
    targetPosition: { x: 190, y: 180 },
  } as never);
  await userEvent.keyboard('Hallo');
  const editor = await screen.findByLabelText('Text');
  await waitFor(() => expect(document.activeElement).toBe(editor));
  await waitFor(() => expect(editor).toHaveTextContent('Hallo'));
});

it('lets a user type into an existing text node after one click', async () => {
  const { document: initial, frame, title } = fixture();
  let zoom = 1;
  function Harness() {
    const [document, setDocument] = useState(initial);
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <div style={{ width: 700, height: 500 }}>
        <KonvaStudioCanvas
          document={document}
          activeFrameId={frame.id}
          fit="contain"
          assets={[]}
          selected={selected}
          selectExact={setSelected}
          onTextChange={(id, content) =>
            setDocument(current => ({
              ...current,
              nodes: current.nodes.map(node =>
                node.id === id && node.type === 'richText' ? { ...node, content } : node
              ),
            }))
          }
          onCanvasStateChange={state => {
            zoom = state.zoom;
          }}
          editable
        />
        <output data-testid="selected-ids">{selected.join(',')}</output>
      </div>
    );
  }
  render(<Harness />);
  const host = screen.getByTestId('studio-canvas');
  await waitFor(() => expect(host.querySelectorAll('.konvajs-content canvas').length).toBe(2));
  await waitFor(() => expect(zoom).toBeLessThan(1));
  const surface = [...host.querySelectorAll<HTMLCanvasElement>('.konvajs-content canvas')].at(-1)!;
  const stageBounds = surface.getBoundingClientRect();
  const frameBounds = worldBounds(initial, frame);
  const titleBounds = worldBounds(initial, title);
  const x =
    stageBounds.width / 2 +
    (titleBounds.left + 30 - (frameBounds.left + frameBounds.right) / 2) * zoom;
  const y =
    stageBounds.height / 2 +
    (titleBounds.top + 30 - (frameBounds.top + frameBounds.bottom) / 2) * zoom;
  await userEvent.click(surface, { position: { x, y } } as never);
  expect(screen.getByTestId('selected-ids')).toHaveTextContent(title.id);
  const editor = await screen.findByLabelText('Text');
  await waitFor(() => expect(document.activeElement).toBe(editor));
  await userEvent.keyboard('Hallo');
  await waitFor(() => expect(editor).toHaveTextContent('Hallo'));
});

it('keeps the contextual toolbar above the selected node while the canvas pans', async () => {
  const { document, frame, title } = fixture();
  const view = render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={document}
        activeFrameId={frame.id}
        assets={[]}
        selected={[title.id]}
        editable
        contextToolbar={<button type="button">Action</button>}
        contextToolbarLabel="Element actions"
      />
    </div>
  );
  const toolbar = await screen.findByRole('toolbar', { name: 'Element actions' });
  await waitFor(() => expect(Number.parseFloat(toolbar.style.left)).toBeGreaterThan(0));
  const initialLeft = Number.parseFloat(toolbar.style.left);
  const host = screen.getByTestId('studio-canvas');
  const surface = host.querySelector<HTMLCanvasElement>('.konvajs-content canvas')!;
  fireEvent.wheel(surface, { deltaX: 40, deltaY: 0 });
  await waitFor(() => expect(Number.parseFloat(toolbar.style.left)).toBeLessThan(initialLeft));
  expect(Number.parseFloat(toolbar.style.left) + toolbar.offsetWidth).toBeLessThanOrEqual(
    host.clientWidth - 8
  );
  view.rerender(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={document}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable
        contextToolbar={null}
      />
    </div>
  );
  expect(screen.queryByRole('toolbar', { name: 'Element actions' })).toBeNull();
});

it('reorders shape, text, shape in Layers and preserves occlusion during direct Plate editing', async () => {
  const { document: initial, frame, title, occluder } = fixture();
  function Harness() {
    const [document, setDocument] = useState<StudioDocumentV5>(initial);
    return (
      <div style={{ width: '100vw', height: '100vh' }}>
        <StudioLayersPanel
          document={document}
          selectedNodeIds={[title.id]}
          disabled={false}
          tr={key => key}
          onSelect={() => undefined}
          onSetVisibility={() => undefined}
          onSetLocked={() => undefined}
          onMove={(nodeId, targetId, position) =>
            setDocument(current =>
              applyStudioCommandV3(current, {
                type: 'moveNode',
                nodeId,
                targetId,
                position,
              })
            )
          }
        />
        <KonvaStudioCanvas
          document={document}
          activeFrameId={frame.id}
          fit="contain"
          assets={[]}
          selected={[title.id]}
          selectExact={() => undefined}
          onTextChange={(id, content) =>
            setDocument(current => ({
              ...current,
              nodes: current.nodes.map(node =>
                node.id === id && node.type === 'richText' ? { ...node, content } : node
              ),
            }))
          }
          editable
          guides={false}
        />
      </div>
    );
  }
  render(<Harness />);
  const layer = (id: string) =>
    document.querySelector<HTMLElement>(`[data-studio-layer-id="${id}"]`)!;
  const drag = (position: 'before' | 'after') => {
    const source = layer(occluder.id);
    const target = layer(title.id);
    const bounds = target.getBoundingClientRect();
    const dataTransfer = new DataTransfer();
    const clientY = position === 'before' ? bounds.top + 1 : bounds.bottom - 1;
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer, clientY });
    fireEvent.drop(target, { dataTransfer, clientY });
  };
  await waitFor(() =>
    expect([...screen.getByTestId('studio-canvas').querySelectorAll('canvas')]).toHaveLength(2)
  );
  expect(
    layer(occluder.id).compareDocumentPosition(layer(title.id)) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  fireEvent.keyDown(screen.getByTestId('studio-canvas'), { key: 'Enter' });
  const editor = await screen.findByLabelText('Text');
  const overlapPoint = () => {
    const textBox = editor.getBoundingClientRect();
    const scale = textBox.width / title.transform.width;
    return {
      x: textBox.left + (occluder.transform.x - title.transform.x + 30) * scale,
      y: textBox.top + (occluder.transform.y - title.transform.y + 40) * scale,
    };
  };
  const canvases = () => [...screen.getByTestId('studio-canvas').querySelectorAll('canvas')];
  await waitFor(() => expect(canvases()).toHaveLength(3));
  await waitFor(() => {
    const { x, y } = overlapPoint();
    expect(pixel(canvases()[1], x, y)).toEqual([255, 0, 0, 255]);
  });
  expect(canvases()[1].style.zIndex).toBe('2');
  expect(document.querySelector('[data-testid="studio-inline-text-layer"]')).toBeTruthy();

  drag('after');
  await waitFor(() => {
    const { x, y } = overlapPoint();
    expect(pixel(canvases()[1], x, y)[3]).toBe(0);
    expect(pixel(canvases()[0], x, y)).toEqual([255, 0, 0, 255]);
  });
  expect(
    layer(title.id).compareDocumentPosition(layer(occluder.id)) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  drag('before');
  await waitFor(() => {
    const { x, y } = overlapPoint();
    expect(pixel(canvases()[1], x, y)).toEqual([255, 0, 0, 255]);
  });
  expect(editor.textContent).toContain('Layered text');
});

it('keeps selected text properties available while editing and lets the panel collapse', async () => {
  const { document: scene, frame, title } = fixture();
  render(
    <div style={{ width: '100vw', height: '100vh' }}>
      <KonvaStudioCanvas
        document={scene}
        activeFrameId={frame.id}
        fit="contain"
        assets={[]}
        selected={[title.id]}
        editable
        inspector={
          <>
            <input aria-label="Font size" defaultValue="42" />
            <div style={{ height: 2000 }} />
          </>
        }
        inspectorLabels={{
          title: 'Properties',
          collapse: 'Collapse properties',
          expand: 'Expand properties',
          move: 'Move properties',
        }}
      />
    </div>
  );
  const panel = await screen.findByRole('complementary', { name: 'Properties' });
  expect(panel.getBoundingClientRect().height).toBeLessThanOrEqual(window.innerHeight / 2 + 1);
  expect(screen.getByRole('textbox', { name: 'Font size' })).toBeTruthy();
  fireEvent.keyDown(screen.getByTestId('studio-canvas'), { key: 'Enter' });
  await screen.findByLabelText('Text');
  expect(screen.getByRole('complementary', { name: 'Properties' })).toBe(panel);
  fireEvent.click(screen.getByRole('button', { name: 'Collapse properties' }));
  expect(panel.getAttribute('data-collapsed')).toBe('true');
  expect(screen.queryByRole('textbox', { name: 'Font size' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Expand properties' }));
  expect(panel.getAttribute('data-collapsed')).toBe('false');
  expect(screen.getByRole('textbox', { name: 'Font size' })).toBeTruthy();
  const canvas = screen.getByTestId('studio-canvas');
  const handle = screen.getByRole('button', { name: 'Move properties' });
  const start = handle.getBoundingClientRect();
  const bounds = canvas.getBoundingClientRect();
  fireEvent.pointerDown(handle, {
    pointerId: 7,
    button: 0,
    clientX: start.left + 20,
    clientY: start.top + 20,
  });
  fireEvent.pointerMove(window, {
    pointerId: 7,
    clientX: start.left + 180,
    clientY: bounds.bottom - 24,
  });
  fireEvent.pointerUp(window, { pointerId: 7 });
  await waitFor(() => expect(panel.getAttribute('data-expand-direction')).toBe('up'));
  const header = panel.querySelector('.polity-canvas-properties-header')!;
  const body = panel.querySelector('.polity-canvas-properties-body')!;
  expect(body.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    header.getBoundingClientRect().top + 1
  );
  expect(panel.getBoundingClientRect().top).toBeGreaterThanOrEqual(bounds.top - 1);
  expect(panel.getBoundingClientRect().bottom).toBeLessThanOrEqual(bounds.bottom + 1);
  expect(panel.getBoundingClientRect().left).toBeGreaterThan(start.left + 20);
  expect(panel.getBoundingClientRect().right).toBeLessThanOrEqual(bounds.right + 1);
  const leftBeforeKeyboardMove = panel.getBoundingClientRect().left;
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  expect(panel.getBoundingClientRect().left).toBeLessThan(leftBeforeKeyboardMove);
  const headerTop = header.getBoundingClientRect().top;
  fireEvent.click(screen.getByRole('button', { name: 'Collapse properties' }));
  expect(Math.abs(header.getBoundingClientRect().top - headerTop)).toBeLessThanOrEqual(1);
  fireEvent.click(screen.getByRole('button', { name: 'Expand properties' }));
  expect(Math.abs(header.getBoundingClientRect().top - headerTop)).toBeLessThanOrEqual(1);
  expect(panel.getAttribute('data-expand-direction')).toBe('up');
});

it('drops an Elements row onto a zoomed canvas and places its visible copy inside a shifted frame', async () => {
  const { document: initial, frame, occluder } = fixture();
  frame.transform.x = 320;
  frame.transform.y = 180;
  const setId = crypto.randomUUID();
  const snapshot = createElementSetSnapshot(initial, [occluder.id]);
  const drops: { x: number; y: number; targetFrameId: string | null }[] = [];
  function Harness() {
    const [document, setDocument] = useState<StudioDocumentV5>(initial);
    const canvasRef = useRef<StudioCanvasHandle>(null);
    return (
      <div style={{ width: '100vw', height: '100vh' }}>
        <div
          draggable
          data-testid="element-source"
          onDragStart={event => {
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('application/x-polity-element-set', setId);
          }}
        >
          Saved element
        </div>
        <KonvaStudioCanvas
          ref={canvasRef}
          document={document}
          activeFrameId={frame.id}
          fit="contain"
          assets={[]}
          selected={[]}
          editable
          guides={false}
          onElementSetDrop={(receivedId, point) => {
            expect(receivedId).toBe(setId);
            drops.push(point);
            const local = worldToLocalPoint(document, point.targetFrameId, point);
            const copy = instantiateElementSet(snapshot, {
              setId,
              revisionId: crypto.randomUUID(),
              targetFrameId: point.targetFrameId,
              x: local.x,
              y: local.y,
              zIndex: 10,
            });
            setDocument(current => ({
              ...current,
              nodes: [...current.nodes, ...copy.nodes],
              componentInstances: [...current.componentInstances, copy.instance],
            }));
          }}
        />
        <button onClick={() => void canvasRef.current?.execute({ type: 'zoom', mode: 'in' })}>
          Zoom in
        </button>
      </div>
    );
  }
  render(<Harness />);
  const canvas = await screen.findByTestId('studio-canvas');
  await waitFor(() => expect(canvas.querySelector('canvas')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
  const bounds = canvas.getBoundingClientRect();
  const clientX = bounds.left + bounds.width / 2;
  const clientY = bounds.top + bounds.height / 2;
  const dataTransfer = {
    types: ['application/x-polity-element-set'],
    effectAllowed: 'copy',
    dropEffect: 'none',
    getData: (type: string) => (type === 'application/x-polity-element-set' ? setId : ''),
  };
  const dragOver = new Event('dragover', { bubbles: true, cancelable: true });
  const drop = new Event('drop', { bubbles: true, cancelable: true });
  for (const event of [dragOver, drop])
    Object.defineProperties(event, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: clientX },
      clientY: { value: clientY },
    });
  canvas.querySelector('canvas')!.dispatchEvent(dragOver);
  expect(dragOver.defaultPrevented).toBe(true);
  canvas.querySelector('canvas')!.dispatchEvent(drop);
  await waitFor(() => expect(drops).toHaveLength(1));
  expect(drops[0].targetFrameId).toBe(frame.id);
  await waitFor(() => {
    const painted = [...canvas.querySelectorAll('canvas')].some(surface => {
      const rgba = pixel(surface, clientX + 25, clientY + 25);
      return rgba[0] === 255 && rgba[1] === 0 && rgba[2] === 0 && rgba[3] === 255;
    });
    expect(painted).toBe(true);
  });
});

it('drops a canvas node into the open Elements menu and moves normally elsewhere', async () => {
  const { document, frame, occluder } = fixture();
  occluder.transform.x = 600;
  occluder.transform.y = 720;
  const moves = vi.fn();
  const saves = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
  render(
    <div style={{ width: '100vw', height: '100vh' }}>
      <KonvaStudioCanvas
        document={document}
        activeFrameId={frame.id}
        fit="contain"
        assets={[]}
        selected={[occluder.id]}
        editable
        guides={false}
        onNodeDragEnd={saves}
        applyCanvasChanges={moves}
      />
      <nav
        data-navigation-type="secondary"
        style={{ position: 'fixed', top: 0, right: 0, width: 64, height: '100vh' }}
      >
        <button data-navigation-item-id="studio-elements">Elements</button>
      </nav>
      <StudioPanel
        panelKey="elements"
        label="Elements"
        toolbarTrigger={false}
        keepOpenOnCanvasInteraction
      >
        <section data-studio-elements-drop-zone style={{ width: 220, height: 200 }}>
          Drop selection here
        </section>
      </StudioPanel>
    </div>
  );
  const host = await screen.findByTestId('studio-canvas');
  openStudioPanel({
    panelKey: 'elements',
    origin: 'secondary-navigation',
    navigationItemId: 'studio-elements',
  });
  await screen.findByRole('dialog', { name: 'Elements' });
  const stage = host.querySelector<HTMLElement>('.konvajs-content')!;
  await waitFor(() => expect(stage.querySelector('canvas')).toBeTruthy());
  const painted = stage.querySelector('canvas')!;
  const { minX, maxX, minY, maxY } = await waitFor(() => {
    const image = painted.getContext('2d')!.getImageData(0, 0, painted.width, painted.height);
    let minX = painted.width;
    let maxX = 0;
    let minY = painted.height;
    let maxY = 0;
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        const index = (y * image.width + x) * 4;
        if (
          image.data[index] < 250 ||
          image.data[index + 1] > 5 ||
          image.data[index + 2] > 5 ||
          image.data[index + 3] < 250
        )
          continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    expect(maxX).toBeGreaterThan(minX);
    return { minX, maxX, minY, maxY };
  });
  const paintedBounds = painted.getBoundingClientRect();
  const startX = paintedBounds.left + (((minX + maxX) / 2) * paintedBounds.width) / painted.width;
  const startY = paintedBounds.top + (((minY + maxY) / 2) * paintedBounds.height) / painted.height;
  const surface = stage.querySelectorAll('canvas')[1]!;
  const target = globalThis.document
    .querySelector<HTMLElement>('[data-studio-elements-drop-zone]')!
    .getBoundingClientRect();
  fireEvent.pointerDown(surface, {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: startX,
    clientY: startY,
  });
  expect(screen.getByRole('dialog', { name: 'Elements' })).toBeTruthy();
  fireEvent.mouseDown(surface, { clientX: startX, clientY: startY, button: 0 });
  expect(screen.getByRole('dialog', { name: 'Elements' })).toBeTruthy();
  fireEvent.mouseMove(window, { clientX: startX + 20, clientY: startY + 20 });
  fireEvent.mouseMove(window, { clientX: target.left + 20, clientY: target.top + 20 });
  fireEvent.pointerUp(window, {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: target.left + 20,
    clientY: target.top + 20,
  });
  fireEvent.mouseUp(window, { clientX: target.left + 20, clientY: target.top + 20 });
  await waitFor(() =>
    expect(saves).toHaveBeenCalledWith(
      occluder.id,
      [occluder.id],
      Math.round(target.left + 20),
      Math.round(target.top + 20)
    )
  );
  expect(saves).toHaveBeenCalledTimes(1);
  expect(moves).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Elements' })).toBeTruthy();
  fireEvent.mouseDown(surface, { clientX: startX, clientY: startY, button: 0 });
  fireEvent.mouseMove(window, { clientX: startX + 20, clientY: startY + 20 });
  fireEvent.mouseUp(window, { clientX: startX + 20, clientY: startY + 20 });
  expect(saves).toHaveBeenCalledTimes(2);
  expect(moves).toHaveBeenCalledTimes(1);
});
