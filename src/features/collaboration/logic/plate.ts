import { withTYjs, withTYHistory } from '@platejs/yjs';
import type { AnyPlatePlugin, TPlateEditor } from 'platejs/react';
import * as Y from 'yjs';

export function bindPlateDocument(editor: TPlateEditor, doc: Y.Doc) {
  const shared = withTYHistory(
    withTYjs(editor, doc.get('content', Y.XmlText), { autoConnect: false })
  );
  // Plate creates transform aliases before the asynchronous Yjs binding.
  // Its deletion transforms call tf.apply directly; leaving that alias stale
  // would remove text only in Slate while retaining it in the shared document.
  editor.tf.apply = shared.apply as typeof editor.tf.apply;
  editor.api.onChange = shared.onChange as typeof editor.api.onChange;
  // Native navigation updates the DOM caret before Slate's throttled
  // selectionchange listener. Commit that destination before the next input.
  const root = editor.getPlugin({ key: 'root' }) as AnyPlatePlugin;
  const onKeyUp = root.handlers.onKeyUp;
  root.handlers.onKeyUp = context => {
    if (
      /^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End|PageUp|PageDown)$/.test(context.event.key)
    ) {
      const nativeSelection = window.getSelection();
      const selection =
        nativeSelection &&
        editor.api.toSlateRange(nativeSelection, {
          exactMatch: false,
          suppressThrow: true,
        });
      if (selection) editor.tf.select(selection);
    }
    return onKeyUp?.(context);
  };
  // Keyboard shortcuts must also use the new per-user Yjs undo.
  editor.tf.undo = () => shared.undo();
  editor.tf.redo = () => shared.redo();
  return shared;
}
