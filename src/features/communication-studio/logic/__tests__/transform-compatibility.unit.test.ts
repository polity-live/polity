import { expect, it } from 'vitest';
import { element, elementSchema, type StudioElement } from '../document';
import {
  createFrameNode,
  createStudioDocumentV3,
  studioDocumentV3Schema,
  transformSchema,
} from '../document-v3';
import { createStudioNodeFromElement } from '../create-studio-node';
import { legacyDocumentToV3, semanticElement, v3DocumentToLegacy } from '../v3-adapter';

const geometry = [
  { x: 6449.05857, y: 134.7874, width: 1689.6, height: 674.784, rotation: 0 },
  { x: -6449, y: -6449, width: 6000, height: 6000, rotation: 721 },
  { x: 6449, y: 6449, width: 2, height: 3, rotation: -721 },
  { x: -1_000_000, y: 1_000_000, width: 1, height: 100_000, rotation: -360_000 },
  { x: 1_000_000, y: -1_000_000, width: 100_000, height: 1, rotation: 360_000 },
];

it.each(['chart', 'text', 'rect', 'table'] as const)(
  'preserves all valid canonical transform ranges when rendering and exporting %s',
  type => {
    for (const transform of geometry) {
      const document = createStudioDocumentV3('Geometry compatibility');
      const frame = createFrameNode('widescreen');
      const node = createStudioNodeFromElement(element(type), frame.id, 0);
      if (node.type === 'frame') throw new Error('Expected a semantic node');
      node.transform = transformSchema.parse({ ...transform, flipX: true, flipY: true });
      document.nodes = [frame, node];
      const before = structuredClone(document);
      const validated = studioDocumentV3Schema.parse(document);
      const renderedNode = validated.nodes[1];
      if (renderedNode.type === 'frame') throw new Error('Expected a semantic node');
      expect(semanticElement(renderedNode)).toMatchObject(node.transform);
      const exported = v3DocumentToLegacy(validated);
      expect(exported.pages[0].elements[0]).toMatchObject(node.transform);
      const restored = legacyDocumentToV3(exported, validated).nodes.find(n => n.id === node.id)!;
      expect(restored.transform).toEqual(node.transform);
      node.parentFrameId = null;
      expect(semanticElement(node)).toMatchObject(node.transform);
      node.parentFrameId = frame.id;
      expect(document).toEqual(before);
    }
  }
);

const invalidGeometry: [keyof StudioElement, number][] = [
  ['x', -1_000_001],
  ['x', 1_000_001],
  ['y', -1_000_001],
  ['y', 1_000_001],
  ['width', 0],
  ['width', 100_001],
  ['height', 0],
  ['height', 100_001],
  ['rotation', -360_001],
  ['rotation', 360_001],
  ...(['x', 'y', 'width', 'height', 'rotation'] as const).flatMap(field =>
    [NaN, Infinity, -Infinity].map(value => [field, value] as [typeof field, number])
  ),
];

it.each(invalidGeometry)('rejects invalid %s=%s at both document boundaries', (field, value) => {
  const source = element('rect');
  expect(elementSchema.safeParse({ ...source, [field]: value }).success).toBe(false);
  expect(transformSchema.safeParse({ ...source, [field]: value }).success).toBe(false);
});

it('keeps default rotation and reflection identical across document boundaries', () => {
  const transform = { x: 6449, y: -6449, width: 1, height: 100_000 };
  const canonical = transformSchema.parse(transform);
  expect(element('rect', transform)).toMatchObject(canonical);
  expect(canonical).toMatchObject({ rotation: 0, flipX: false, flipY: false });
});
