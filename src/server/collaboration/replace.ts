import * as Y from 'yjs';
import { initialize } from '@/features/communication-studio/logic/collaboration';
import { documentSchema } from '@/features/communication-studio/logic/document';
/** An explicit, revision-checked server command; never used for live autosave. */
export function replaceStudioProjection(state: Uint8Array, value: unknown) {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, state);
    doc.transact(() => {
      for (const key of ['meta', 'pages', 'posts']) doc.getMap(key).clear();
      initialize(doc, documentSchema.parse(value));
    });
    return Y.encodeStateAsUpdate(doc);
  } finally {
    doc.destroy();
  }
}
