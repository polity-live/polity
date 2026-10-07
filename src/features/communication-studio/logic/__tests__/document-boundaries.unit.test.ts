import { expect, it } from 'vitest';
import {
  assertCanReparent,
  createFrameNode,
  createStudioDocumentV5,
  frameChildren,
} from '../document-v3';
import {
  canvasElementSchema,
  canvasSceneSchema,
  durableElements,
  emptyCanvasScene,
} from '../canvas-schema';
import { chartDataSchema, sorted, validateExport } from '../document';
import { createDocument } from '../templates';
import { amendmentActionSchema, studioActionSchema } from '@/features/project-chat/logic/contracts';

it('sorts direct frame children by stacking order and stable identity without including grandchildren', () => {
  const document = createStudioDocumentV5('Hierarchy', 'single');
  const root = createFrameNode('square');
  const a = createFrameNode('square', {
    id: '00000000-0000-4000-8000-000000000001',
    parentFrameId: root.id,
    zIndex: 2,
  });
  const b = createFrameNode('square', {
    id: '00000000-0000-4000-8000-000000000002',
    parentFrameId: root.id,
    zIndex: 2,
  });
  const first = createFrameNode('square', { parentFrameId: root.id, zIndex: 1 });
  const grandchild = createFrameNode('square', { parentFrameId: a.id, zIndex: 0 });
  document.nodes = [root, b, grandchild, a, first];
  expect(frameChildren(document, root.id).map(node => node.id)).toEqual([first.id, a.id, b.id]);
  expect(frameChildren(document, 'missing')).toEqual([]);
  expect(document.nodes[1]).toBe(b);
});

it('rejects duplicate selections, absent nodes, locked nodes and invalid reparenting destinations before changing the tree', () => {
  const document = createStudioDocumentV5('Reparent', 'single');
  const root = createFrameNode('square');
  const child = createFrameNode('square', { parentFrameId: root.id });
  document.nodes = [root, child];
  const before = structuredClone(document);
  expect(() => assertCanReparent(document, [child.id, child.id], null)).toThrow(
    'Duplicate node IDs'
  );
  expect(() => assertCanReparent(document, [child.id], 'missing')).toThrow(
    'Parent must be a frame'
  );
  expect(() => assertCanReparent(document, ['missing'], root.id)).toThrow('Node not found');
  expect(() => assertCanReparent(document, [root.id], root.id)).toThrow('Circular frame hierarchy');
  expect(() => assertCanReparent(document, [root.id], child.id)).toThrow(
    'Circular frame hierarchy'
  );
  expect(document).toEqual(before);
  child.locked = true;
  expect(() => assertCanReparent(document, [child.id], null)).toThrow('Node is locked');
  child.locked = false;
  expect(() => assertCanReparent(document, [child.id], null)).not.toThrow();
});

const canvasElement = {
  id: 'native-shape',
  type: 'rectangle',
  x: 12,
  y: 18,
  width: 20,
  height: 30,
  angle: 0,
  isDeleted: false,
};

it('validates canvas links against web, local and fragment destinations while excluding unsafe schemes', () => {
  for (const link of ['https://polity.live/studio', '/studio', '#selection', '', null, undefined])
    expect(canvasElementSchema.safeParse({ ...canvasElement, link }).success).toBe(true);
  for (const link of ['javascript:alert(1)', 'data:text/html,hello', '//foreign.example'])
    expect(canvasElementSchema.safeParse({ ...canvasElement, link }).success).toBe(false);
});

it('rejects duplicate canvas identities and excessive aggregate embedded media independently of individual file limits', () => {
  expect(
    canvasSceneSchema.safeParse({ ...emptyCanvasScene(), elements: [canvasElement, canvasElement] })
      .success
  ).toBe(false);
  const dataURL = 'data:image/png;base64,' + 'A'.repeat(8_000_000);
  const files = Object.fromEntries(
    ['a', 'b', 'c'].map(id => [id, { id, mimeType: 'image/png', dataURL, created: 0 }])
  );
  const result = canvasSceneSchema.safeParse({ ...emptyCanvasScene(), files });
  expect(result.success).toBe(false);
  expect(result.error?.issues).toContainEqual(
    expect.objectContaining({ code: 'custom', path: [] })
  );
});

