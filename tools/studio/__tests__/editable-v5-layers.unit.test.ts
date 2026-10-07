import { describe, expect, it } from 'vitest';
import { defaultBrand, element } from '../../../src/features/communication-studio/logic/document';
import { applyStudioCommandV3 } from '../../../src/features/communication-studio/logic/commands-v3';
import {
  studioDocumentV5Schema,
  createFrameNode,
  createStudioDocumentV5,
  drawingNodeSchema,
  embedNodeSchema,
  mediaNodeSchema,
} from '../../../src/features/communication-studio/logic/document-v3';
import { createStudioNodeFromElement } from '../../../src/features/communication-studio/logic/create-studio-node';
import { createStudioTemplateDocumentV5 } from '../../../src/features/communication-studio/logic/templates-v5';
import { editableV5Layers } from '../editable-v5-layers';

describe('editable V5 presentation layers', () => {
  it('rejects missing and non-frame export targets before flattening any objects', () => {
    const document = createStudioTemplateDocumentV5('single', 'Missing', defaultBrand);
    expect(() => editableV5Layers(document, crypto.randomUUID())).toThrow('Studio frame not found');
    expect(() =>
      editableV5Layers(document, document.nodes.find(node => node.type === 'richText')!.id)
    ).toThrow('Studio frame not found');
  });

  it.each([false, true])(
    'flattens nested frame backgrounds and multiplies inherited opacity (explicit style=%s)',
    explicit => {
      const document = createStudioDocumentV5('Nested');
      const root = createFrameNode('custom', {
        transform: {
          x: 100,
          y: 200,
          width: 200,
          height: 100,
          rotation: 90,
          flipX: true,
          flipY: true,
        },
      });
      const child = createFrameNode('custom', {
        parentFrameId: root.id,
        transform: { x: 10, y: 20, width: 60, height: 40, rotation: 0 },
      });
      child.style = {
        ...child.style,
        fill: explicit ? '#abcdef' : null,
        stroke: explicit ? '#fedcba' : null,
        opacity: 0.5,
      };
      const text = createStudioNodeFromElement(
        element('text', { text: 'Nested text', x: 5, y: 6, opacity: 0.4 }),
        child.id,
        0
      );
      document.frameDefaults.background = explicit ? '#112233' : null;
      document.nodes = [root, child, text];
      const layers = editableV5Layers(studioDocumentV5Schema.parse(document), root.id);
      expect(layers.map(layer => layer.node.id)).toEqual([child.id, text.id]);
      expect(layers[0]).toMatchObject({
        kind: 'polity',
        element: {
          x: 10,
          y: 20,
          width: 60,
          height: 40,
          opacity: 0.5,
          fill: explicit ? '#abcdef' : document.theme[document.theme.mode].background,
          stroke: explicit ? '#fedcba' : '#888888',
        },
      });
      expect(layers[1]).toMatchObject({ kind: 'polity', element: { x: 15, y: 26, opacity: 0.2 } });
    }
  );

  it('keeps freehand strokes in native paint order and skips nonvisual audio, files and embeds', () => {
    const document = createStudioDocumentV5('Native types');
    const root = createFrameNode();
    const native = { ...root, id: crypto.randomUUID(), parentFrameId: root.id, zIndex: 0 };
    const drawing = drawingNodeSchema.parse({
      ...native,
      type: 'drawing',
      points: [
        [0, 0],
        [10, 20],
      ],
    });
    const audio = mediaNodeSchema.parse({
      ...native,
      id: crypto.randomUUID(),
      zIndex: 1,
      type: 'media',
      mediaType: 'audio',
      assetId: crypto.randomUUID(),
    });
    const file = mediaNodeSchema.parse({
      ...audio,
      id: crypto.randomUUID(),
      zIndex: 2,
      mediaType: 'file',
    });
    const embed = embedNodeSchema.parse({
      ...native,
      id: crypto.randomUUID(),
      zIndex: 3,
      type: 'embed',
      provider: 'formula',
      value: 'x + y',
    });
    document.nodes = [root, drawing, audio, file, embed];
    expect(editableV5Layers(studioDocumentV5Schema.parse(document), root.id)).toEqual([
      { kind: 'drawing', node: drawing, matrix: [1, 0, 0, 1, 0, 0] },
    ]);
  });

  it('scales master-layer text, honors background/foreground placement and preserves per-run font sizes', () => {
    const document = createStudioDocumentV5('Master');
    const root = createFrameNode('custom', {
      transform: { x: 300, y: 400, width: 200, height: 200, rotation: 30 },
    });
    const master = createFrameNode('custom', {
      transform: { x: 10, y: 20, width: 100, height: 100, rotation: 45 },
    });
    const behind = createStudioNodeFromElement(
      element('rect', { x: 5, y: 6, width: 10, height: 20 }),
      master.id,
      0
    );
    const foreground = createStudioNodeFromElement(
      element('text', {
        x: 10,
        y: 15,
        fontSize: 20,
        richText: [
          {
            id: crypto.randomUUID(),
            type: 'p',
            children: [{ text: 'Sized', fontSize: 30 }, { text: 'Inherited' }],
          },
        ],
      }),
      master.id,
      1
    );
    const local = createStudioNodeFromElement(element('rect', { x: 1, y: 2 }), root.id, 0);
    if (foreground.type !== 'richText') throw new Error('Expected a native rich text node');
    foreground.content = [
      {
        id: crypto.randomUUID(),
        type: 'p',
        children: [
          { id: crypto.randomUUID(), text: 'Sized', fontSize: 30 },
          { id: crypto.randomUUID(), text: 'Inherited' },
        ],
      },
    ];
    document.nodes = [root, master, behind, foreground, local];
    document.masterLayout = { frameId: master.id, placements: { [behind.id]: 'background' } };
    const layers = editableV5Layers(studioDocumentV5Schema.parse(document), root.id);
    expect(layers.map(layer => layer.node.id)).toEqual([behind.id, local.id, foreground.id]);
    const scaled = layers[2];
    expect(scaled.kind).toBe('polity');
    if (scaled.kind !== 'polity') throw new Error('Expected editable rich text');
    expect(scaled.element.x).toBeCloseTo(20);
    expect(scaled.element.y).toBeCloseTo(30);
    expect(scaled.element.fontSize).toBeCloseTo(40);
    expect(scaled.element.richText[0].children[0].fontSize).toBeCloseTo(60);
    expect(scaled.element.richText[0].children[1].fontSize).toBeUndefined();
  });
  it('uses Layers panel order for shape, rich text, shape', () => {
    const document = createStudioTemplateDocumentV5('single', 'Editable stack', defaultBrand);
    const frame = document.nodes.find(node => node.type === 'frame')!;
    const text = document.nodes.find(node => node.type === 'richText')!;
    const shape = document.nodes.find(node => node.type === 'shape')!;
    const front = structuredClone(shape);
    front.id = crypto.randomUUID();
    shape.zIndex = 0;
    text.zIndex = 1;
    front.zIndex = 2;
    document.nodes = [frame, shape, text, front];
    const parsed = studioDocumentV5Schema.parse(document);
    const ids = (value: typeof parsed) =>
      editableV5Layers(value, frame.id).map(layer => layer.node.id);
    expect(ids(parsed)).toEqual([shape.id, text.id, front.id]);
    const raised = applyStudioCommandV3(parsed, {
      type: 'moveNode',
      nodeId: text.id,
      targetId: front.id,
      position: 'before',
    });
    expect(ids(raised)).toEqual([shape.id, front.id, text.id]);
    expect(
      editableV5Layers(raised, frame.id).find(layer => layer.node.id === text.id)
    ).toMatchObject({
      kind: 'polity',
      element: { type: 'text' },
    });
  });
});
