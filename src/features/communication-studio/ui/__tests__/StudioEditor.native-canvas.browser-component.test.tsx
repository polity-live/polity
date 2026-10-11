import { io, show, useCanonicalDocument } from './StudioWorkspace.fixture';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Konva from 'konva';
import { page, userEvent } from 'vitest/browser';
import { insertStudioDataView } from '../../logic/data-view-import';
import { configuration, projection } from '@/test/studio-data-view.fixture';
import type { StudioDocumentV3 } from '../../logic/document-v3';
import { paintStudioDocumentFrame } from '../../logic/paint-v5';
import { freeCanvasRectangle } from '../../logic/canvas-focus';
import { worldBounds } from '../../logic/selection-geometry';
import '@/styles.css';

// Keep the document transport boundary, but render the actual canvas under the actual editor.
vi.doMock('../KonvaStudioCanvas', async () => vi.importActual('../KonvaStudioCanvas'));

it.each(['small', 'large'])(
  'centers a %s layer with native double-click while keeping its name field editable',
  async size => {
    await page.viewport(1280, 900);
    await vi.importActual('../KonvaStudioCanvas');
    useCanonicalDocument();
    const targetId = (io.editor.v3Value as StudioDocumentV3).nodes.find(
      n => n.type === 'shape'
    )!.id;
    io.editor.transactV3((document: StudioDocumentV3) => {
      const target = document.nodes.find(n => n.id === targetId)!;
      target.name = 'Offscreen layer';
      Object.assign(target.transform, {
        x: 5000,
        y: 5000,
        width: size === 'large' ? 2000 : 80,
        height: size === 'large' ? 1400 : 60,
      });
    });
    await show();
    const host = await screen.findByTestId('studio-canvas');
    await waitFor(() => expect(host.querySelector('canvas')).toBeTruthy());
    const stage = Konva.stages.find(item => host.contains(item.container()))!;
    await userEvent.click(screen.getByRole('button', { name: /^zoom / }));
    await userEvent.click(screen.getByRole('menuitem', { name: '100 %' }));
    await waitFor(() => expect(stage.scaleX()).toBe(1));
    const beforePan = { x: stage.x(), y: stage.y() };
    const beforeDocument = structuredClone(io.editor.v3Value);
    await userEvent.click(screen.getByRole('button', { name: 'layers' }));
    const row = () =>
      screen.getByRole('tree').querySelector<HTMLElement>(`[data-studio-layer-id="${targetId}"]`)!;
    await userEvent.dblClick(within(row()).getByRole('button', { name: 'Offscreen layer' }));
    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'layerName: Offscreen layer',
    });
    const target = (io.editor.v3Value as StudioDocumentV3).nodes.find(n => n.id === targetId)!;
    const bounds = worldBounds(io.editor.v3Value, target);
    await waitFor(() => {
      const rect = host.getBoundingClientRect();
      const obstacles = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-canvas-focus-occluder], .polity-canvas-properties'
        ),
      ].map(panel => {
        const obstacle = panel.getBoundingClientRect();
        return {
          left: obstacle.left - rect.left,
          top: obstacle.top - rect.top,
          right: obstacle.right - rect.left,
          bottom: obstacle.bottom - rect.top,
        };
      });
      const free = freeCanvasRectangle(
        {
          left: Math.max(0, -rect.left),
          top: Math.max(0, -rect.top),
          right: Math.min(rect.width, window.innerWidth - rect.left),
          bottom: Math.min(rect.height, window.innerHeight - rect.top),
        },
        obstacles
      )!;
      expect(stage.x() + ((bounds.left + bounds.right) / 2) * stage.scaleX()).toBeCloseTo(
        (free.left + free.right) / 2,
        1
      );
      expect(stage.y() + ((bounds.top + bounds.bottom) / 2) * stage.scaleY()).toBeCloseTo(
        (free.top + free.bottom) / 2,
        1
      );
      if (size === 'large') {
        expect(stage.scaleX()).toBeLessThan(1);
        expect((bounds.right - bounds.left) * stage.scaleX()).toBeLessThanOrEqual(
          free.right - free.left - 64
        );
        expect((bounds.bottom - bounds.top) * stage.scaleY()).toBeLessThanOrEqual(
          free.bottom - free.top - 64
        );
      } else expect(stage.scaleX()).toBe(1);
    });
    expect({ x: stage.x(), y: stage.y() }).not.toEqual(beforePan);
    expect(io.editor.v3Value).toEqual(beforeDocument);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'Offscreen layer'.length]);
    await userEvent.keyboard('Centered layer{Enter}');
    const renamed = () =>
      (io.editor.v3Value as StudioDocumentV3).nodes.find(n => n.id === targetId)!;
    await waitFor(() => expect(renamed().name).toBe('Centered layer'));
    expect(screen.getByRole('tree')).toBeTruthy();
    await userEvent.dblClick(within(row()).getByRole('button', { name: 'Centered layer' }));
    await userEvent.keyboard('Cancelled layer{Escape}');
    expect(renamed().name).toBe('Centered layer');
    expect(screen.getByRole('tree')).toBeTruthy();
    await userEvent.dblClick(within(row()).getByRole('button', { name: 'Centered layer' }));
    await userEvent.keyboard('Blurred layer');
    await userEvent.click(screen.getByRole('searchbox', { name: 'searchLayers' }));
    await waitFor(() => expect(renamed().name).toBe('Blurred layer'));
    expect(screen.getByRole('tree')).toBeTruthy();
  }
);

