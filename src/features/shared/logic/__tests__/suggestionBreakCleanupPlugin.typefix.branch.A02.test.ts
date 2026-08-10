import { BaseSuggestionPlugin } from '@platejs/suggestion';
import { describe, expect, it } from 'vitest';
import { createPlateEditor } from 'platejs/react';

import { SuggestionBreakCleanupPlugin } from '../suggestionBreakCleanupPlugin';

describe('suggestion break cleanup post-typefix selection guard', () => {
  it('returns the original break result when the editor cannot retain a selection', () => {
    const editor = createPlateEditor({
      plugins: [BaseSuggestionPlugin, SuggestionBreakCleanupPlugin],
      value: [{ type: 'p', children: [{ text: 'Text' }] }],
    });
    editor.setOption(BaseSuggestionPlugin, 'isSuggesting', false);
    Object.defineProperty(editor, 'selection', {
      configurable: true,
      get: () => null,
      set: () => undefined,
    });

    expect(editor.tf.insertBreak()).toBeUndefined();
    expect(editor.selection).toBeNull();
  });

  it('returns the original break result when the selected leaf disappeared', () => {
    const editor = createPlateEditor({
      plugins: [BaseSuggestionPlugin, SuggestionBreakCleanupPlugin],
      value: [{ type: 'p', children: [{ text: 'Text' }] }],
    });
    editor.setOption(BaseSuggestionPlugin, 'isSuggesting', false);
    editor.selection = {
      anchor: { path: [0, 0], offset: 4 },
      focus: { path: [0, 0], offset: 4 },
    };
    editor.api.leaf = () => undefined as never;

    expect(editor.tf.insertBreak()).toBeUndefined();
  });
});
