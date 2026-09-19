import { withTYjs, withTYHistory } from '@platejs/yjs';
import type { TPlateEditor } from 'platejs/react';
import * as Y from 'yjs';

export function bindPlateDocument(editor: TPlateEditor, doc: Y.Doc) {
  const shared = withTYHistory(
    withTYjs(editor, doc.get('content', Y.XmlText), { autoConnect: false })
  );
  // Plate creates transform aliases before the asynchronous Yjs binding.
  // Its deletion transforms call tf.apply directly; leaving that alias stale
  // would remove text only in Slate while retaining it in the shared document.
  editor.tf.apply = shared.apply as typeof editor.tf.apply;
  // Keyboard shortcuts must also use the new per-user Yjs undo.
  editor.tf.undo = () => shared.undo();
  editor.tf.redo = () => shared.redo();
  return shared;
}