it('publishes native canvas cursor movement through the document presence transport', async () => {
  await vi.importActual('../KonvaStudioCanvas');
  useCanonicalDocument();
  await show();
  const host = await screen.findByTestId('studio-canvas');
  await waitFor(() => expect(host.querySelector('canvas')).toBeTruthy());
  const stage = Konva.stages.find(item => host.contains(item.container()))!;
  const surface = [...host.querySelectorAll('canvas')].at(-1)!;
  await waitFor(() => expect(surface.getBoundingClientRect().width).toBeGreaterThan(1));
  expect(screen.queryByTestId('canvas')).toBeNull();
  io.editor.cursor.mockClear();
  const bounds = surface.getBoundingClientRect();
  fireEvent.pointerMove(surface, {
    pointerId: 91,
    pointerType: 'mouse',
    clientX: bounds.left + 100,
    clientY: bounds.top + 120,
  });
  await waitFor(() => expect(io.editor.cursor).toHaveBeenCalledOnce());
  const [frameId, x, y, selection] = io.editor.cursor.mock.calls[0];
  expect(io.editor.v3Value.nodes.find((node: { id: string }) => node.id === frameId)?.type).toBe(
    'frame'
  );
  expect(Number.isFinite(x)).toBe(true);
  expect(Number.isFinite(y)).toBe(true);
  expect(selection).toEqual([]);
  expect(stage.width()).toBeGreaterThan(1);
});

