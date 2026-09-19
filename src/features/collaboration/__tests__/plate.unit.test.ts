import { describe, expect, it, vi } from 'vitest';
import { createPlateEditor, type AnyPlatePlugin } from 'platejs/react';
import { bindPlateDocument } from '../logic/plate';
import * as Y from 'yjs';
import { seedDocument, projectDocument } from '../logic/codec';

describe('installed Plate and slate-yjs adapter contract', () => {
  it.each([true, false])(
    'synchronizes native navigation before input and retains a prior handler: %s',
    hasHandler => {
      const doc = seedDocument('document', [{ id: 'p', type: 'p', children: [{ text: 'Text' }] }]);
      const plate = createPlateEditor();
      const previous = vi.fn();
      const root = plate.getPlugin({ key: 'root' }) as AnyPlatePlugin;
      root.handlers.onKeyUp = hasHandler ? previous : undefined;
      const editor = bindPlateDocument(plate, doc);
      const nativeSelection = {} as Selection;
      const getSelection = vi.fn(() => nativeSelection as Selection | null);
      vi.stubGlobal('window', { getSelection });
      const destination = {
        anchor: { path: [0, 0], offset: 2 },
        focus: { path: [0, 0], offset: 2 },
      };
      const toSlateRange = vi.spyOn(editor.api, 'toSlateRange').mockReturnValue(destination);
      const select = vi.spyOn(editor.tf, 'select');
      const keyUp = (key: string) => root.handlers.onKeyUp?.({ event: { key } } as never);
      try {
        editor.connect();
        keyUp('ArrowLeft');
        expect(editor.selection).toEqual(destination);
        expect(select).toHaveBeenCalledOnce();
        toSlateRange.mockReturnValueOnce(null);
        keyUp('Home');
        getSelection.mockReturnValueOnce(null);
        keyUp('End');
        keyUp('a');
        expect(select).toHaveBeenCalledOnce();
        expect(toSlateRange).toHaveBeenCalledTimes(2);
        expect(getSelection).toHaveBeenCalledTimes(3);
        expect(previous).toHaveBeenCalledTimes(hasHandler ? 4 : 0);
      } finally {
        editor.disconnect();
        doc.destroy();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
      }
    }
  );
  it('flushes Plate API notifications automatically without a remote update or manual flush', async () => {
    const doc = seedDocument('document', [{ id: 'p', type: 'p', children: [{ text: 'Text' }] }]);
    const editor = bindPlateDocument(createPlateEditor(), doc);
    try {
      editor.connect();
      editor.tf.select({ path: [0, 0], offset: 4 });
      editor.tf.insertText(' automatically');
      editor.api.onChange();
      await Promise.resolve();
      expect(JSON.stringify(projectDocument('document', doc))).toContain('Text automatically');
    } finally {
      editor.disconnect();
      doc.destroy();
    }
  });
  it('applies Plate text operations to Yjs and remote changes back to Plate', () => {
    const doc = seedDocument('document', [{ id: 'p', type: 'p', children: [{ text: 'Text' }] }]);
    const editor = bindPlateDocument(createPlateEditor(), doc);
    editor.connect();
    editor.tf.select({ path: [0, 0], offset: 4 });
    editor.tf.insertText(' local');
    editor.flushLocalChanges();
    expect(JSON.stringify(projectDocument('document', doc))).toContain('Text local');
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc));
    (peer.get('content', Y.XmlText).toDelta()[0].insert as Y.XmlText).insert(0, 'remote ');
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(peer), 'remote');
    expect(JSON.stringify(editor.children)).toContain('remote Text local');
    editor.tf.undo();
    editor.flushLocalChanges();
    expect(JSON.stringify(projectDocument('document', doc))).toContain('remote Text');
    expect(JSON.stringify(projectDocument('document', doc))).not.toContain(' local');
    editor.tf.redo();
    editor.flushLocalChanges();
    expect(JSON.stringify(projectDocument('document', doc))).toContain('remote Text local');
    editor.disconnect();
    doc.destroy();
    peer.destroy();
  });
});
