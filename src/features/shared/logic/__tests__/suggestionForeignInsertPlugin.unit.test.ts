import { BaseSuggestionPlugin, getInlineSuggestionData } from '@platejs/suggestion';
import { TextApi } from 'platejs';
import { createPlateEditor } from 'platejs/react';
import { describe, expect, it } from 'vitest';

import { SuggestionForeignInsertPlugin } from '../suggestionForeignInsertPlugin';

function createSuggestionEditor(currentUserId: string) {
  const editor = createPlateEditor({
    plugins: [BaseSuggestionPlugin, SuggestionForeignInsertPlugin],
    value: [
      {
        type: 'p',
        children: [
          {
            text: 'Prepared suggestion',
            suggestion: true,
            suggestion_prepared: {
              createdAt: 1,
              id: 'prepared',
              type: 'insert',
              userId: 'simulated-user',
            },
          },
        ],
      },
    ],
  });
  editor.setOption(BaseSuggestionPlugin, 'currentUserId', currentUserId);
  editor.setOption(BaseSuggestionPlugin, 'isSuggesting', true);
  editor.selection = {
    anchor: { path: [0, 0], offset: 19 },
    focus: { path: [0, 0], offset: 19 },
  };
  return editor;
}

describe('SuggestionForeignInsertPlugin', () => {
  it('creates a current-user suggestion when plain text is pasted beside a foreign suggestion', () => {
    const editor = createSuggestionEditor('current-user');

    editor.tf.insertText(' Pasted text');

    expect(editor.api.string([])).toBe('Prepared suggestion Pasted text');
    const insertedLeaf = editor.children[0].children.find(
      child => TextApi.isText(child) && child.text === ' Pasted text'
    );
    expect(insertedLeaf).toBeDefined();
    expect(getInlineSuggestionData(insertedLeaf as any)).toMatchObject({
      type: 'insert',
      userId: 'current-user',
    });
  });

  it('continues the current user suggestion without creating a second mark', () => {
    const editor = createSuggestionEditor('simulated-user');

    editor.tf.insertText(' continued');

    expect(editor.children[0].children).toHaveLength(1);
    expect(editor.api.string([])).toBe('Prepared suggestion continued');
    expect(getInlineSuggestionData(editor.children[0].children[0] as any)).toMatchObject({
      id: 'prepared',
      userId: 'simulated-user',
    });
  });

  it('uses ordinary insertion outside suggestion mode or without a selection', () => {
    const editor = createSuggestionEditor('current-user');
    editor.setOption(BaseSuggestionPlugin, 'isSuggesting', false);
    editor.tf.insertText(' ordinary');
    expect(editor.api.string([])).toContain(' ordinary');

    editor.setOption(BaseSuggestionPlugin, 'isSuggesting', true);
    editor.selection = null;
    editor.tf.insertText(' appended');
    expect(editor.api.string([])).toContain('appended');
  });

  it('uses ordinary insertion when no leaf exists at the selection', () => {
    const editor = createSuggestionEditor('current-user');
    editor.selection = {
      anchor: { path: [9, 0], offset: 0 },
      focus: { path: [9, 0], offset: 0 },
    };

    expect(() => editor.tf.insertText('ignored')).not.toThrow();
  });

  it('uses ordinary insertion when the selected node is not text', () => {
    const editor = createSuggestionEditor('current-user');
    editor.api.leaf = () => [{ children: [], type: 'p' }, [0]] as any;

    editor.tf.insertText(' ordinary');

    expect(editor.api.string([])).toContain(' ordinary');
  });
});