it.each([0, 4160])(
  'detaches, reloads, drags and reattaches an imported chart group from frame x=%s',
  async frameX => {
    await page.viewport(1280, 900);
    await vi.importActual('../KonvaStudioCanvas');
    useCanonicalDocument();
    const stored: StudioDocumentV3 = io.editor.v3Value;
    const frameId = stored.nodes.find(n => n.type === 'frame')!.id;
    let ids: string[] = [];
    io.editor.transactV3((document: StudioDocumentV3) => {
      const frame = document.nodes.find(n => n.id === frameId)!;
      frame.transform = {
        ...frame.transform,
        x: frameX,
        y: 0,
        width: frameX ? 1920 : 240,
        height: frameX ? 1080 : 240,
      };
      document.nodes = [frame];
      ids = insertStudioDataView(document, frameId, configuration('line'), projection);
    });
    const chartId = (io.editor.v3Value as StudioDocumentV3).nodes.find(n => n.type === 'chart')!.id;
    const before = structuredClone(io.editor.v3Value) as StudioDocumentV3;
    const editor = await show();
    let host = await screen.findByTestId('studio-canvas');
    await waitFor(() => expect(host.querySelector('canvas')).toBeTruthy());
    let stage = Konva.stages.find(item => host.contains(item.container()))!;
    let surface = [...host.querySelectorAll<HTMLCanvasElement>('canvas')].at(-1)!;
    const transaction = vi.spyOn(io.editor, 'transactV3');
    const chart = () => (io.editor.v3Value as StudioDocumentV3).nodes.find(n => n.id === chartId)!;
    const exportedChartLabels = async () => {
      const scratch = document.createElement('canvas');
      scratch.style.display = 'none';
      document.body.prepend(scratch);
      const ctx = scratch.getContext('2d')!;
      const text = vi.spyOn(ctx, 'fillText');
      try {
        await paintStudioDocumentFrame(io.editor.v3Value, frameId, {});
        return text.mock.calls.map(([label]) => label);
      } finally {
        text.mockRestore();
        scratch.remove();
      }
    };
    const point = () => {
      const rendered = stage.findOne(`#${chartId}`)!;
      const scene = rendered
        .getAbsoluteTransform()
        .point({ x: chart().transform.width / 2, y: chart().transform.height / 2 });
      return scene;
    };
    const drag = async (dx: number, dy: number) => {
      await waitFor(() => {
        stage.draw();
        expect(stage.getIntersection(point())?.findAncestor(`#${chartId}`)).toBeTruthy();
      });
      const source = point();
      await userEvent.dragAndDrop(surface, surface, {
        sourcePosition: source,
        targetPosition: { x: source.x + dx * stage.scaleX(), y: source.y + dy * stage.scaleY() },
      } as never);
    };
    // Zoom out around the frame center to leave enough visible free canvas for a full exit.
    let bounds = surface.getBoundingClientRect();
    act(() =>
      fireEvent.wheel(surface, {
        ctrlKey: true,
        deltaY: frameX ? 900 : 400,
        clientX: bounds.left + stage.width() / 2,
        clientY: bounds.top + stage.height() / 2,
      })
    );
    await waitFor(() => expect(stage.scaleX()).toBeLessThan(1));
    const view = () => ({ x: stage.x(), y: stage.y(), zoom: stage.scaleX() });
    const beforeDragView = view();
    await drag(frameX ? 6449.05857 - frameX - chart().transform.x : 245, 0);
    await waitFor(() => expect(chart().parentFrameId).toBeNull());
    expect(host.querySelector('canvas')).toBeTruthy();
    expect(view()).toEqual(beforeDragView);
    if (frameX) expect(Math.abs(chart().transform.x - 6449.05857) * stage.scaleX()).toBeLessThan(1);
    expect(transaction).toHaveBeenCalledOnce();
    expect(
      (io.editor.v3Value as StudioDocumentV3).nodes
        .filter(n => ids.includes(n.id))
        .map(n => n.parentFrameId)
    ).toEqual(ids.map(() => null));
    expect(await exportedChartLabels()).not.toContain('2024');
    // Opening the saved, detached document must mount a functioning canvas again.
    const saved = structuredClone(io.editor.v3Value);
    editor.unmount();
    await show();
    host = await screen.findByTestId('studio-canvas');
    await waitFor(() => expect(host.querySelector('canvas')).toBeTruthy());
    stage = Konva.stages.find(item => host.contains(item.container()))!;
    surface = [...host.querySelectorAll<HTMLCanvasElement>('canvas')].at(-1)!;
    bounds = surface.getBoundingClientRect();
    expect(io.editor.v3Value).toEqual(saved);
    for (const id of ids) expect(stage.findOne(`#${id}`)).toBeTruthy();
    const detachedX = chart().transform.x;
    const beforeSecondDragView = view();
    await drag(20, 15);
    await waitFor(() =>
      expect(Math.abs(chart().transform.x - detachedX - 20) * stage.scaleX()).toBeLessThan(1)
    );
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(view()).toEqual(beforeSecondDragView);
    expect(chart().parentFrameId).toBeNull();
    for (const reason of ['pointercancel', 'Escape']) {
      const saved = structuredClone(io.editor.v3Value);
      const origin = point();
      const client = { clientX: bounds.left + origin.x, clientY: bounds.top + origin.y, button: 0 };
      fireEvent.mouseDown(surface, client);
      fireEvent.mouseMove(window, { ...client, clientX: client.clientX + 10 });
      fireEvent.mouseMove(window, { ...client, clientX: client.clientX + 40 });
      expect(stage.findOne(`#${chartId}`)?.isDragging()).toBe(true);
      if (reason === 'Escape') fireEvent.keyDown(window, { key: 'Escape' });
      else fireEvent.pointerCancel(surface, { pointerId: 1, pointerType: 'mouse', ...client });
      fireEvent.mouseUp(window, { ...client, clientX: client.clientX + 40 });
      expect(io.editor.v3Value).toEqual(saved);
      expect(transaction).toHaveBeenCalledTimes(2);
    }
    const originalChart = before.nodes.find(n => n.id === chartId)!;
    await drag(
      frameX + originalChart.transform.x - chart().transform.x,
      originalChart.transform.y - chart().transform.y
    );
    await waitFor(() => expect(chart().parentFrameId).toBe(frameId));
    expect(transaction).toHaveBeenCalledTimes(3);
    expect(view()).toEqual(beforeSecondDragView);
    expect(await exportedChartLabels()).toContain('2024');
    for (const node of (io.editor.v3Value as StudioDocumentV3).nodes.filter(n =>
      ids.includes(n.id)
    )) {
      const original = before.nodes.find(n => n.id === node.id)!;
      expect(node.parentFrameId).toBe(frameId);
      expect(node.groupIds).toEqual(original.groupIds);
      expect(Math.abs(node.transform.x - original.transform.x) * stage.scaleX()).toBeLessThan(1);
      expect(Math.abs(node.transform.y - original.transform.y) * stage.scaleY()).toBeLessThan(1);
    }
  }
);
