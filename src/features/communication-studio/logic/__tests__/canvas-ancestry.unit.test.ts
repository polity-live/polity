import { expect, it } from 'vitest';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { studioDocumentV3Schema } from '../document-v3';
import { studioCanvasAncestors } from '../canvas-ancestry';

it('orders actual nested frame ancestors from the outer frame to the inner frame', () => {
  const document = createStudioTemplateDocumentV5('single', 'Ancestry', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const nested = { ...structuredClone(frame), id: crypto.randomUUID(), parentFrameId: frame.id };
  document.nodes.push(nested);
  studioDocumentV3Schema.parse(document);
  expect(studioCanvasAncestors(document.nodes, nested.id)).toEqual([frame, nested]);
  expect(studioCanvasAncestors(document.nodes, null)).toEqual([]);
});
it('retains the available ancestors when consuming a partial node snapshot', () => {
  const document = createStudioTemplateDocumentV5('single', 'Partial scene', defaultBrand);
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const nested = { ...structuredClone(frame), id: crypto.randomUUID(), parentFrameId: frame.id };
  document.nodes.push(nested);
  studioDocumentV3Schema.parse(document);
  expect(studioCanvasAncestors([nested], nested.id)).toEqual([nested]);
  expect(studioCanvasAncestors([], frame.id)).toEqual([]);
});
