import Konva from 'konva';
import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import { createFrameNode, createStudioDocumentV5 } from '../../logic/document-v3';
import { createStudioNodeFromElement } from '../../logic/create-studio-node';
import { element } from '../../logic/document';
import KonvaStudioCanvas from '../KonvaStudioCanvas';

function fixture(kind: 'rect' | 'chart') {
  const document = createStudioDocumentV5('Canvas callbacks');
  const frame = createFrameNode('custom', {
    transform: { x: 0, y: 0, width: 640, height: 400 },
    intro: { mode: 'static', assetId: null, intensity: 0.45 },
  });
  const node = createStudioNodeFromElement(
    element(kind, { x: 30, y: 30, width: 180, height: 120 }),
    frame.id,
    0
  );
  document.nodes.push(frame, node);
  return { document, frame, node };
}

function stage() {
  const host = screen.getByTestId('studio-canvas');
  return Konva.stages.find(stage => host.contains(stage.container()))!;
}

it('discards a deferred chart-font redraw after the chart is unmounted', async () => {
  const { document: studio, frame, node } = fixture('chart');
  if (node.type !== 'chart') throw new Error('Expected chart fixture');
  node.data.fontFamily = 'Newsreader';
  let resolveFonts: (fonts: FontFace[]) => void = () => undefined;
  const pendingFonts = new Promise<FontFace[]>(resolve => {
    resolveFonts = resolve;
  });
  const load = document.fonts.load.bind(document.fonts);
  const loadSpy = vi
    .spyOn(document.fonts, 'load')
    .mockImplementation((font, text) =>
      font.includes('Newsreader') ? pendingFonts : load(font, text)
    );
  const redraw = vi.spyOn(Konva.Layer.prototype, 'batchDraw');
  try {
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
      expect(loadSpy.mock.calls.filter(([font]) => font.includes('Newsreader'))).toHaveLength(2)
    );
    expect(stage().findOne(`#${node.id}`)).toBeTruthy();
    view.unmount();
    redraw.mockClear();
    await act(async () => {
      resolveFonts([]);
      await pendingFonts;
    });
    expect(redraw).not.toHaveBeenCalled();
    expect(Konva.stages.some(stage => stage.findOne(`#${node.id}`))).toBe(false);
  } finally {
    loadSpy.mockRestore();
    redraw.mockRestore();
  }
});

it('ignores idle cancellation and rolls back an active native drag exactly once', async () => {
  const { document, frame, node } = fixture('rect');
  const changes = vi.fn();
  const dragMove = vi.fn();
  const dragEnd = vi.fn();
  render(
    <div style={{ width: 700, height: 500 }}>
      <KonvaStudioCanvas
        document={document}
        activeFrameId={frame.id}
        assets={[]}
        selected={[node.id]}
        editable
        fit="contain"
        applyCanvasChanges={changes}
        onNodeDragMove={dragMove}
        onNodeDragEnd={dragEnd}
      />
    </div>
  );
  const host = screen.getByTestId('studio-canvas');
  await waitFor(() => expect(stage().findOne(`#${node.id}`)).toBeTruthy());
  host.focus();
  await userEvent.keyboard('{Escape}');
  expect(dragEnd).not.toHaveBeenCalled();
  const group = stage().findOne<Konva.Group>(`#${node.id}`)!;
  const original = { x: group.x(), y: group.y() };
  const point = group.getAbsoluteTransform().point({ x: 60, y: 40 });
  const bounds = stage().container().getBoundingClientRect();
  const start = { x: bounds.left + point.x, y: bounds.top + point.y };
  await cdp().send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...start,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  try {
    await cdp().send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: start.x + 50,
      y: start.y + 30,
      buttons: 1,
    });
    await waitFor(() => expect(dragMove).toHaveBeenCalled());
    await userEvent.keyboard('{Escape}');
    expect(dragEnd).toHaveBeenCalledExactlyOnceWith(node.id, [node.id], Number.NaN, Number.NaN);
    expect({ x: group.x(), y: group.y() }).toEqual(original);
    expect(changes).not.toHaveBeenCalled();
  } finally {
    await cdp().send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: start.x + 50,
      y: start.y + 30,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
  }
  await userEvent.keyboard('{Escape}');
  expect(dragEnd).toHaveBeenCalledTimes(1);
  expect(changes).not.toHaveBeenCalled();
});
