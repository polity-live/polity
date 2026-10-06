import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import KonvaStudioCanvas, {
  type StudioCanvasHandle,
  type StudioCanvasState,
} from '../KonvaStudioCanvas';

async function canvasHarness(
  onCreateNode?: () => null,
  options: { editable?: boolean; fit?: 'contain'; element?: boolean } = {}
) {
  const document = createStudioTemplateDocumentV5('single', 'Gestures', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const shape = document.nodes.find(node => node.type === 'shape')!;
  if (options.element) {
    shape.transform = { ...shape.transform, x: 100, y: 100, width: 100, height: 100 };
    document.nodes = [frame, shape];
  }
  const select = vi.fn();
  const changes = vi.fn();
  const ref = createRef<StudioCanvasHandle>();
  const state: { current: StudioCanvasState | null } = { current: null };
  render(
    <div style={{ width: 1000, height: 700 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={document}
        activeFrameId={frame.id}
        assets={[]}
        selected={options.element ? [shape.id] : []}
        selectExact={select}
        applyCanvasChanges={changes}
        editable={options.editable ?? true}
        fit={options.fit}
        guides={false}
        onCreateNode={onCreateNode}
        onCanvasStateChange={value => {
          state.current = value;
        }}
      />
    </div>
  );
  const host = screen.getByTestId('studio-canvas');
  await waitFor(() => expect(host.querySelector('.konvajs-content canvas')).toBeTruthy());
  await waitFor(() => expect(state.current?.zoom).toBeLessThan(1));
  const surface = host.querySelector<HTMLCanvasElement>('canvas')!;
  const bounds = host.querySelector<HTMLElement>('.konvajs-content')!.getBoundingClientRect();
  const point = (x: number, y: number) => ref.current!.scenePoint(bounds.left + x, bounds.top + y);
  const content = host.querySelector<HTMLElement>('.konvajs-content')!;
  return { host, surface, content, bounds, point, state, ref, document, shape, select, changes };
}

function middlePointer(clientX: number, clientY: number) {
  return { pointerId: 19, pointerType: 'mouse', button: 1, buttons: 4, clientX, clientY };
}

it.each(['initial', 'reset'] as const)(
  'pans with middle-button dragging over an element at %s zoom without editing or switching tools',
  async mode => {
    const create = vi.fn(() => null);
    const { surface, content, bounds, point, state, ref, document, select, changes } =
      await canvasHarness(create, { element: true });
    if (mode === 'reset') await act(() => ref.current!.execute({ type: 'zoom', mode: 'reset' }));
    const originalNodes = structuredClone(document.nodes);
    for (const tool of ['selection', 'rectangle', 'text', 'eraser'] as const) {
      await act(() => ref.current!.execute({ type: 'setTool', tool }));
      const zoom = state.current!.zoom;
      const origin = point(0, 0);
      const x = bounds.left + (150 - origin.x) * zoom;
      const y = bounds.top + (150 - origin.y) * zoom;
      const before = point(0, 0);
      expect(fireEvent.pointerDown(surface, middlePointer(x, y))).toBe(false);
      expect(content.style.cursor).toBe('grabbing');
      fireEvent.pointerMove(surface, middlePointer(x + 100, y - 60));
      await waitFor(() => {
        expect(point(0, 0).x - before.x).toBeCloseTo(-100 / zoom, 2);
        expect(point(0, 0).y - before.y).toBeCloseTo(60 / zoom, 2);
      });
      fireEvent.pointerMove(surface, middlePointer(x - 40, y + 30));
      await waitFor(() => {
        expect(point(0, 0).x - before.x).toBeCloseTo(40 / zoom, 2);
        expect(point(0, 0).y - before.y).toBeCloseTo(-30 / zoom, 2);
      });
      fireEvent.pointerUp(window, { ...middlePointer(x - 40, y + 30), buttons: 0 });
      expect(content.style.cursor).toBe('');
      expect(state.current!.zoom).toBe(zoom);
      expect(state.current!.activeTool).toBe(tool);
      expect(select).not.toHaveBeenCalled();
      expect(changes).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(document.nodes).toEqual(originalNodes);
    }
  }
);

it.each(['up', 'cancel', 'capture loss', 'blur', 'released buttons'] as const)(
  'stops middle-button panning on %s and restores the cursor',
  async end => {
    const { surface, content, bounds, point } = await canvasHarness();
    content.style.cursor = 'crosshair';
    const pointer = middlePointer(bounds.left + 70, bounds.top + 70);
    fireEvent.pointerDown(surface, pointer);
    fireEvent.pointerMove(window, { ...pointer, clientX: bounds.right + 20 });
    const before = point(0, 0);
    if (end === 'up') fireEvent.pointerUp(window, { ...pointer, buttons: 0 });
    if (end === 'cancel') fireEvent.pointerCancel(window, pointer);
    if (end === 'capture loss') fireEvent.lostPointerCapture(content, pointer);
    if (end === 'blur') fireEvent.blur(window);
    if (end === 'released buttons') fireEvent.pointerMove(window, { ...pointer, buttons: 0 });
    expect(content.style.cursor).toBe('crosshair');
    fireEvent.pointerMove(surface, { ...pointer, clientX: pointer.clientX + 200 });
    expect(point(0, 0)).toEqual(before);
  }
);

it('suppresses middle-button browser defaults only on the canvas surface', async () => {
  const { surface, content, bounds, point } = await canvasHarness();
  expect(fireEvent.mouseDown(surface, { button: 1 })).toBe(false);
  const auxClick = new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true });
  expect(surface.dispatchEvent(auxClick)).toBe(false);
  const input = document.createElement('input');
  content.append(input);
  const before = point(0, 0);
  const pointer = middlePointer(bounds.left + 70, bounds.top + 70);
  expect(fireEvent.pointerDown(input, pointer)).toBe(true);
  fireEvent.pointerMove(window, { ...pointer, clientX: pointer.clientX + 100 });
  expect(point(0, 0)).toEqual(before);
  expect(content.style.cursor).toBe('');
});

it.each([{ editable: false }, { fit: 'contain' as const }])(
  'keeps middle-button panning disabled for %j',
  async options => {
    const { surface, content, bounds, point } = await canvasHarness(undefined, options);
    const before = point(0, 0);
    const pointer = middlePointer(bounds.left + 70, bounds.top + 70);
    fireEvent.pointerDown(surface, pointer);
    fireEvent.pointerMove(surface, { ...pointer, clientX: pointer.clientX + 100 });
    fireEvent.pointerUp(surface, { ...pointer, buttons: 0 });
    expect(point(0, 0)).toEqual(before);
    expect(content.style.cursor).toBe('');
  }
);

it('captures a real middle-button pointer over an element and releases it outside the canvas', async () => {
  const { host, content, point, state, ref, select, changes, document } = await canvasHarness(
    undefined,
    {
      element: true,
    }
  );
  host.style.marginTop = '30px';
  const bounds = content.getBoundingClientRect();
  const captured = vi.fn();
  content.addEventListener('gotpointercapture', captured);
  // Vitest scales its test iframe; CDP coordinates refer to the outer viewport.
  const iframe = window.frameElement as HTMLElement | null;
  const offset = iframe?.getBoundingClientRect();
  const scaleX = iframe && offset ? offset.width / iframe.offsetWidth : 1;
  const scaleY = iframe && offset ? offset.height / iframe.offsetHeight : 1;
  const zoom = state.current!.zoom;
  const origin = ref.current!.scenePoint(bounds.left, bounds.top);
  const localX = (150 - origin.x) * zoom;
  const localY = (150 - origin.y) * zoom;
  const x = (bounds.left + localX) * scaleX + (offset?.left ?? 0);
  const y = (bounds.top + localY) * scaleY + (offset?.top ?? 0);
  const outsideY = (offset?.top ?? 0) + 5 * scaleY;
  const session = cdp();
  const before = point(0, 0);
  const originalNodes = structuredClone(document.nodes);
  let pointerId: number | undefined;
  await session.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'middle',
    buttons: 4,
  });
  try {
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: x + 100 * scaleX,
      y: y + 40 * scaleY,
      button: 'middle',
      buttons: 4,
    });
    await waitFor(() => expect(captured).toHaveBeenCalledTimes(1));
    pointerId = (captured.mock.calls[0][0] as PointerEvent).pointerId;
    expect(content.hasPointerCapture(pointerId)).toBe(true);
    await waitFor(() => {
      expect(point(0, 0).x - before.x).toBeCloseTo(-100 / zoom, 2);
      expect(point(0, 0).y - before.y).toBeCloseTo(-40 / zoom, 2);
    });
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y: outsideY,
      button: 'middle',
      buttons: 4,
    });
    await waitFor(() => {
      expect(point(0, 0).x).toBeCloseTo(before.x, 2);
      expect(point(0, 0).y - before.y).toBeCloseTo((bounds.top + localY - 5) / zoom, 2);
    });
  } finally {
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y: outsideY,
      button: 'middle',
      buttons: 0,
    });
  }
  expect(content.style.cursor).toBe('');
  expect(content.hasPointerCapture(pointerId!)).toBe(false);
  expect(select).not.toHaveBeenCalled();
  expect(changes).not.toHaveBeenCalled();
  expect(document.nodes).toEqual(originalNodes);
  expect(state.current!.activeTool).toBe('selection');
  const after = point(0, 0);
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + 150, y });
  expect(point(0, 0)).toEqual(after);
});

