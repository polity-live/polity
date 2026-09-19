import { describe, expect, it } from 'vitest';
import { createPlateEditor } from 'platejs/react';
import { bindPlateDocument } from '../logic/plate';
import * as Y from 'yjs';
import { seedDocument, projectDocument } from '../logic/codec';

describe('installed Plate and slate-yjs adapter contract', () => {
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
