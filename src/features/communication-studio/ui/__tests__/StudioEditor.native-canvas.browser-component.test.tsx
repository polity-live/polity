import { io, show, useCanonicalDocument } from './StudioWorkspace.fixture';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Konva from 'konva';

// Keep the document transport boundary, but render the actual canvas under the actual editor.
vi.doMock('../KonvaStudioCanvas', async () => vi.importActual('../KonvaStudioCanvas'));

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
