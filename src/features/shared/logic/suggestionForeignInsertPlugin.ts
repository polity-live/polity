import {
  BaseSuggestionPlugin,
  getInlineSuggestionData,
  insertTextSuggestion,
  isCurrentUserSuggestion,
} from '@platejs/suggestion';
import { KEYS, TextApi } from 'platejs';
import { createPlatePlugin } from 'platejs/react';

/**
 * Plate normally extends any insertion suggestion at the cursor, even when
 * that suggestion belongs to another user. In suggestion mode, pasted plain
 * text must instead become a new suggestion owned by the current user.
 */
export const SuggestionForeignInsertPlugin = createPlatePlugin({
  key: 'suggestionForeignInsert',
}).overrideEditor(({ editor, tf: { insertText } }) => ({
  transforms: {
    insertText(text, options) {
      const isSuggesting = editor.getOption(BaseSuggestionPlugin, 'isSuggesting');
      if (!isSuggesting || !editor.selection) return insertText(text, options);

      const leafEntry = editor.api.leaf(editor.selection);
      if (!leafEntry) return insertText(text, options);

      const [leaf] = leafEntry;
      const suggestionData = TextApi.isText(leaf) ? getInlineSuggestionData(leaf) : undefined;
      const isForeignInsertion =
        TextApi.isText(leaf) &&
        Boolean(leaf[KEYS.suggestion]) &&
        suggestionData?.type === 'insert' &&
        !isCurrentUserSuggestion(editor, leaf);

      if (!isForeignInsertion) return insertText(text, options);

      insertTextSuggestion(editor, text);
    },
  },
}));
