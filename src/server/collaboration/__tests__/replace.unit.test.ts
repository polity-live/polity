import { expect, it } from 'vitest';
import * as Y from 'yjs';
import { replaceStudioProjection } from '../replace';
import { createDocument } from '@/features/communication-studio/logic/templates';
import { initialize, readDocument } from '@/features/communication-studio/logic/collaboration';
it('publishes exactly the selected Studio draft without resurrecting removed pages and leaves invalid input unchanged', () => {
  const old = createDocument('carousel', 'Old campaign'),
    next = createDocument('single', 'Approved draft'),
    doc = new Y.Doc();
  initialize(doc, old);
  const state = Y.encodeStateAsUpdate(doc);
  expect(() => replaceStudioProjection(state, { invalid: true })).toThrow();
  expect(readDocument(doc)).toEqual(old);
  Y.applyUpdate(doc, replaceStudioProjection(state, next));
  expect(readDocument(doc)).toEqual(next);
  expect(
    readDocument(doc).pages.some(page => old.pages.some(previous => previous.id === page.id))
  ).toBe(false);
  doc.destroy();
});
