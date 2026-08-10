import { BaseSuggestionPlugin, getSuggestionKeys } from '@platejs/suggestion';
import { ElementApi, KEYS, TextApi } from 'platejs';
import { createPlatePlugin } from 'platejs/react';

export const SuggestionBreakCleanupPlugin = createPlatePlugin({
  key: 'suggestionBreakCleanup',
}).overrideEditor(({ editor, tf: { insertBreak } }) => ({
  transforms: {
    insertBreak() {
      const isSuggesting = editor.getOption(BaseSuggestionPlugin, 'isSuggesting');
      const result = insertBreak();

      if (isSuggesting) return result;

      const selection = editor.selection;
      if (!selection) return result;
      const leafEntry = editor.api.leaf(selection);
      if (!leafEntry) return result;

      const [leaf, path] = leafEntry;
      if (!TextApi.isText(leaf) || leaf.text !== '') return result;

      const suggestionKeys = getSuggestionKeys(leaf);
      const hasLeafSuggestion = Boolean(leaf[KEYS.suggestion]) || suggestionKeys.length > 0;
      const blockEntry = editor.api.above({ at: selection });
      const hasInheritedLineBreakSuggestion =
        blockEntry &&
        ElementApi.isElement(blockEntry[0]) &&
        editor.getApi(BaseSuggestionPlugin).suggestion.isBlockSuggestion(blockEntry[0]) &&
        blockEntry[0].suggestion?.isLineBreak;

      if (!hasLeafSuggestion && !hasInheritedLineBreakSuggestion) return result;

      editor.getApi(BaseSuggestionPlugin).suggestion.withoutSuggestions(() => {
        if (hasLeafSuggestion) {
          editor.tf.unsetNodes([KEYS.suggestion, ...suggestionKeys], { at: path });
        }
        if (hasInheritedLineBreakSuggestion) {
          editor.tf.unsetNodes([KEYS.suggestion], { at: blockEntry[1] });
        }
      });

      return result;
    },
  },
}));
