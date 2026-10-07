import Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { studioDocumentV3Schema } from '../document-v3';
import {
  createStudioDragPreview,
  updateStudioDragPreview,
  clearStudioDragPreview,
} from '../canvas-drag-preview';

const stages: Konva.Stage[] = [];
afterEach(() => {
  for (const stage of stages.splice(0)) {
    const container = stage.container();
    stage.destroy();
    container.remove();
  }
});

function fixture() {
  const document = createStudioTemplateDocumentV5('single', 'Drag SDK contract', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const source = document.nodes.find(node => node.type === 'shape')!;
  const a = structuredClone(source),
    b = structuredClone(source);
  a.transform = { ...a.transform, x: 10, y: 20, width: 100, height: 80 };
  b.id = crypto.randomUUID();
  b.zIndex++;
  b.transform = { ...b.transform, x: 200, y: 20, width: 100, height: 80 };
  document.nodes = [frame, a, b];
  const value = studioDocumentV3Schema.parse(document);
  const container = globalThis.document.createElement('div');
  globalThis.document.body.append(container);
  const stage = new Konva.Stage({ container, width: 640, height: 480 });
  stages.push(stage);
  const layer = new Konva.Layer();
  stage.add(layer);
  const groups = value.nodes.map(
    node =>
      new Konva.Group({
        id: node.id,
        x: node.transform.x + node.transform.width / 2,
        y: node.transform.y + node.transform.height / 2,
        draggable: true,
      })
  );
  layer.add(groups[0]);
  groups[0].offset({ x: frame.transform.width / 2, y: frame.transform.height / 2 });
  groups[0].add(groups[1], groups[2]);
  const options = {
    document: value,
    selected: [a.id, b.id],
    stage,
    driverId: a.id,
    clientX: 100,
    clientY: 100,
  };
  return { value, frame, a, b, stage, groups, options };
}

it('moves real SDK followers once and restores their geometry and draggable state on cancellation', () => {
  const { options, a, b, groups, stage } = fixture();
  const preview = createStudioDragPreview(options);
  expect(preview.roots).toEqual([a.id, b.id]);
  expect(groups[2].draggable()).toBe(false);
  const updated = updateStudioDragPreview({
    ...options,
    preview,
    zoom: 2,
    clientX: 140,
    clientY: 120,
  });
  expect(updated.delta).toEqual({ x: 20, y: 10 });
  expect(groups[2].position()).toEqual({ x: 270, y: 70 });
  clearStudioDragPreview(stage, updated);
  expect(groups[2].position()).toEqual({ x: 250, y: 60 });
  expect(groups[2].draggable()).toBe(true);
});

it('initializes a missing preview and replaces a preview when the SDK driver changes', () => {
  const { options, a, b } = fixture();
  const first = updateStudioDragPreview({ ...options, preview: null, zoom: 1 });
  expect(first.driverId).toBe(a.id);
  const second = updateStudioDragPreview({ ...options, driverId: b.id, preview: first, zoom: 1 });
  expect(second.driverId).toBe(b.id);
});

it('starts an unselected driver independently and excludes locked or deleted selection IDs', () => {
  const { options, value, a, b } = fixture();
  expect(createStudioDragPreview({ ...options, selected: [] }).selectedIds).toEqual([a.id]);
  value.nodes.find(node => node.id === b.id)!.locked = true;
  const preview = createStudioDragPreview({
    ...options,
    selected: [a.id, b.id, crypto.randomUUID()],
  });
  expect(preview.roots).toEqual([a.id]);
});

it('preserves already-disabled followers and supports partially mounted native layers', () => {
  const { options, b, groups } = fixture();
  groups[2].draggable(false);
  const preview = createStudioDragPreview(options);
  expect(preview.disabledFollowers.get(b.id)).toBe(false);
  clearStudioDragPreview(options.stage, preview);
  expect(groups[2].draggable()).toBe(false);
  groups[2].destroy();
  expect(createStudioDragPreview(options).disabledFollowers.size).toBe(0);
  expect(() =>
    updateStudioDragPreview({ ...options, preview, zoom: 1, clientX: 110 })
  ).not.toThrow();
});

it('ignores followers deleted after a drag began without changing the canonical document', () => {
  const { options, value, b } = fixture();
  const preview = createStudioDragPreview(options);
  value.nodes = value.nodes.filter(node => node.id !== b.id);
  const before = structuredClone(value);
  updateStudioDragPreview({ ...options, preview, zoom: 1, clientX: 130 });
  expect(value).toEqual(before);
  studioDocumentV3Schema.parse(value);
});

it.each([false, true])(
  'restores a descendant driver without moving it twice when its SDK group is missing %s',
  missing => {
    const { options, frame, groups, a } = fixture();
    if (missing) groups[1].destroy();
    const preview = createStudioDragPreview({ ...options, selected: [frame.id, a.id] });
    expect(preview.roots).toEqual([frame.id]);
    updateStudioDragPreview({
      ...options,
      selected: [frame.id, a.id],
      preview,
      zoom: 1,
      clientX: 125,
    });
    if (!missing) expect(groups[1].position()).toEqual({ x: 60, y: 60 });
  }
);

it('keeps stale SDK drivers and unavailable stages safe during teardown', () => {
  const { options, value, a } = fixture();
  value.nodes = value.nodes.filter(node => node.id !== a.id);
  const stale = createStudioDragPreview(options);
  expect(stale.origins.has(a.id)).toBe(false);
  expect(() => updateStudioDragPreview({ ...options, preview: stale, zoom: 1 })).not.toThrow();
  const absent = createStudioDragPreview({ ...options, stage: null });
  expect(absent.initialDelta).toEqual({ x: 0, y: 0 });
  expect(() => clearStudioDragPreview(null, absent)).not.toThrow();
  expect(() => clearStudioDragPreview(null, null)).not.toThrow();
});

it('projects follower movement into a rotated parent and handles root followers in the same selection', () => {
  const { options, value, frame, b, groups } = fixture();
  value.nodes.find(node => node.id === frame.id)!.transform.rotation = 90;
  groups[0].rotation(90);
  groups[1].x(65);
  groups[1].y(63);
  const preview = createStudioDragPreview(options);
  expect(preview.initialDelta.x).toBeCloseTo(-3);
  expect(preview.initialDelta.y).toBeCloseTo(5);
  updateStudioDragPreview({ ...options, preview, zoom: 1, clientX: 123, clientY: 105 });
  expect(groups[2].x()).toBeCloseTo(260);
  expect(groups[2].y()).toBeCloseTo(40);
  value.nodes.find(node => node.id === b.id)!.parentFrameId = null;
  groups[2].moveTo(groups[0].getLayer()!);
  const rootPreview = createStudioDragPreview(options);
  updateStudioDragPreview({
    ...options,
    preview: rootPreview,
    zoom: 1,
    clientX: 123,
    clientY: 105,
  });
  expect(groups[2].position()).toEqual({ x: 270, y: 70 });
});
