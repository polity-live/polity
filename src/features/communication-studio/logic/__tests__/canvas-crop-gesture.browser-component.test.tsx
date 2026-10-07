import Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { initialMediaCrop } from '../studio-crop';
import {
  createStudioCropGesture,
  updateStudioCropGesture,
  type CanvasCropDraft,
} from '../canvas-crop-gesture';

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
  container.style.width = '640px';
  container.style.height = '480px';
  document.body.append(container);
  const stage = new Konva.Stage({ container, width: 640, height: 480 });
  stages.push(stage);
  const layer = new Konva.Layer();
  stage.add(layer);
  const nodeId = crypto.randomUUID();
  const group = new Konva.Group({ id: nodeId, x: 230, y: 200, offsetX: 150, offsetY: 120 });
  group.add(new Konva.Rect({ width: 300, height: 240 }));
  layer.add(group);
  const draft: CanvasCropDraft = {
    nodeId,
    zoom: 1,
    state: initialMediaCrop(
      { x: 80, y: 80, width: 300, height: 240, rotation: 0, flipX: false, flipY: false },
      'cover',
      { x: 0.5, y: 0.5 },
      null,
      200,
      80
    ),
  };
  const at = (x: number, y: number) => {
    const point = group.getAbsoluteTransform().point({ x, y });
    const bounds = container.getBoundingClientRect();
    return {
      clientX: bounds.left + (point.x * bounds.width) / stage.width(),
      clientY: bounds.top + (point.y * bounds.height) / stage.height(),
    };
  };
  const options = { draft, stage, nodeId, kind: 'pan' as const, zoom: 1, ...at(150, 120) };
  return { options, group, draft, stage, at };
}

it.each(['no draft', 'other node', 'no stage', 'missing group'] as const)(
  'does not begin a crop gesture with %s',
  kind => {
    const { options, group } = fixture();
    if (kind === 'missing group') group.destroy();
    expect(
      createStudioCropGesture({
        ...options,
        draft: kind === 'no draft' ? null : options.draft,
        nodeId: kind === 'other node' ? crypto.randomUUID() : options.nodeId,
        stage: kind === 'no stage' ? null : options.stage,
      })
    ).toBeNull();
  }
);

it.each([
  ['left', 0, 120],
  ['right', 300, 120],
  ['top', 150, 0],
  ['bottom', 150, 240],
  ['top-left', 0, 0],
  ['bottom-right', 300, 240],
  ['pan', 150, 120],
] as const)('resolves a native crop pointer to the %s handle', (kind, x, y) => {
  const { options, at, draft } = fixture();
  const gesture = createStudioCropGesture({ ...options, ...at(x, y) });
  expect(gesture?.kind).toBe(kind);
  expect(gesture?.nodeId).toBe(draft.nodeId);
  expect(gesture?.start.x).toBeCloseTo(x);
  expect(gesture?.start.y).toBeCloseTo(y);
  expect(gesture?.initial).toBe(draft.state);
});

it('retains an explicit resize handle and maps the real mirrored rotated group into local coordinates', () => {
  const { options, group, at } = fixture();
  group.rotation(30);
  group.scaleX(-1);
  const gesture = createStudioCropGesture({
    ...options,
    kind: 'bottom-left',
    ...at(90, 60),
    zoom: 2,
  });
  expect(gesture?.kind).toBe('bottom-left');
  expect(gesture?.start.x).toBeCloseTo(90);
  expect(gesture?.start.y).toBeCloseTo(60);
});

it.each([
  ['left', -10, 120],
  ['right', 310, 120],
  ['top', 150, -10],
  ['bottom', 150, 250],
  ['inside', 150, 120],
] as const)('limits a stage crop activation at the %s edge to the padded frame', (edge, x, y) => {
  const { options, at } = fixture();
  const gesture = createStudioCropGesture({ ...options, ...at(x, y), insideFrameOnly: true });
  if (edge === 'inside') expect(gesture?.kind).toBe('pan');
  else expect(gesture).toBeNull();
});

it.each(['removed draft', 'different draft'] as const)(
  'does not apply a pending crop gesture to a %s',
  kind => {
    const { options, draft, stage, at } = fixture();
    const gesture = createStudioCropGesture(options)!;
    const current = kind === 'removed draft' ? null : { ...draft, nodeId: crypto.randomUUID() };
    expect(updateStudioCropGesture({ draft: current, gesture, stage, ...at(180, 120) })).toBe(
      current
    );
  }
);

it('pans the real image crop in native local coordinates while keeping its frame and metadata intact', () => {
  const { options, draft, stage, at } = fixture();
  const gesture = createStudioCropGesture(options)!;
  const next = updateStudioCropGesture({ draft, gesture, stage, ...at(180, 120) })!;
  expect(next.state.crop.x).toBeLessThan(draft.state.crop.x);
  expect(next.state.crop.y).toBe(draft.state.crop.y);
  expect(next.state.frame).toEqual(draft.state.frame);
  expect(next.state.crop.naturalWidth).toBe(200);
  expect(next.state.crop.naturalHeight).toBe(80);
  expect(next.nodeId).toBe(draft.nodeId);
});

it('resizes the native crop frame while preserving the source image dimensions', () => {
  const { options, draft, stage, at } = fixture();
  const gesture = createStudioCropGesture({ ...options, kind: 'bottom-right', ...at(300, 240) })!;
  const next = updateStudioCropGesture({ draft, gesture, stage, ...at(330, 270) })!;
  expect(next.state.frame.width).toBeGreaterThan(draft.state.frame.width);
  expect(next.state.frame.height).toBe(draft.state.frame.height);
  expect(next.state.crop.naturalWidth).toBe(200);
  expect(next.state.crop.naturalHeight).toBe(80);
});
