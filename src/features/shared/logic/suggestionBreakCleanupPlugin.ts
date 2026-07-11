import { BaseSuggestionPlugin, getSuggestionKeys } from '@platejs/suggestion';
import { KEYS, TextApi } from 'platejs';
import { createPlatePlugin } from 'platejs/react';

export const SuggestionBreakCleanupPlugin = createPlatePlugin({
  key: 'suggestionBreakCleanup',
}).overrideEditor(({ editor, tf: { insertBreak } }) => ({
  transforms: {
    insertBreak() {
      const isSuggesting = editor.getOption(BaseSuggestionPlugin, 'isSuggesting');
      const result = insertBreak();

      if (isSuggesting || !editor.selection) return result;

      const leafEntry = editor.api.leaf(editor.selection);
      if (!leafEntry) return result;

      const [leaf, path] = leafEntry;
      if (!TextApi.isText(leaf) || leaf.text !== '') return result;

      const suggestionKeys = getSuggestionKeys(leaf);
      if (!leaf[KEYS.suggestion] && suggestionKeys.length === 0) return result;

      editor.getApi(BaseSuggestionPlugin).suggestion.withoutSuggestions(() => {
        editor.tf.unsetNodes([KEYS.suggestion, ...suggestionKeys], { at: path });
      });

      return result;
    },
  },
}));
