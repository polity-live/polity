import { it, expect } from 'vitest';
import { canvasSceneSchema, durableElements } from '../canvas-schema';
import { createDocument } from '../templates';
import {
  diffStudio,
  mergeStudio,
  mergeStudioV3,
  inverseChanges,
  studioOperationSchema,
  stableJson,
} from '../operations';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../v3-adapter';
import { element } from '../document';
import { polityProjection, readPolityGeometry, duplicatedPolityElements } from '../canvas-adapter';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { canvasLayers } from '../canvas-layers';
import { captureCanvasOrder, orderedScene, nativeSceneChanged } from '../canvas-adapter';
const shape = {
  id: 'shape',
  type: 'rectangle' as const,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  angle: 0,
  isDeleted: false,
};
it('ignores SDK index repair and preserves both first drawings on a legacy Studio page', () => {
  expect(
    nativeSceneChanged({ version: 1, elements: [shape, { ...shape, id: 'other' }], files: {} }, [
      { ...shape, id: 'other', index: 'a0' },
      { ...shape, index: 'a1' },
    ] as unknown as ExcalidrawElement[])
  ).toBe(false);
  const legacy = createDocument('single', 'Legacy');
  delete legacy.pages[0].canvas;
  const alice = structuredClone(legacy),
    bob = structuredClone(legacy);
  alice.pages[0].canvas = { version: 1, elements: [shape], files: {} };
  bob.pages[0].canvas = { version: 1, elements: [{ ...shape, id: 'other' }], files: {} };
  const first = mergeStudio(legacy, diffStudio(legacy, alice));
  const second = mergeStudio(first.value, diffStudio(legacy, bob));
  expect(second.conflicts).toEqual([]);
  expect(second.value.pages[0].canvas?.elements.map(e => e.id)).toEqual(['shape', 'other']);
  const undo = mergeStudio(second.value, inverseChanges(diffStudio(legacy, alice)));
  expect(undo.conflicts).toEqual([]);
  expect(undo.value.pages[0].canvas?.elements.map(e => e.id)).toEqual(['other']);
});
it('preserves mixed native and structured layer order without rewriting unrelated records', () => {
  const source = element('text', { text: 'Structured', order: 0 });
  const page = {
    ...createDocument('whiteboard', 'Layers').pages[0],
    elements: [source],
    canvas: { version: 1 as const, elements: [shape], files: {} },
  };
  const proxy = {
    ...shape,
    id: source.id,
    customData: { polityElement: source.id },
  } as unknown as ExcalidrawElement;
  const native = shape as unknown as ExcalidrawElement;
  const captured = captureCanvasOrder(page, [proxy, native]);
  const next = {
    ...page,
    elements: [{ ...source, order: captured.orders.get(source.id)! }],
    canvas: { ...page.canvas, elements: durableElements(captured.elements) },
  };
  expect(canvasLayers(next).map(l => l.kind)).toEqual(['polity', 'native']);
  expect(orderedScene(next, [proxy]).map(e => e.id)).toEqual([source.id, shape.id]);
  const restored = captureCanvasOrder(next, orderedScene(next, [proxy]));
  expect(durableElements(restored.elements)).toEqual(next.canvas.elements);
});
it.each([
  ['Send backward', ['first', 'third', 'second']],
  ['Bring forward', ['first', 'third', 'second']],
  ['Send to back', ['third', 'first', 'second']],
  ['Bring to front', ['second', 'third', 'first']],
] as const)('saves %s through V3 and restores it with undo', (_action, order) => {
  const legacy = createDocument('whiteboard', 'Layer actions');
  legacy.pages[0].elements = [];
  legacy.pages[0].canvas = {
    version: 1,
    elements: ['first', 'second', 'third'].map((id, index) => ({
      ...shape,
      id,
      x: index * 120,
      customData: { polityOrder: index },
    })),
    files: {},
  };
  const before = legacyDocumentToV3(legacy);
  const page = legacy.pages[0];
  const scene = order.map(id =>
    page.canvas!.elements.find(element => element.id === id)!
  ) as unknown as ExcalidrawElement[];
  const captured = captureCanvasOrder(page, scene);
  const reordered = {
    ...legacy,
    pages: [
      {
        ...page,
        canvas: { ...page.canvas!, elements: durableElements(captured.elements) },
      },
    ],
  };
  const after = legacyDocumentToV3(reordered, before);
  const changes = diffStudio(before, after);
  expect(
    studioOperationSchema.safeParse({
      projectId: crypto.randomUUID(),
      operationId: crypto.randomUUID(),
      changes,
    }).success
  ).toBe(true);
  const applied = mergeStudioV3(before, changes);
  expect(applied.conflicts).toEqual([]);
  expect(
    order.map(id => applied.value.nodes.find(node => node.excalidraw?.id === id)?.zIndex)
  ).toEqual([0, 1, 2]);
  const undone = mergeStudioV3(applied.value, inverseChanges(changes));
  expect(undone.conflicts).toEqual([]);
  const ordered = (document: typeof before) =>
    stableJson({
      ...document,
      nodes: [...document.nodes].sort((a, b) => a.id.localeCompare(b.id)),
    });
  expect(ordered(undone.value)).toBe(ordered(before));
});
it('does not persist SDK clocks or derived Polity image records', () => {
  expect(
    durableElements([
      { ...shape, customData: undefined, version: 4, versionNonce: 8, updated: 10, index: 'a1' },
      { ...shape, id: 'preview', customData: { polityElement: 'source' } },
    ])
  ).toEqual([shape]);
});
it('rejects executable links, duplicate IDs and executable image formats', () => {
  expect(
    canvasSceneSchema.safeParse({
      version: 1,
      elements: [{ ...shape, link: 'javascript:alert(1)' }],
      files: {},
    }).success
  ).toBe(false);
  expect(
    canvasSceneSchema.safeParse({ version: 1, elements: [shape, shape], files: {} }).success
  ).toBe(false);
  expect(
    canvasSceneSchema.safeParse({
      version: 1,
      elements: [],
      files: {
        svg: {
          id: 'svg',
          mimeType: 'image/svg+xml',
          dataURL: 'data:image/svg+xml;base64,AAAA',
          created: 0,
        },
      },
    }).success
  ).toBe(false);
});
it('merges independent appearance changes but treats a geometry gesture atomically', () => {
  const base = createDocument('whiteboard', 'Test');
  base.pages[0].canvas = { version: 1, elements: [shape], files: {} };
  const alice = structuredClone(base),
    bob = structuredClone(base),
    color = structuredClone(base);
  alice.pages[0].canvas!.elements[0].x = 50;
  bob.pages[0].canvas!.elements[0].y = 50;
  color.pages[0].canvas!.elements[0].strokeColor = '#12362D';
  expect(mergeStudio(alice, diffStudio(base, bob)).conflicts).toHaveLength(1);
  const combined = mergeStudio(alice, diffStudio(base, color));
  expect(combined.conflicts).toEqual([]);
  const undone = mergeStudio(combined.value, inverseChanges(diffStudio(base, alice)));
  expect(undone.value.pages[0].canvas!.elements[0]).toMatchObject({ x: 0, strokeColor: '#12362D' });
});

