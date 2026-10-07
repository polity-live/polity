import { expect, it } from 'vitest';
import { defaultBrand, element } from '../document';
import { createStudioNodeFromElement } from '../create-studio-node';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { studioDocumentV5Schema } from '../document-v3';
import { studioScenePaintOrder } from '../studio-scene';
import { studioProjectionFileId } from '../media-projection';
import { studioEditorCommandSchemas } from '../editor-commands';

it.each(['image', 'video'] as const)(
  'refuses inserting %s media until its asset has been selected',
  type => {
    const source = element(type);
    expect(source.assetId).toBeNull();
    expect(() => createStudioNodeFromElement(source, crypto.randomUUID(), 0)).toThrow(
      'Media asset missing'
    );
    expect(studioProjectionFileId(source, false)).toBe(`polity-${source.id}-missing-pending`);
    expect(studioProjectionFileId(source, true)).toBe(`polity-${source.id}-missing-ready`);
  }
);

it('paints the complete validated scene without a root filter and omits absent or hidden root frames', () => {
  const document = studioDocumentV5Schema.parse(
    createStudioTemplateDocumentV5('single', 'Scene boundaries', defaultBrand)
  );
  const frame = document.nodes.find(node => node.type === 'frame')!;
  const order = studioScenePaintOrder(document);
  expect(order[0].id).toBe(frame.id);
  expect(order.map(node => node.id)).toEqual(
    expect.arrayContaining(document.nodes.filter(node => node.visible).map(node => node.id))
  );
  expect(studioScenePaintOrder(document, crypto.randomUUID())).toEqual([]);
  const hidden = structuredClone(document);
  hidden.nodes.find(node => node.id === frame.id)!.visible = false;
  expect(studioScenePaintOrder(studioDocumentV5Schema.parse(hidden), frame.id)).toEqual([]);
});

it('validates actual editor command inputs before canvas selection or preview changes', () => {
  const pageId = crypto.randomUUID();
  const nodeId = crypto.randomUUID();
  expect(
    studioEditorCommandSchemas.studio_select_elements.parse({ pageId, elementIds: [nodeId] })
  ).toEqual({ pageId, elementIds: [nodeId] });
  expect(
    studioEditorCommandSchemas.studio_select_page.safeParse({ pageId: 'invalid' }).success
  ).toBe(false);
  expect(studioEditorCommandSchemas.studio_preview.parse({ playing: false })).toEqual({
    playing: false,
  });
  expect(studioEditorCommandSchemas.studio_open_panel.safeParse({ panel: 'unknown' }).success).toBe(
    false
  );
});
