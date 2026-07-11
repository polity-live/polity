import { BaseSuggestionPlugin } from '@platejs/suggestion';
import { describe, expect, it } from 'vitest';
import { createPlateEditor } from 'platejs/react';

import { SuggestionBreakCleanupPlugin } from '../suggestionBreakCleanupPlugin';

function createSuggestionEditor(isSuggesting: boolean) {
  const editor = createPlateEditor({
    plugins: [BaseSuggestionPlugin, SuggestionBreakCleanupPlugin],
    value: [
      {
        type: 'p',
        children: [
          { text: 'Base ' },
          {
            bold: true,
            suggestion: true,
            suggestion_test: {
              createdAt: 1,
              id: 'test',
              type: 'insert',
              userId: 'user-1',
            },
            text: 'green',
          },
        ],
      },
    ],
  });
  editor.setOption(BaseSuggestionPlugin, 'currentUserId', 'user-1');
  editor.setOption(BaseSuggestionPlugin, 'isSuggesting', isSuggesting);
  return editor;
}

describe('SuggestionBreakCleanupPlugin', () => {
  it('removes inherited suggestion marks from a normal line break after suggestion mode', () => {
    const editor = createSuggestionEditor(false);
    editor.selection = {
      anchor: { path: [0, 1], offset: 5 },
      focus: { path: [0, 1], offset: 5 },
    };

    editor.tf.insertBreak();

    expect(editor.children[1]).toMatchObject({
      children: [{ bold: true, text: '' }],
      type: 'p',
    });
    expect(JSON.stringify(editor.children[1])).not.toContain('suggestion');
  });

  it('keeps real line-break suggestions while suggestion mode is active', () => {
    const editor = createSuggestionEditor(true);
    editor.selection = {
      anchor: { path: [0, 1], offset: 5 },
      focus: { path: [0, 1], offset: 5 },
    };

    editor.tf.insertBreak();

    expect(JSON.stringify(editor.children[1])).toContain('suggestion');
  });

  it('keeps trailing existing suggestion text when a line is split in its middle', () => {
    const editor = createSuggestionEditor(false);
    editor.selection = {
      anchor: { path: [0, 1], offset: 2 },
      focus: { path: [0, 1], offset: 2 },
    };

    editor.tf.insertBreak();

    expect(editor.children[1]).toMatchObject({
      children: [{ suggestion: true, text: 'een' }],
      type: 'p',
    });
  });
});
