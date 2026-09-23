import { expect, it } from 'vitest';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { patchStudioNode } from '../patch-studio-node';
import { legacyDocumentToV3, v3DocumentToLegacy } from '../v3-adapter';

it('keeps Plate marks and shape geometry when panel properties change', () => {
  const document = createStudioTemplateDocumentV5('single', 'Properties', defaultBrand);
  const text = document.nodes.find(node => node.type === 'richText');
  const shape = document.nodes.find(node => node.type === 'shape');
  if (!text || !shape) throw new Error('Missing template nodes');
  text.content = [
    {
      id: crypto.randomUUID(),
      type: 'p',
      children: [
        { id: crypto.randomUUID(), text: 'Bold', bold: true },
        { id: crypto.randomUUID(), text: ' normal', color: '#ff0000' },
      ],
    },
  ];
  shape.shape = 'diamond';
  patchStudioNode(text, { x: 120, opacity: 0.7 });
  patchStudioNode(shape, { fill: '#ff0000' });
  expect(text.content[0].children).toMatchObject([
    { text: 'Bold', bold: true },
    { text: ' normal', color: '#ff0000' },
  ]);
  expect(shape.shape).toBe('diamond');
  const restored = legacyDocumentToV3(v3DocumentToLegacy(document), document);
  expect(restored.nodes.find(node => node.id === text.id)).toMatchObject({ content: text.content });
  expect(restored.nodes.find(node => node.id === shape.id)).toMatchObject({ shape: 'diamond' });
});
