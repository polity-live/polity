import { BaseSuggestionPlugin } from '@platejs/suggestion';

import {
  BlockSuggestionStatic,
  SuggestionLineBreakStatic,
  SuggestionLeafStatic,
} from '@/features/shared/ui/ui-platejs/suggestion-node-static.tsx';

export const BaseSuggestionKit = [
  BaseSuggestionPlugin.configure({
    render: {
      belowNodes: ({ api, element }) => {
        if (!api.suggestion?.isBlockSuggestion(element)) {
          return undefined;
        }

        const suggestionData = element.suggestion;
        if (!suggestionData?.isLineBreak) {
          return undefined;
        }

        return function Component({ children }) {
          return (
            <>
              {children}
              <SuggestionLineBreakStatic suggestionData={suggestionData} />
            </>
          );
        };
      },
      belowRootNodes: ({ api, element }) => {
        if (!api.suggestion?.isBlockSuggestion(element)) {
          return undefined;
        }

        return <BlockSuggestionStatic element={element} />;
      },
      node: SuggestionLeafStatic,
    },
  }),
];