it('persists native canvas content without SDK clocks, undefined values or generated template projections', () => {
  const input = [
    {
      ...canvasElement,
      version: 7,
      versionNonce: 22,
      updated: 100,
      index: 'a1',
      customData: undefined,
      bindings: undefined,
      link: '/studio',
    },
    { ...canvasElement, id: 'projection', customData: { polityElement: 'legacy-node' } },
  ];
  expect(durableElements(input)).toEqual([{ ...canvasElement, link: '/studio' }]);
  expect(input[0].version).toBe(7);
  expect(emptyCanvasScene()).toEqual({ version: 1, elements: [], files: {} });
});

it('sorts legacy content with stable identity ties while preserving the original ordering', () => {
  const items = [
    { id: 'b', order: 1 },
    { id: 'a', order: 1 },
    { id: 'first', order: 0 },
  ];
  expect(sorted(items).map(item => item.id)).toEqual(['first', 'a', 'b']);
  expect(items.map(item => item.id)).toEqual(['b', 'a', 'first']);
});

it('rejects a long-video export with a missing page instead of accepting an incomplete duration calculation', () => {
  const document = createDocument('video', 'Invalid video reference');
  document.posts[0].pageIds.push(crypto.randomUUID());
  expect(() => validateExport(document, [], true)).toThrow();
});

it('requires actual element properties for a patch and actual text marks for formatting', () => {
  expect(studioActionSchema.safeParse({ type: 'project.patch', patch: {} }).success).toBe(false);
  expect(
    studioActionSchema.parse({ type: 'project.patch', patch: { title: 'Renamed' } })
  ).toMatchObject({ patch: { title: 'Renamed' } });
  const patch = { type: 'element.patch', page: { id: 'page' }, element: { id: 'node' } };
  expect(studioActionSchema.safeParse({ ...patch, patch: {} }).success).toBe(false);
  expect(studioActionSchema.parse({ ...patch, patch: { x: 25 } })).toMatchObject({
    patch: { x: 25 },
  });
  const format = { type: 'text.format', anchorRef: 'text_0_0' };
  expect(amendmentActionSchema.safeParse({ ...format, marks: {} }).success).toBe(false);
  expect(amendmentActionSchema.parse({ ...format, marks: { bold: true } })).toMatchObject({
    marks: { bold: true },
  });
});

it('requires a pie chart to have one matching nonnegative series containing a positive value', () => {
  const series = { id: crypto.randomUUID(), name: 'Votes', color: '#112233', values: [1, 2] };
  const chart = { kind: 'pie', labels: ['Yes', 'No'], series: [series] };
  expect(chartDataSchema.safeParse(chart).success).toBe(true);
  expect(
    chartDataSchema.safeParse({
      ...chart,
      series: [series, { ...series, id: crypto.randomUUID() }],
    }).success
  ).toBe(false);
  expect(
    chartDataSchema.safeParse({ ...chart, series: [{ ...series, values: [-1, 2] }] }).success
  ).toBe(false);
  expect(
    chartDataSchema.safeParse({ ...chart, series: [{ ...series, values: [0, 0] }] }).success
  ).toBe(false);
});

it('allows a complete long video to export through its carousel validation projection without changing the saved video', () => {
  const document = createDocument('video', 'Long video');
  if (document.pages.length === 1)
    document.pages.push({
      ...structuredClone(document.pages[0]),
      id: crypto.randomUUID(),
      order: 1,
    });
  document.pages.forEach(page => {
    page.duration = 40;
  });
  document.posts[0].pageIds = document.pages.map(page => page.id);
  const saved = structuredClone(document);
  expect(() => validateExport(document, [], true)).not.toThrow();
  expect(() => validateExport(document)).toThrow();
  expect(document).toEqual(saved);
});