it('pans with horizontal and vertical wheel deltas and zooms around the cursor with Ctrl+wheel', async () => {
  const { surface, bounds, point, state } = await canvasHarness();
  expect(state.current!.viewBounds!.left).toBeCloseTo(point(0, 0).x);
  expect(state.current!.viewBounds!.right).toBeCloseTo(point(bounds.width, 0).x);
  const before = point(250, 240);
  const zoom = state.current!.zoom;
  const viewWidth = state.current!.viewBounds!.right - state.current!.viewBounds!.left;
  fireEvent.wheel(surface, {
    deltaX: 40,
    deltaY: 80,
    clientX: bounds.left + 250,
    clientY: bounds.top + 240,
  });
  await waitFor(() => {
    expect(point(250, 240).x - before.x).toBeCloseTo(40 / zoom, 2);
    expect(point(250, 240).y - before.y).toBeCloseTo(80 / zoom, 2);
    expect(state.current!.viewBounds!.left).toBeCloseTo(point(0, 0).x);
  });
  const anchor = point(250, 240);
  fireEvent.wheel(surface, {
    ctrlKey: true,
    deltaY: -60,
    clientX: bounds.left + 250,
    clientY: bounds.top + 240,
  });
  await waitFor(() => expect(state.current!.zoom).toBeGreaterThan(zoom));
  expect(state.current!.viewBounds!.right - state.current!.viewBounds!.left).toBeLessThan(
    viewWidth
  );
  expect(point(250, 240).x).toBeCloseTo(anchor.x, 2);
  expect(point(250, 240).y).toBeCloseTo(anchor.y, 2);
});

