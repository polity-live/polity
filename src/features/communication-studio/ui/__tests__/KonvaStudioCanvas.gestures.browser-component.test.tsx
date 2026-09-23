import { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { defaultBrand } from '../../logic/document';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import KonvaStudioCanvas, {
  type StudioCanvasHandle,
  type StudioCanvasState,
} from '../KonvaStudioCanvas';

async function canvasHarness(onCreateNode?: () => null) {
  const document = createStudioTemplateDocumentV5('single', 'Gestures', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const ref = createRef<StudioCanvasHandle>();
  const state: { current: StudioCanvasState | null } = { current: null };
  render(
    <div style={{ width: 1000, height: 700 }}>
      <KonvaStudioCanvas
        ref={ref}
        document={document}
        activeFrameId={frame.id}
        assets={[]}
        selected={[]}
        editable
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
  return { host, surface, bounds, point, state, ref };
}

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
