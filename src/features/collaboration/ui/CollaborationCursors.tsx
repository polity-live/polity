import { useEffect } from 'react';
import { useEditorRef } from 'platejs/react';
import { CursorOverlayPlugin } from '@platejs/selection/react';
import { slateRangeToRelativeRange, relativeRangeToSlateRange, YjsEditor } from '@slate-yjs/core';
import * as Y from 'yjs';
import type { CollaborationClient } from '../hooks/useCollaborationDocument';
import { decodeDocument } from '../hooks/useCollaborationDocument';

function encode(position: Y.RelativePosition) {
  return btoa(String.fromCharCode(...Y.encodeRelativePosition(position)));
}
/** Relative positions survive simultaneous inserts; no second editor channel. */
export function CollaborationCursors({ client }: { client?: CollaborationClient }) {
  const editor = useEditorRef();
  useEffect(() => {
    const doc = client?.doc,
      awareness = client?.provider?.awareness;
    if (!doc || !awareness) return;
    const shared = doc.get('content', Y.XmlText),
      api = editor.getApi(CursorOverlayPlugin).cursorOverlay;
    const displayed = new Set<string>();
    let previous = '';
    const receive = () => {
      const active = new Set<string>();
      for (const [peer, state] of awareness.getStates()) {
        if (peer === doc.clientID || !state.cursor?.anchor || !state.cursor?.focus) continue;
        try {
          const selection = relativeRangeToSlateRange(shared, editor, {
            anchor: Y.decodeRelativePosition(decodeDocument(state.cursor.anchor)),
            focus: Y.decodeRelativePosition(decodeDocument(state.cursor.focus)),
          });
          if (!selection) continue;
          const id = String(peer),
            color = /^#[0-9a-f]{6}$/i.test(state.user?.color) ? state.user.color : '#B88A3B';
          api.addCursor(id, {
            selection,
            data: {
              style: { backgroundColor: color },
              selectionStyle: { backgroundColor: `${color}33` },
            },
          });
          active.add(id);
          displayed.add(id);
        } catch {
          /* A removed target has no cursor; it must not break the editor. */
        }
      }
      for (const id of displayed)
        if (!active.has(id)) {
          api.removeCursor(id);
          displayed.delete(id);
        }
    };
    const timer = setInterval(() => {
      try {
        // Flush local Slate operations before translating positions into Yjs IDs.
        if (YjsEditor.isYjsEditor(editor)) YjsEditor.flushLocalChanges(editor);
        const range = editor.selection
          ? slateRangeToRelativeRange(shared, editor, editor.selection)
          : null;
        const cursor = range ? { anchor: encode(range.anchor), focus: encode(range.focus) } : null;
        const key = JSON.stringify(cursor);
        if (key !== previous) {
          previous = key;
          awareness.setLocalStateField('cursor', cursor);
        }
        receive();
      } catch {
        /* Selection can briefly disappear while a remote block is removed. */
      }
    }, 150);
    awareness.on('change', receive);
    return () => {
      clearInterval(timer);
      awareness.off('change', receive);
      awareness.setLocalStateField('cursor', null);
      for (const id of displayed) api.removeCursor(id);
    };
  }, [editor, client?.doc, client?.provider]);
  return null;
}
