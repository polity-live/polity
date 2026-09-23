import { expect, it } from 'vitest';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { nativeTemplatePage } from '../native-template';
import { createDocument } from '../templates';
import { element } from '../document';
import { diffStudio, mergeStudio } from '../operations';

it('keeps template IDs and complex sources and converts a page only once', () => {
  const doc = createDocument('single', 'Native template');
  const page = doc.pages[0];
  const originalIds = page.elements.map(e => e.id);
  const table = element('table');
  const rich = element('text', { bold: true, text: 'Formatted' });
  page.elements.push(table, rich);
  const native = nativeTemplatePage(
    page,
    records =>
      records.map(e => ({
        ...e,
        angle: 0,
        isDeleted: false,
        version: 1,
        versionNonce: 0,
        updated: 0,
      })) as ExcalidrawElement[]
  );
  expect(native.elements).toEqual([table, rich]);
  expect(native.canvas?.elements.map(e => e.id)).toEqual(originalIds);
  expect(native.canvas?.elements.map(e => e.type)).toEqual(['text', 'text', 'text', 'rectangle']);
  expect(
    nativeTemplatePage(native, () => {
      throw Error('Must not run twice');
    })
  ).toBe(native);
  // Concurrent first opens may race. Replaying the same conversion is harmless.
  const next = { ...doc, pages: [native] };
  const changes = diffStudio(doc, next);
  const repeated = mergeStudio(next, changes);
  expect(repeated.conflicts).toEqual([]);
  next.pages[0].elements.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  expect(repeated.value).toEqual(next);
});
