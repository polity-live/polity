import Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { studioCanvasSelectionBounds } from '../canvas-selection-bounds';

const stages: Konva.Stage[] = [];
afterEach(() => {
  for (const stage of stages.splice(0)) {
    const container = stage.container();
    stage.destroy();
    container.remove();
  }
});
function fixture() {
  const container = document.createElement('div');
  document.body.append(container);
  const stage = new Konva.Stage({ container, width: 640, height: 480 });
  stages.push(stage);
  const layer = new Konva.Layer();
  stage.add(layer);
  const first = new Konva.Rect({ id: crypto.randomUUID(), x: 10, y: 20, width: 30, height: 40 });
  const second = new Konva.Rect({ id: crypto.randomUUID(), x: 80, y: 90, width: 15, height: 25 });
  layer.add(first, second);
  return { stage, layer, first, second };
}
it('maps the native selection union through viewport zoom and pan without including unselected nodes', () => {
  const { stage, first, second } = fixture();
  expect(studioCanvasSelectionBounds(stage, [first.id(), second.id()], 2, { x: 7, y: -3 })).toEqual(
    {
      left: 27,
      top: 37,
      right: 197,
      bottom: 227,
    }
  );
  expect(studioCanvasSelectionBounds(stage, [first.id()], 1, { x: 0, y: 0 })).toEqual({
    left: 10,
    top: 20,
    right: 40,
    bottom: 60,
  });
});
it.each(['unmounted stage', 'empty selection', 'removed selected node'] as const)(
  'returns no bounds for %s',
  kind => {
    const { stage, first } = fixture();
    if (kind === 'removed selected node') first.destroy();
    expect(
      studioCanvasSelectionBounds(
        kind === 'unmounted stage' ? null : stage,
        kind === 'empty selection' ? [] : [first.id()],
        1,
        { x: 0, y: 0 }
      )
    ).toBeNull();
  }
);
it.each(['x', 'y'] as const)(
  'ignores native transform overflow on the %s axis while retaining finite selection geometry',
  axis => {
    const { stage, layer, first, second } = fixture();
    const parent = new Konva.Group({ [axis]: Number.MAX_VALUE });
    layer.add(parent);
    first.moveTo(parent);
    first.setAttr(axis, Number.MAX_VALUE);
    const rect = first.getClientRect({ relativeTo: stage, skipStroke: true });
    expect(Number.isFinite(rect[axis])).toBe(false);
    expect(studioCanvasSelectionBounds(stage, [first.id()], 1, { x: 0, y: 0 })).toBeNull();
    expect(
      studioCanvasSelectionBounds(stage, [first.id(), second.id()], 1, { x: 0, y: 0 })
    ).toEqual({
      left: 80,
      top: 90,
      right: 95,
      bottom: 115,
    });
  }
);
