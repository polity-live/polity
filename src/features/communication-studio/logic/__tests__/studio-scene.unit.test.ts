import { describe, expect, it } from 'vitest';
import { defaultBrand } from '../document';
import { applyStudioCommandV3 } from '../commands-v3';
import { studioDocumentV5Schema, type StudioNode } from '../document-v3';
import { studioScenePaintOrder } from '../studio-scene';
import { createStudioTemplateDocumentV5 } from '../templates-v5';

describe('Studio V5 scene order', () => {
  it('creates starter text as semantic rich text and reorders it between shapes', () => {
    const template = createStudioTemplateDocumentV5('single', 'Layer test', defaultBrand);
    const frame = template.nodes.find(node => node.type === 'frame')!;
    const text = template.nodes.find(node => node.type === 'richText')!;
    const sourceShape = template.nodes.find(node => node.type === 'shape')!;
    const first = structuredClone(sourceShape);
    const last = structuredClone(sourceShape);
    first.id = crypto.randomUUID();
    first.zIndex = 0;
    last.id = crypto.randomUUID();
    last.zIndex = 2;
    text.zIndex = 1;
    const document = studioDocumentV5Schema.parse({
      ...template,
      nodes: [frame, first, text, last] satisfies StudioNode[],
    });
    const children = (value: typeof document) =>
      studioScenePaintOrder(value, frame.id)
        .filter(node => node.id !== frame.id)
        .map(node => node.id);

    expect(children(document)).toEqual([first.id, text.id, last.id]);
    const raised = applyStudioCommandV3(document, {
      type: 'moveNode',
      nodeId: text.id,
      targetId: last.id,
      position: 'before',
    });
    expect(children(raised)).toEqual([first.id, last.id, text.id]);
    const lowered = applyStudioCommandV3(raised, {
      type: 'moveNode',
      nodeId: text.id,
      targetId: first.id,
      position: 'after',
    });
    expect(children(lowered)).toEqual([text.id, first.id, last.id]);
  });

  it('keeps descendants in their frame stacking context', () => {
    const document = createStudioTemplateDocumentV5('single', 'Nested scene', defaultBrand);
    const root = document.nodes.find(node => node.type === 'frame')!;
    const child = document.nodes.find(node => node.type === 'richText')!;
    const nested = structuredClone(root);
    nested.id = crypto.randomUUID();
    nested.parentFrameId = root.id;
    nested.zIndex = 10;
    child.parentFrameId = nested.id;
    child.zIndex = 0;
    document.nodes.push(nested);
    const order = studioScenePaintOrder(studioDocumentV5Schema.parse(document), root.id);
    expect(order.findIndex(node => node.id === child.id)).toBeGreaterThan(
      order.findIndex(node => node.id === nested.id)
    );
  });

  it('duplicates rich text with independent Plate IDs and formatting', () => {
    const document = createStudioTemplateDocumentV5('single', 'Duplicate text', defaultBrand);
    const source = document.nodes.find(node => node.type === 'richText');
    if (!source || source.type !== 'richText') throw new Error('Text fixture missing');
    source.content[0].children = [{ id: crypto.randomUUID(), text: 'Styled', bold: true }];
    const duplicated = applyStudioCommandV3(studioDocumentV5Schema.parse(document), {
      type: 'duplicateNodes',
      nodeIds: [source.id],
    });
    const copy = duplicated.nodes.find(
      node => node.id !== source.id && node.type === 'richText' && node.name === source.name
    );
    expect(copy?.type).toBe('richText');
    if (copy?.type !== 'richText') return;
    expect(copy.content[0].children).toMatchObject([{ text: 'Styled', bold: true }]);
    expect(copy.content[0].id).not.toBe(source.content[0].id);
    expect(copy.content[0].children[0].id).not.toBe(source.content[0].children[0].id);
  });
});
