import { describe, it, expect } from 'vitest';
import { createPlateEditor } from 'platejs/react';
import { EditorKit } from '@/features/shared/ui/kit-platejs/editor-kit';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import { bindPlateDocument } from '../logic/plate';
import { seedDocument, projectDocument } from '../logic/codec';

describe('collaborative proposal typing', () => {
  it('persists a canonical replacement including deletion of the selected original text', async () => {
    const original = 'Original heading';
    const doc = seedDocument('document', [{ id: 'p', type: 'p', children: [{ text: original }] }]);
    const editor = bindPlateDocument(createPlateEditor({ plugins: EditorKit }), doc);
    editor.connect();
    editor.tf.select({
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: original.length },
    });
    editor.tf.insertText('Replacement');
    editor.flushLocalChanges();
    await Promise.resolve();
    expect(editor.api.string([])).toBe('Replacement');
    expect(projectDocument('document', doc)).toEqual(editor.children);
    editor.disconnect();
    doc.destroy();
  });
  it('keeps the caret after each newly marked character instead of moving the first character to the end', async () => {
    const doc = seedDocument('document', [{ id: 'p', type: 'p', children: [{ text: '' }] }]);
    const editor = bindPlateDocument(createPlateEditor({ plugins: EditorKit }), doc);
    editor.setOption(SuggestionPlugin, 'isSuggesting', true);
    editor.setOption(SuggestionPlugin, 'currentUserId', 'author');
    editor.connect();
    editor.tf.select({ path: [0, 0], offset: 0 });
    for (const char of 'Mehr Schatten') {
      editor.tf.insertText(char);
      editor.flushLocalChanges();
      await Promise.resolve();
    }
    expect(editor.api.string([])).toBe('Mehr Schatten');
    expect(JSON.stringify(projectDocument('document', doc))).toContain('Mehr Schatten');
    editor.disconnect();
    doc.destroy();
  });
});