it('pans with two touches and zooms around their midpoint when they spread', async () => {
  const { surface, bounds, point, state } = await canvasHarness();
  const finger = (id: number, x: number, y: number) =>
    new Touch({
      identifier: id,
      target: surface,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    });
  const send = (type: string, touches: Touch[], changedTouches = touches) =>
    surface.dispatchEvent(
      new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches,
        targetTouches: touches,
        changedTouches,
      })
    );
  const zoom = state.current!.zoom;
  const before = point(250, 200);
  send('touchstart', [finger(1, 200, 200), finger(2, 300, 200)]);
  send('touchmove', [finger(1, 220, 220), finger(2, 320, 220)]);
  await waitFor(() => {
    expect(point(250, 200).x - before.x).toBeCloseTo(-20 / zoom, 2);
    expect(point(250, 200).y - before.y).toBeCloseTo(-20 / zoom, 2);
  });
  const anchor = point(270, 220);
  send('touchmove', [finger(1, 170, 220), finger(2, 370, 220)]);
  await waitFor(() => expect(state.current!.zoom).toBeCloseTo(Math.min(4, zoom * 2), 2));
  expect(point(270, 220).x).toBeCloseTo(anchor.x, 2);
  expect(point(270, 220).y).toBeCloseTo(anchor.y, 2);
  send('touchend', [], [finger(1, 170, 220), finger(2, 370, 220)]);
});

it('temporarily pans with Space and mouse dragging without changing the active tool', async () => {
  const { surface, bounds, point, state } = await canvasHarness();
  const before = point(70, 70);
  const zoom = state.current!.zoom;
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
  );
  fireEvent.pointerDown(surface, {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: bounds.left + 70,
    clientY: bounds.top + 70,
  });
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: bounds.left + 100,
    clientY: bounds.top + 90,
  });
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: bounds.left + 130,
    clientY: bounds.top + 110,
  });
  fireEvent.pointerUp(surface, {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: bounds.left + 130,
    clientY: bounds.top + 110,
  });
  window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
  await waitFor(() => {
    expect(point(70, 70).x - before.x).toBeCloseTo(-60 / zoom, 2);
    expect(point(70, 70).y - before.y).toBeCloseTo(-40 / zoom, 2);
  });
  expect(state.current!.activeTool).toBe('selection');
});

it('keeps one-finger drawing and cancels it when a second finger starts a canvas gesture', async () => {
  const onCreateNode = vi.fn(() => null);
  const { surface, bounds, ref, state } = await canvasHarness(onCreateNode);
  await ref.current!.execute({ type: 'setTool', tool: 'rectangle' });
  await waitFor(() => expect(state.current!.activeTool).toBe('rectangle'));
  const pointer = (x: number, y: number) => ({
    pointerId: 1,
    pointerType: 'touch',
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  });
  fireEvent.pointerDown(surface, pointer(100, 100));
  fireEvent.pointerMove(surface, pointer(150, 150));
  fireEvent.pointerUp(surface, pointer(150, 150));
  expect(onCreateNode).toHaveBeenCalledTimes(1);
  fireEvent.pointerDown(surface, pointer(100, 100));
  const fingers = [
    new Touch({
      identifier: 1,
      target: surface,
      clientX: bounds.left + 100,
      clientY: bounds.top + 100,
    }),
    new Touch({
      identifier: 2,
      target: surface,
      clientX: bounds.left + 200,
      clientY: bounds.top + 100,
    }),
  ];
  surface.dispatchEvent(
    new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: fingers,
      targetTouches: fingers,
      changedTouches: fingers,
    })
  );
  fireEvent.pointerUp(surface, pointer(150, 150));
  expect(onCreateNode).toHaveBeenCalledTimes(1);
  surface.dispatchEvent(
    new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: fingers,
    })
  );
});
