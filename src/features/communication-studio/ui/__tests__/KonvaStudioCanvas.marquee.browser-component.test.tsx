import { createRef, useState } from 'react';
import Konva from 'konva';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { defaultBrand } from '../../logic/document';
import { applyStudioCommandV3 } from '../../logic/commands-v3';
import { createStudioTemplateDocumentV5 } from '../../logic/templates-v5';
import type { StudioDocumentV5 } from '../../logic/document-v3';
import KonvaStudioCanvas, {
  type StudioCanvasHandle,
  type StudioCanvasNodeChange,
} from '../KonvaStudioCanvas';

async function harness() {
  const document = createStudioTemplateDocumentV5('single', 'Marquee', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const source = document.nodes.find(node => node.type === 'shape')!;
  const shapes = [120, 330, 650].map((x, index) => ({
    ...structuredClone(source),
    id: crypto.randomUUID(),
    name: `Shape ${index + 1}`,
    shape: 'rectangle' as const,
    parentFrameId: frame.id,
    transform: { ...source.transform, x, y: 120, width: 100, height: 100 },
    style: {
      ...source.style,
      fill: ['#ff0000', '#0000ff', '#00aa00'][index],
      stroke: null,
      strokeWidth: 0,
    },
    zIndex: index + 1,
  }));
  document.nodes = [frame, ...shapes];
  const ref = createRef<StudioCanvasHandle>();
  const zoom = { current: 1 };
  const changes = vi.fn<(changes: StudioCanvasNodeChange[]) => void>();
  function Harness() {
    const [value, setValue] = useState<StudioDocumentV5>(document);
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <div style={{ width: 1000, height: 750 }}>
        <KonvaStudioCanvas
          ref={ref}
          document={value}
          activeFrameId={frame.id}
          assets={[]}
          selected={selected}
          selectExact={setSelected}
          editable
          guides={false}
          applyCanvasChanges={changes}
          onCanvasStateChange={state => {
            zoom.current = state.zoom;
          }}
        />
        <output data-testid="selected-ids">{selected.join(',')}</output>
        <button
          onClick={() =>
            setValue(current =>
              applyStudioCommandV3(current, { type: 'deleteNodes', nodeIds: selected })
            )
          }
        >
          Delete selection
        </button>
        <output data-testid="node-ids">{value.nodes.map(node => node.id).join(',')}</output>
      </div>
    );
  }
  render(<Harness />);
  const host = screen.getByTestId('studio-canvas');
  await waitFor(() => expect(host.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(2));
  await waitFor(() => expect(zoom.current).toBeLessThan(1));
  const stage = host.querySelector<HTMLElement>('.konvajs-content')!;
  const surface = stage.querySelector<HTMLCanvasElement>('canvas')!;
  const worldToClient = (x: number, y: number) => {
    const bounds = stage.getBoundingClientRect();
    const origin = ref.current!.scenePoint(bounds.left, bounds.top);
    return {
      clientX: bounds.left + (x - origin.x) * zoom.current,
      clientY: bounds.top + (y - origin.y) * zoom.current,
    };
  };
  const drag = (
    start: [number, number],
    end: [number, number],
    shiftKey = false,
    finish = true
  ) => {
    fireEvent.pointerDown(surface, {
      ...worldToClient(...start),
      pointerId: 10,
      pointerType: 'mouse',
      button: 0,
      shiftKey,
    });
    fireEvent.pointerMove(surface, {
      ...worldToClient(...end),
      pointerId: 10,
      pointerType: 'mouse',
      button: 0,
      shiftKey,
    });
    if (finish)
      fireEvent.pointerUp(surface, {
        ...worldToClient(...end),
        pointerId: 10,
        pointerType: 'mouse',
        button: 0,
        shiftKey,
      });
  };
  const selectedIds = () =>
    screen.getByTestId('selected-ids').textContent?.split(',').filter(Boolean) ?? [];
  const canvasStage = Konva.stages.find(item => item.content === stage)!;
  await waitFor(() => {
    const border = worldToClient(1, 350);
    const bounds = surface.getBoundingClientRect();
    let hit: Konva.Node | null = canvasStage.getIntersection({
      x: ((border.clientX - bounds.left) * canvasStage.width()) / bounds.width,
      y: ((border.clientY - bounds.top) * canvasStage.height()) / bounds.height,
    });
    const ancestors: string[] = [];
    while (hit) {
      ancestors.push(hit.id());
      hit = hit.getParent();
    }
    expect(ancestors).toContain(frame.id);
  });
  return {
    frame,
    shapes,
    ref,
    zoom,
    changes,
    host,
    stage,
    surface,
    worldToClient,
    drag,
    selectedIds,
  };
}

it('shows a marquee inside a frame, selects contained shapes, extends with Shift, and preserves frame-border selection', async () => {
  const { frame, shapes, host, surface, worldToClient, drag, selectedIds } = await harness();
  drag([50, 50], [550, 300], false, false);
  const controls = [...host.querySelectorAll('canvas')].at(-1)!;
  const sample = worldToClient(280, 270);
  await waitFor(() => {
    const rect = controls.getBoundingClientRect();
    const x = Math.floor(((sample.clientX - rect.left) * controls.width) / rect.width);
    const y = Math.floor(((sample.clientY - rect.top) * controls.height) / rect.height);
    expect(controls.getContext('2d')!.getImageData(x, y, 1, 1).data[3]).toBeGreaterThan(0);
  });
  fireEvent.pointerUp(surface, {
    ...worldToClient(550, 300),
    pointerId: 10,
    pointerType: 'mouse',
    button: 0,
  });
  await waitFor(() => expect(selectedIds().sort()).toEqual([shapes[0].id, shapes[1].id].sort()));
  drag([600, 50], [800, 300], true);
  await waitFor(() => expect(selectedIds().sort()).toEqual(shapes.map(node => node.id).sort()));
  const blank = worldToClient(50, 50);
  fireEvent.pointerDown(surface, { ...blank, pointerId: 11, pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(surface, { ...blank, pointerId: 11, pointerType: 'mouse', button: 0 });
  await waitFor(() => expect(selectedIds()).toEqual([]));
  const border = worldToClient(1, 350);
  fireEvent.mouseDown(surface, border);
  fireEvent.mouseUp(surface, border);
  fireEvent.click(surface, border);
  await waitFor(() => expect(selectedIds()).toEqual([frame.id]));
});

it('moves a selected frame and child only once when dragged from the frame border', async () => {
  const { frame, shapes, changes, surface, worldToClient, selectedIds } = await harness();
  const border = worldToClient(1, 350);
  fireEvent.mouseDown(surface, border);
  fireEvent.mouseUp(surface, border);
  fireEvent.click(surface, border);
  await waitFor(() => expect(selectedIds()).toEqual([frame.id]));
  const child = worldToClient(170, 170);
  fireEvent.mouseDown(surface, { ...child, shiftKey: true });
  fireEvent.mouseUp(surface, { ...child, shiftKey: true });
  fireEvent.click(surface, { ...child, shiftKey: true });
  await waitFor(() => expect(selectedIds().sort()).toEqual([frame.id, shapes[0].id].sort()));
  fireEvent.mouseDown(surface, { ...border, button: 0 });
  fireEvent.mouseMove(window, { clientX: border.clientX + 25, clientY: border.clientY + 15 });
  fireEvent.mouseUp(window, { clientX: border.clientX + 25, clientY: border.clientY + 15 });
  await waitFor(() => expect(changes).toHaveBeenCalledOnce());
  expect(changes.mock.calls[0][0].map(change => change.nodeId)).toEqual([frame.id]);
});

it('selects after zoom and pan, moves the selected shapes together, and deletes the same selection', async () => {
  const { shapes, ref, zoom, changes, stage, surface, worldToClient, drag, selectedIds } =
    await harness();
  const bounds = stage.getBoundingClientRect();
  fireEvent.wheel(surface, {
    deltaX: 50,
    deltaY: 30,
    clientX: bounds.left + 500,
    clientY: bounds.top + 300,
  });
  await ref.current!.execute({ type: 'zoom', mode: 'in' });
  await waitFor(() => expect(zoom.current).toBeGreaterThan(0.6));
  drag([550, 300], [50, 50]);
  await waitFor(() => expect(selectedIds().sort()).toEqual([shapes[0].id, shapes[1].id].sort()));
  const start = worldToClient(170, 170);
  // The viewport callback precedes Konva's batched canvas and hit-map redraw.
  // Wait for the zoomed shape before using that position to initiate a drag.
  await waitFor(() => {
    const rect = surface.getBoundingClientRect();
    const x = Math.floor(((start.clientX - rect.left) * surface.width) / rect.width);
    const y = Math.floor(((start.clientY - rect.top) * surface.height) / rect.height);
    const rgba = surface.getContext('2d')!.getImageData(x, y, 1, 1).data;
    expect(rgba[0]).toBeGreaterThan(150);
    expect(rgba[2]).toBeLessThan(100);
  });
  fireEvent.mouseDown(surface, { ...start, button: 0 });
  fireEvent.mouseMove(window, {
    clientX: start.clientX + 20,
    clientY: start.clientY + 10,
    button: 0,
  });
  fireEvent.mouseMove(window, {
    clientX: start.clientX + 45,
    clientY: start.clientY + 25,
    button: 0,
  });
  await waitFor(() => {
    const moved = worldToClient(380 + 45 / zoom.current, 170 + 25 / zoom.current);
    const rect = surface.getBoundingClientRect();
    const x = Math.floor(((moved.clientX - rect.left) * surface.width) / rect.width);
    const y = Math.floor(((moved.clientY - rect.top) * surface.height) / rect.height);
    const rgba = surface.getContext('2d')!.getImageData(x, y, 1, 1).data;
    expect(rgba[2]).toBeGreaterThan(150);
  });
  fireEvent.mouseUp(window, {
    clientX: start.clientX + 45,
    clientY: start.clientY + 25,
    button: 0,
  });
  await waitFor(() => expect(changes).toHaveBeenCalled());
  expect(
    changes.mock.calls
      .at(-1)![0]
      .map(change => change.nodeId)
      .sort()
  ).toEqual([shapes[0].id, shapes[1].id].sort());
  for (const change of changes.mock.calls.at(-1)![0]) {
    expect(change.transform?.dx).toBeCloseTo(45 / zoom.current, 1);
    expect(change.transform?.dy).toBeCloseTo(25 / zoom.current, 1);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Delete selection' }));
  const remaining = screen.getByTestId('node-ids').textContent ?? '';
  expect(remaining).not.toContain(shapes[0].id);
  expect(remaining).not.toContain(shapes[1].id);
  expect(remaining).toContain(shapes[2].id);
});

it('cancels a focused marquee before React effects settle and permits the next selection', async () => {
  const { surface, worldToClient, drag, selectedIds } = await harness();
  const host = screen.getByTestId('studio-canvas');
  host.focus();
  act(() => {
    fireEvent.pointerDown(surface, {
      ...worldToClient(50, 50),
      pointerId: 10,
      pointerType: 'mouse',
      button: 0,
    });
    fireEvent.pointerMove(surface, {
      ...worldToClient(550, 300),
      pointerId: 10,
      pointerType: 'mouse',
      button: 0,
    });
    fireEvent.keyDown(host, { key: 'Escape' });
    fireEvent.pointerUp(surface, {
      ...worldToClient(550, 300),
      pointerId: 10,
      pointerType: 'mouse',
      button: 0,
    });
  });
  expect(selectedIds()).toEqual([]);
  drag([50, 50], [550, 300]);
  expect(selectedIds().length).toBeGreaterThan(0);
});

it('cancels a marquee on Escape and on a second touch without changing the selection', async () => {
  const { surface, worldToClient, drag, selectedIds } = await harness();
  drag([50, 50], [550, 300], false, false);
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.pointerUp(surface, {
    ...worldToClient(550, 300),
    pointerId: 10,
    pointerType: 'mouse',
    button: 0,
  });
  expect(selectedIds()).toEqual([]);
  const one = worldToClient(50, 50),
    two = worldToClient(550, 300);
  fireEvent.pointerDown(surface, { ...one, pointerId: 21, pointerType: 'touch', button: 0 });
  fireEvent.pointerMove(surface, { ...two, pointerId: 21, pointerType: 'touch', button: 0 });
  const fingers = [
    new Touch({ identifier: 1, target: surface, ...one }),
    new Touch({ identifier: 2, target: surface, ...two }),
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
  fireEvent.pointerUp(surface, { ...two, pointerId: 21, pointerType: 'touch', button: 0 });
  expect(selectedIds()).toEqual([]);
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
