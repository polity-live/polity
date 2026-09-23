import { describe, expect, it } from 'vitest';
import { defaultBrand } from '../../../src/features/communication-studio/logic/document';
import { applyStudioCommandV3 } from '../../../src/features/communication-studio/logic/commands-v3';
import { studioDocumentV5Schema } from '../../../src/features/communication-studio/logic/document-v3';
import { createStudioTemplateDocumentV5 } from '../../../src/features/communication-studio/logic/templates-v5';
import { editableV5Layers } from '../editable-v5-layers';

describe('editable V5 presentation layers', () => {
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