it('round-trips rotated sources and preserves structured content when duplicating and grouping', () => {
  const doc = createDocument('whiteboard', 'Test');
  const source = element('text', {
    x: 120,
    y: 90,
    width: 300,
    height: 120,
    rotation: 37,
    text: 'Structured text',
  });
  const page = { ...doc.pages[0], elements: [source] };
  const shown = {
    ...shape,
    id: source.id,
    type: 'image',
    ...polityProjection(source),
    width: source.width,
    height: source.height,
    opacity: 100,
    locked: false,
    groupIds: [],
    customData: { polityElement: source.id },
  } as unknown as ExcalidrawElement;
  expect(readPolityGeometry(page, [shown])).toEqual([]);
  expect(polityProjection({ ...source, flipX: true, flipY: false }).scale).toEqual([-1, 1]);
  expect(
    readPolityGeometry(page, [{ ...shown, scale: [-1, 1] } as ExcalidrawElement])[0].patch
  ).toMatchObject({ flipX: true, flipY: false });
  const moved = { ...shown, x: shown.x + 50, groupIds: ['group'] };
  expect(readPolityGeometry(page, [moved])[0].patch).toMatchObject({ group: 'group' });
  expect(readPolityGeometry(page, [moved])[0].patch.x).toBeCloseTo(170);
  const [copy] = duplicatedPolityElements(page, [{ ...moved, id: 'copy' }]);
  expect(copy).toMatchObject({
    id: 'copy',
    text: source.text,
    richText: source.richText,
    group: 'group',
  });
  expect(copy.x).toBeCloseTo(170);
});

it('persists native image crop geometry instead of treating the crop as a resize', () => {
  const source = element('image', {
    assetId: crypto.randomUUID(),
    width: 200,
    height: 100,
  });
  const crop = {
    x: 50,
    y: 10,
    width: 100,
    height: 80,
    naturalWidth: 200,
    naturalHeight: 100,
  };
  const shown = {
    ...shape,
    id: source.id,
    type: 'image',
    ...polityProjection(source),
    width: 100,
    height: 80,
    opacity: 100,
    locked: false,
    groupIds: [],
    crop,
    customData: { polityElement: source.id },
  } as unknown as ExcalidrawElement;

  const patch = readPolityGeometry(
    { ...createDocument('whiteboard', 'Crop').pages[0], elements: [source] },
    [shown]
  )[0].patch;
  expect(patch).toMatchObject({ width: 100, height: 80, crop });

  const legacy = createDocument('whiteboard', 'Crop');
  legacy.pages[0].elements = [{ ...source, ...patch }];
  const roundTrip = v3DocumentToLegacy(legacyDocumentToV3(legacy));
  expect(roundTrip.pages[0].elements[0].crop).toEqual(crop);
});
